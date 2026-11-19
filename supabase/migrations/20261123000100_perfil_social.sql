-- Hive Break · Vitrine, feed de amigos e seguindo/seguidores (docs/PERFIL.md, seção 3)
--
-- "Amigo", aqui, é sao_amigos() (seguir mútuo OU amizade já existente). O
-- catálogo de eventos do feed (`SOCIAL_DUOLINGO.md`, citado pelo PERFIL.md)
-- não existe neste repositório: uso um catálogo mínimo com o que já existe
-- no banco (conquista, nível concluído, subida de divisão, marco de
-- ofensiva), sem tabela nova — é só leitura combinada do que já existia.

alter table public.profiles
  add column vitrine_conquistas text[] not null default '{}' check (cardinality(vitrine_conquistas) <= 3);

-- A vitrine aparece para todo mundo, inclusive no perfil público (seção 6).
create or replace view public.perfis_publicos with (security_invoker = false) as
  select id, apelido, avatar_url, divisao_atual, nivel_atual, username, criado_em,
    objetivo, meta_desafios_dia, dias_semana, vitrine_conquistas
  from public.profiles
  where onboarding_concluido_em is not null;

-- Progresso de cada conquista para quem pergunta: "atual"/"meta" cobrem os
-- critérios com contador óbvio; os demais ficam só como conquistada ou não
-- (atual/meta nulos), o que basta para a vitrine e para "quase lá".
create function public.progresso_conquistas(p_user uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'nome', a.nome, 'descricao', a.descricao,
    'conquistada', ua.user_id is not null, 'conquistada_em', ua.conquistada_em,
    'atual', case a.criterio ->> 'tipo'
      when 'desafios_concluidos' then (select count(*) from public.challenge_attempts where user_id = p_user and status = 'concluido')
      when 'ofensiva' then (select greatest(atual, recorde) from public.streaks where user_id = p_user)
      when 'nivel_concluido' then (select count(*) from public.user_level_progress where user_id = p_user and concluido_em is not null)
      when 'amigos_ativados' then (select count(*) from public.invites where inviter_id = p_user and ativado_em is not null)
      when 'subidas_divisao' then (select count(*) from public.league_members where user_id = p_user and resultado = 'subiu')
      when 'reps_validas' then (
        select coalesce(sum(ab.reps_validas), 0) from public.attempt_blocks ab
        join public.challenge_attempts c on c.id = ab.attempt_id
        where c.user_id = p_user and ab.exercise_id = a.criterio ->> 'exercicio'
      )
      else null
    end,
    'meta', (a.criterio ->> 'valor')::numeric
  ) order by (ua.user_id is null), a.id)
  , '[]'::jsonb)
  from public.achievements a
  left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = p_user
$$;
grant execute on function public.progresso_conquistas(uuid) to anon, authenticated;

-- O dono escolhe até 3 conquistas já conquistadas para a vitrine.
create function public.definir_vitrine(p_ids text[]) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  v_ids text[] := coalesce(p_ids, '{}');
begin
  if cardinality(v_ids) > 3 then
    raise exception 'vitrine_demais' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_ids) id
    where not exists (select 1 from public.user_achievements where user_id = v_user and achievement_id = id)
  ) then
    raise exception 'conquista_nao_sua' using errcode = '22023';
  end if;
  update public.profiles set vitrine_conquistas = v_ids where id = v_user;
end;
$$;
grant execute on function public.definir_vitrine(text[]) to authenticated;

-- Feed de amigos (seção 3.3): no máximo 1 evento por amigo por dia, o mais
-- recente. Alguém "em hive agora" é calculado à parte, no selo da capa.
create function public.feed_amigos(p_limite int default 20) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', f.user_id, 'apelido', f.apelido, 'username', f.username, 'avatar_url', f.avatar_url,
      'tipo', f.tipo, 'rotulo', f.rotulo, 'quando', f.quando,
      'high_fives', (
        select count(*) from public.high_fives
        where para_user = f.user_id and (criado_em at time zone 'UTC')::date = (f.quando at time zone 'UTC')::date
      ),
      'eu_dei_high_five', exists (
        select 1 from public.high_fives
        where de_user = v_user and para_user = f.user_id and (criado_em at time zone 'UTC')::date = (f.quando at time zone 'UTC')::date
      )
    ))
    from (
      select x.user_id, x.tipo, x.rotulo, x.quando, pp.apelido, pp.username, pp.avatar_url
      from (
        select distinct on (user_id, dia) user_id, tipo, rotulo, quando from (
          select ua.user_id, 'conquista' as tipo, a.nome as rotulo, ua.conquistada_em as quando, ua.conquistada_em::date as dia
          from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
          where public.sao_amigos(v_user, ua.user_id)

          union all

          select ulp.user_id, 'nivel_concluido', 'Nível ' || l.ordem || ' concluído', ulp.concluido_em, ulp.concluido_em::date
          from public.user_level_progress ulp join public.levels l on l.id = ulp.level_id
          where ulp.concluido_em is not null and public.sao_amigos(v_user, ulp.user_id)

          union all

          select lm.user_id, 'subiu_divisao', 'Subiu de divisão', lg.semana_fim::timestamptz, lg.semana_fim
          from public.league_members lm join public.leagues lg on lg.id = lm.league_id
          where lm.resultado = 'subiu' and public.sao_amigos(v_user, lm.user_id)
        ) eventos
        order by user_id, dia, quando desc
      ) x
      join public.perfis_publicos pp on pp.id = x.user_id
      order by x.quando desc
      limit greatest(1, least(p_limite, 50))
    ) f
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.feed_amigos(int) to authenticated;

create function public.dar_high_five(p_para uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  if p_para = v_user then
    raise exception 'nao_pode_a_si' using errcode = '22023';
  end if;
  if not exists (select 1 from public.high_fives where de_user = v_user and para_user = p_para and criado_em::date = current_date) then
    insert into public.high_fives (de_user, para_user) values (v_user, p_para);
  end if;
end;
$$;
grant execute on function public.dar_high_five(uuid) to authenticated;
grant select on public.high_fives to authenticated;
create policy "high fives: quem deu ou recebeu le" on public.high_fives for select to authenticated
  using ((select auth.uid()) in (de_user, para_user));

-- Seguindo / seguidores, ordenados por XP da semana (seção 3.4).
create function public.minha_rede(p_tipo text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  v_inicio_semana date := date_trunc('week', current_date)::date;
begin
  if p_tipo not in ('seguindo', 'seguidores') then
    raise exception 'tipo_invalido' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pp.id, 'apelido', pp.apelido, 'username', pp.username, 'avatar_url', pp.avatar_url,
      'divisao_atual', pp.divisao_atual,
      'xp_semana', (select coalesce(sum(valor), 0) from public.xp_events where user_id = pp.id and criado_em >= v_inicio_semana),
      'em_hive_agora', exists (
        select 1 from public.hive_participantes hp join public.hives h on h.id = hp.hive_id
        where hp.user_id = pp.id and now() between h.inicio_em and h.fim_em
      ),
      'seguindo', exists (select 1 from public.seguidores where seguidor_id = v_user and seguido_id = pp.id),
      'segue_voce', exists (select 1 from public.seguidores where seguidor_id = pp.id and seguido_id = v_user)
    ) order by (select coalesce(sum(valor), 0) from public.xp_events where user_id = pp.id and criado_em >= v_inicio_semana) desc)
    from public.seguidores s
    join public.perfis_publicos pp
      on pp.id = (case when p_tipo = 'seguindo' then s.seguido_id else s.seguidor_id end)
    where (case when p_tipo = 'seguindo' then s.seguidor_id else s.seguido_id end) = v_user
      and s.status = 'ativo'
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.minha_rede(text) to authenticated;
