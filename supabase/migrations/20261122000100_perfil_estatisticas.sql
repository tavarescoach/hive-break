-- Hive Break · Grade de estatísticas e calendário (docs/PERFIL.md, seções 2.5 e 2.6)
--
-- "Esconder XP" (seção 7) controla o que amigos e terceiros logados veem:
-- desligado (padrão) eles veem a grade inteira; ligado, só ofensiva e
-- conquistas. Quem não está logado (perfil público) vê só ofensiva e liga,
-- em qualquer caso — mais restrito do que o padrão para quem está logado.

alter table public.profiles add column esconder_xp boolean not null default false;
grant update (esconder_xp) on public.profiles to authenticated;

create function public.estatisticas_perfil(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  p public.profiles;
  s public.streaks;
  v_nivel text;
  v_inicio_ts timestamptz;
  v_xp_total integer;
  v_xp_semana integer;
  v_podios integer;
  v_semanas_liga integer;
  v_minutos_total numeric;
  v_minutos_semana numeric;
  v_hives_grupo integer;
begin
  select * into p from public.profiles where id = p_user and onboarding_concluido_em is not null;
  if p.id is null then
    return null;
  end if;
  select * into s from public.streaks where user_id = p_user;

  if v_viewer = p_user then
    v_nivel := 'dono';
  elsif v_viewer is null then
    v_nivel := 'publico';
  elsif p.esconder_xp then
    v_nivel := 'limitado';
  else
    v_nivel := 'completo';
  end if;

  if v_nivel in ('dono', 'completo') then
    v_inicio_ts := (date_trunc('week', (now() at time zone p.fuso_horario)::date)::timestamp) at time zone p.fuso_horario;
    select coalesce(sum(valor), 0) into v_xp_total from public.xp_events where user_id = p_user;
    select coalesce(sum(valor), 0) into v_xp_semana from public.xp_events where user_id = p_user and criado_em >= v_inicio_ts;
    select count(*) into v_podios from public.league_members where user_id = p_user and posicao_final between 1 and 3;
    select count(*) into v_semanas_liga from public.league_members where user_id = p_user;
    select coalesce(sum(c.duracao_s), 0) / 60.0 into v_minutos_total
      from public.challenge_attempts a join public.challenges c on c.id = a.challenge_id
      where a.user_id = p_user and a.status = 'concluido';
    select coalesce(sum(c.duracao_s), 0) / 60.0 into v_minutos_semana
      from public.challenge_attempts a join public.challenges c on c.id = a.challenge_id
      where a.user_id = p_user and a.status = 'concluido' and a.concluido_em >= v_inicio_ts;
    select count(*) into v_hives_grupo from public.hive_participantes where user_id = p_user and concluido_em is not null;
  end if;

  return jsonb_build_object(
    'nivel', v_nivel,
    'ofensiva', coalesce(s.atual, 0), 'recorde', coalesce(s.recorde, 0),
    'divisao', p.divisao_atual,
    'protetores', case when v_nivel in ('dono', 'completo') then s.protetores end,
    'xp_total', case when v_nivel in ('dono', 'completo') then v_xp_total end,
    'xp_semana', case when v_nivel in ('dono', 'completo') then v_xp_semana end,
    'semana_liga', case when v_nivel in ('dono', 'completo') then v_semanas_liga end,
    'podios', case when v_nivel in ('dono', 'completo') then v_podios end,
    'minutos_total', case when v_nivel in ('dono', 'completo') then round(v_minutos_total) end,
    'minutos_semana', case when v_nivel in ('dono', 'completo') then round(v_minutos_semana) end,
    'hives_grupo', case when v_nivel in ('dono', 'completo') then v_hives_grupo end
  );
end;
$$;
grant execute on function public.estatisticas_perfil(uuid) to anon, authenticated;

-- Calendário do mês (seção 2.6): mesma régua do nível 'dono'/'completo' da
-- estatísticas — quem não está logado não vê o histórico dia a dia.
create function public.calendario_mes(p_user uuid, p_ano int, p_mes int) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  p public.profiles;
  v_inicio date;
  v_fim date;
  v_inicio_ts timestamptz;
  v_fim_ts timestamptz;
begin
  select * into p from public.profiles where id = p_user and onboarding_concluido_em is not null;
  if p.id is null or p_mes not between 1 and 12 then
    return null;
  end if;
  if not (v_viewer = p_user or (v_viewer is not null and not p.esconder_xp)) then
    return '[]'::jsonb;
  end if;

  v_inicio := make_date(p_ano, p_mes, 1);
  v_fim := (v_inicio + interval '1 month')::date;
  v_inicio_ts := v_inicio::timestamp at time zone p.fuso_horario;
  v_fim_ts := v_fim::timestamp at time zone p.fuso_horario;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'dia', d::date, 'hives', coalesce(t.n, 0),
      'bateu_meta', coalesce(t.n, 0) >= p.meta_desafios_dia,
      'hive_grupo', coalesce(hg.n, 0) > 0
    ) order by d)
    from generate_series(v_inicio, v_fim - interval '1 day', interval '1 day') as d
    left join (
      select (concluido_em at time zone p.fuso_horario)::date as dia, count(*) as n
      from public.challenge_attempts
      where user_id = p_user and status = 'concluido' and concluido_em >= v_inicio_ts and concluido_em < v_fim_ts
      group by 1
    ) t on t.dia = d::date
    left join (
      select (entrou_em at time zone p.fuso_horario)::date as dia, count(*) as n
      from public.hive_participantes
      where user_id = p_user and concluido_em is not null and entrou_em >= v_inicio_ts and entrou_em < v_fim_ts
      group by 1
    ) hg on hg.dia = d::date
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.calendario_mes(uuid, int, int) to authenticated;
