-- Hive Break · Lembretes, parte 2: o motor (FUNIL_LEMBRETES.md, doc do Luan)
--
-- lembretes_pendentes(): o n8n chama a cada 15 min. Avalia os gatilhos de tempo,
--   reserva cada envio em notification_log e devolve as linhas prontas.
-- lembrete_imediato(): o n8n chama quando o app avisa de uma ação (webhook).
--
-- Regras comuns (lembrete_reservar):
--   * preferências: categoria, email_ativo, push_ativo e pausa (pausado_ate);
--   * horário silencioso 22h30–8h no fuso da pessoa (e-mail imediato pode sair);
--   * um envio por gatilho, canal e dia; limite diário de e-mail e de push;
--   * na rodada do n8n, no máximo 1 push por pessoa: vai o de maior prioridade,
--     o seguinte espera a próxima rodada (as janelas duram 1 h ou mais);
--   * texto: a variação menos vista pela pessoa nos últimos 30 dias, com todos
--     os tokens preenchidos (variação com token sem valor é pulada);
--   * LEMBRETES_SIMULAR: grava 'simulado' e não devolve a linha.

create type public.lembrete_envio as (
  log_id bigint,
  user_id uuid,
  canal text,
  gatilho text,
  email text,
  nome text,
  assunto text,
  preheader text,
  titulo text,
  texto text,
  cta_texto text,
  url text,
  link_desativar text
);

-- ------------------------------------------------------------- auxiliares
create function public.lembrete_silencio(p_local timestamp) returns boolean
language sql immutable
as $$
  select p_local::time >= time '22:30' or p_local::time < time '08:00';
$$;

-- Um horário que cai no silêncio vai para as 8h seguintes.
create function public.lembrete_ajustar(p_alvo timestamp) returns timestamp
language sql immutable
as $$
  select case
    when p_alvo::time >= time '22:30' then (p_alvo::date + 1) + time '08:00'
    when p_alvo::time < time '08:00' then p_alvo::date + time '08:00'
    else p_alvo
  end;
$$;

-- "No horário da última prática", hoje: se cair no silêncio, vai para as 8h de hoje.
create function public.lembrete_no_dia(p_dia date, p_hora time) returns timestamp
language sql immutable
as $$
  select case when p_hora >= time '22:30' or p_hora < time '08:00' then p_dia + time '08:00' else p_dia + p_hora end;
$$;

create function public.lembrete_janela(p_alvo timestamp, p_local timestamp, p_duracao interval) returns boolean
language sql immutable
as $$
  select p_local >= p_alvo and p_local < p_alvo + p_duracao;
$$;

-- 7h, 19h30.
create function public.lembrete_hora(p_hora time) returns text
language sql immutable
as $$
  select extract(hour from p_hora)::int || 'h' ||
         case when extract(minute from p_hora)::int = 0 then '' else lpad(extract(minute from p_hora)::int::text, 2, '0') end;
$$;

create function public.lembrete_preencher(p_texto text, p_vars jsonb) returns text
language plpgsql immutable
as $$
declare
  r text := p_texto;
  k text;
  v text;
  i int;
begin
  if r is null then
    return null;
  end if;
  -- Duas passadas: um valor pode trazer outro token (ex.: "Semana firme, {nome}").
  for i in 1..2 loop
    for k, v in select key, value from jsonb_each_text(coalesce(p_vars, '{}')) loop
      r := replace(r, '{' || k || '}', coalesce(v, ''));
    end loop;
  end loop;
  return r;
end;
$$;

create function public.lembrete_tem_token(p_texto text) returns boolean
language sql immutable
as $$
  select coalesce(p_texto, '') ~ '\{[^{}[:space:]]+\}';
$$;

-- Token do link "Desativar": <user_id>.<categoria>.<hmac-sha256 em hex>.
create function public.lembrete_token(p_user uuid, p_categoria text) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_user::text || '.' || p_categoria || '.' ||
         encode(extensions.hmac(p_user::text || '.' || p_categoria, public.lembretes_cfg('LEMBRETES_SEGREDO') #>> '{}', 'sha256'), 'hex');
$$;

-- Teste A/B do R0: grupo fixo por pessoa.
create function public.lembrete_grupo_r0(p_user uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when ((hashtext(p_user::text)::bigint % 100) + 100) % 100 < coalesce((public.lembretes_cfg('R0_AB_12H_PCT'))::int, 0)
      then '12h' else '24h'
  end;
$$;

-- Variáveis que valem para qualquer gatilho: nome, ofensiva, próximo desafio...
create function public.lembrete_vars_base(p_user uuid, p_agora timestamptz) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles;
  s public.streaks;
  v_hoje date;
  v_n integer;
  v_titulo text;
  v_duracao integer;
begin
  select * into p from public.profiles where id = p_user;
  select * into s from public.streaks where user_id = p_user;
  v_hoje := (p_agora at time zone p.fuso_horario)::date;
  -- Ofensiva viva: o último dia ativo é hoje ou ontem.
  v_n := case when s.ultimo_dia_ativo >= v_hoje - 1 then coalesce(s.atual, 0) else 0 end;

  select c.titulo, c.duracao_s into v_titulo, v_duracao
  from public.trilha_estados(p_user) t
  join public.challenges c on c.id = t.challenge_id
  where t.estado = 'disponivel'
  order by t.level_id, t.seq
  limit 1;

  return jsonb_strip_nulls(jsonb_build_object(
    'nome', coalesce(nullif(btrim(p.apelido), ''), nullif(split_part(btrim(coalesce(p.nome, '')), ' ', 1), ''), 'você'),
    'objetivo', case p.objetivo
      when 'emagrecer' then 'se mexer mais'
      when 'forca' then 'ganhar força'
      when 'mobilidade' then 'mobilidade'
      when 'condicionamento' then 'condicionamento'
      when 'saude_geral' then 'saúde no dia a dia'
    end,
    -- Sem ofensiva viva, variações com {n} ficam de fora (nada de "0 dias").
    'n', nullif(v_n, 0),
    'n+1', v_n + 1,
    'desafio', v_titulo,
    'duração', case when v_duracao is not null then greatest(1, round(v_duracao / 60.0))::int end
  ));
end;
$$;

-- Números da semana para o resumo (R2): esta semana contra a anterior.
create function public.lembrete_vars_semana(p_user uuid, p_agora timestamptz) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_fuso text;
  v_hoje date;
  a record;
  b record;
  v_titulo text;
begin
  select fuso_horario into v_fuso from public.profiles where id = p_user;
  v_hoje := (p_agora at time zone v_fuso)::date;
  with t as (
    select ca.id, (ca.concluido_em at time zone v_fuso)::date as d, c.duracao_s,
           (select coalesce(sum(ab.reps_validas), 0) from public.attempt_blocks ab where ab.attempt_id = ca.id) as reps
    from public.challenge_attempts ca
    join public.challenges c on c.id = ca.challenge_id
    where ca.user_id = p_user and ca.status = 'concluido' and ca.concluido_em >= p_agora - interval '15 days'
  )
  select
    count(*) filter (where d between v_hoje - 6 and v_hoje) as desafios,
    count(distinct d) filter (where d between v_hoje - 6 and v_hoje) as dias,
    coalesce(round(sum(duracao_s) filter (where d between v_hoje - 6 and v_hoje) / 60.0), 0)::int as min,
    coalesce(sum(reps) filter (where d between v_hoje - 6 and v_hoje), 0)::int as reps,
    count(*) filter (where d between v_hoje - 13 and v_hoje - 7) as desafios_ant,
    coalesce(round(sum(duracao_s) filter (where d between v_hoje - 13 and v_hoje - 7) / 60.0), 0)::int as min_ant,
    coalesce(sum(reps) filter (where d between v_hoje - 13 and v_hoje - 7), 0)::int as reps_ant
  into a from t;
  select
    coalesce(sum(valor) filter (where (criado_em at time zone v_fuso)::date between v_hoje - 6 and v_hoje), 0)::int as xp,
    coalesce(sum(valor) filter (where (criado_em at time zone v_fuso)::date between v_hoje - 13 and v_hoje - 7), 0)::int as xp_ant
  into b from public.xp_events where user_id = p_user and criado_em >= p_agora - interval '15 days';

  v_titulo := case
    when a.desafios > a.desafios_ant then 'Sua semana esquentou 🔥'
    when a.desafios = a.desafios_ant then 'Semana firme, {nome} 💪'
    else 'Semana mais leve. Bora retomar? 🐝'
  end;
  return jsonb_build_object(
    'titulo_semana', v_titulo,
    'dias_semana', a.dias || ' de 7',
    'desafios', a.desafios, 'min', a.min, 'reps', a.reps, 'xp', b.xp,
    'var_desafios', public.lembrete_variacao(a.desafios, a.desafios_ant),
    'var_min', public.lembrete_variacao(a.min, a.min_ant),
    'var_reps', public.lembrete_variacao(a.reps, a.reps_ant),
    'var_xp', public.lembrete_variacao(b.xp, b.xp_ant)
  );
end;
$$;

create function public.lembrete_variacao(p_atual numeric, p_anterior numeric) returns text
language sql immutable
as $$
  select case
    when coalesce(p_anterior, 0) = 0 and coalesce(p_atual, 0) = 0 then 'igual'
    when coalesce(p_anterior, 0) = 0 then 'novo'
    when p_atual = p_anterior then 'igual'
    when p_atual > p_anterior then '+' || round((p_atual - p_anterior) * 100.0 / p_anterior)::int || '%'
    else '−' || round((p_anterior - p_atual) * 100.0 / p_anterior)::int || '%'
  end;
$$;

-- ---------------------------------------------------------------- reserva
-- Aplica as regras comuns, escolhe o texto, reserva em notification_log e
-- devolve a linha para o n8n (nada, se simulado ou barrado).
--   p_canal: força um canal (ex.: A2 tem push em +2h e e-mail em +24h).
--   p_teste: disparo do /admin; ignora preferências, limites e simulação.
--   p_rodada: chamada por lembretes_pendentes (vale o "1 push por rodada").
create function public.lembrete_reservar(
  p_user uuid, p_gatilho text, p_vars jsonb, p_agora timestamptz,
  p_canal text default null, p_teste boolean default false, p_rodada boolean default false
) returns setof public.lembrete_envio
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  g public.lembrete_gatilhos;
  p public.profiles;
  np public.notification_preferences;
  t public.notification_templates;
  r public.lembrete_envio;
  v_local timestamp;
  v_hoje date;
  v_email text;
  v_tem_push boolean;
  v_tem_email boolean;
  v_simular boolean;
  v_canais text[];
  v_canal text;
  v_usado integer;
  v_limite integer;
  v_ok boolean;
  v_assunto text;
  v_preheader text;
  v_titulo text;
  v_texto text;
  v_cta text;
  v_app text;
  v_caminho text;
  v_id bigint;
begin
  select * into g from public.lembrete_gatilhos where gatilho = p_gatilho;
  select * into p from public.profiles where id = p_user;
  if g.gatilho is null or p.id is null then
    return;
  end if;
  select * into np from public.notification_preferences where user_id = p_user;
  select email into v_email from auth.users where id = p_user;
  v_local := p_agora at time zone p.fuso_horario;
  v_hoje := v_local::date;
  v_simular := not p_teste and coalesce((public.lembretes_cfg('LEMBRETES_SIMULAR'))::boolean, true);
  v_app := rtrim(coalesce(public.lembretes_cfg('APP_URL') #>> '{}', ''), '/');

  if not p_teste then
    if np.pausado_ate is not null and np.pausado_ate > p_agora then
      return;
    end if;
    if g.categoria is not null and not coalesce((to_jsonb(np) ->> g.categoria)::boolean, true) then
      return;
    end if;
  end if;

  v_tem_push := exists (select 1 from public.push_subscriptions where user_id = p_user and ativo)
                and (p_teste or coalesce(np.push_ativo, true));
  v_tem_email := v_email is not null and (p_teste or coalesce(np.email_ativo, true));

  if p_canal is not null then
    v_canais := array[p_canal];
  elsif g.modo = 'email' then
    v_canais := array['email'];
  elsif g.modo = 'push_so' then
    v_canais := array['push'];
  elsif g.modo = 'ambos' then
    v_canais := array['push', 'email'];
  else
    -- 'push': e-mail só se a pessoa não tem push.
    v_canais := case when v_tem_push then array['push'] else array['email'] end;
  end if;

  foreach v_canal in array v_canais loop
    continue when v_canal = 'push' and not v_tem_push;
    continue when v_canal = 'email' and not v_tem_email;

    if not p_teste then
      continue when public.lembrete_silencio(v_local) and (v_canal = 'push' or not g.imediato);
      continue when exists (
        select 1 from public.notification_log
        where user_id = p_user and gatilho = p_gatilho and canal = v_canal and dia_local = v_hoje
      );
      if not (v_canal = 'email' and g.fora_do_limite) then
        select count(*) into v_usado
        from public.notification_log l
        join public.lembrete_gatilhos lg on lg.gatilho = l.gatilho
        where l.user_id = p_user and l.canal = v_canal and l.dia_local = v_hoje and l.status <> 'falhou'
          and not (l.canal = 'email' and lg.fora_do_limite);
        v_limite := coalesce((public.lembretes_cfg(case when v_canal = 'email' then 'LIMITE_EMAIL_DIA' else 'LIMITE_PUSH_DIA' end))::int,
                             case when v_canal = 'email' then 1 else 3 end);
        continue when v_usado >= v_limite;
      end if;
      continue when p_rodada and v_canal = 'push' and exists (
        select 1 from public.notification_log
        where user_id = p_user and canal = 'push' and criado_em = p_agora and dia_local is not null
      );
    end if;

    -- A variação menos vista nos últimos 30 dias, com todos os tokens preenchidos.
    v_ok := false;
    for t in
      select nt.* from public.notification_templates nt
      left join lateral (
        select count(*) as vezes, max(l.criado_em) as ultima
        from public.notification_log l
        where l.user_id = p_user and l.template_id = nt.id and l.criado_em > p_agora - interval '30 days'
      ) vis on true
      where nt.gatilho = p_gatilho and nt.canal = v_canal and nt.ativo
      order by vis.vezes, vis.ultima nulls first, nt.variacao
    loop
      v_assunto := public.lembrete_preencher(t.assunto, p_vars);
      v_preheader := public.lembrete_preencher(t.preheader, p_vars);
      v_titulo := public.lembrete_preencher(t.titulo, p_vars);
      v_texto := public.lembrete_preencher(t.texto, p_vars);
      v_cta := public.lembrete_preencher(t.cta_texto, p_vars);
      if not public.lembrete_tem_token(concat_ws(' ', v_assunto, v_preheader, v_titulo, v_texto, v_cta)) then
        v_ok := true;
        exit;
      end if;
    end loop;
    continue when not v_ok;

    v_caminho := coalesce(p_vars ->> 'caminho', g.caminho);
    v_id := null;
    insert into public.notification_log
      (user_id, gatilho, template_id, canal, status, assunto, preheader, titulo, texto, cta_texto, url, variaveis, criado_em, dia_local)
    values
      (p_user, p_gatilho, t.id, v_canal, case when v_simular then 'simulado' else 'reservado' end,
       v_assunto, v_preheader, v_titulo, v_texto, v_cta,
       v_app || v_caminho || case when position('?' in v_caminho) > 0 then '&' else '?' end
         || 'utm_source=lembrete&utm_campaign=' || p_gatilho,
       p_vars, p_agora, case when p_teste then null else v_hoje end)
    on conflict (user_id, gatilho, canal, dia_local) do nothing
    returning id into v_id;
    continue when v_id is null;

    -- W3 é o último: silêncio até a pessoa voltar (o gatilho de challenge_attempts tira a pausa).
    if p_gatilho = 'W3' and not v_simular and not p_teste then
      update public.notification_preferences set pausado_ate = 'infinity' where user_id = p_user;
    end if;

    if not v_simular then
      r.log_id := v_id;
      r.user_id := p_user;
      r.canal := v_canal;
      r.gatilho := p_gatilho;
      r.email := v_email;
      r.nome := p_vars ->> 'nome';
      r.assunto := v_assunto;
      r.preheader := v_preheader;
      r.titulo := v_titulo;
      r.texto := v_texto;
      r.cta_texto := v_cta;
      r.url := (select url from public.notification_log where id = v_id);
      r.link_desativar := v_app || '/lembretes/desativar?token=' || public.lembrete_token(p_user, coalesce(g.categoria, 'todos'));
      return next r;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------ gatilhos de tempo
-- Cada linha: quem, qual gatilho, canal forçado (ou null) e variáveis próprias.
create function public.lembrete_candidatos(p_agora timestamptz)
returns table (user_id uuid, gatilho text, canal text, vars jsonb)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with u as (
    select p.id, p.fuso_horario as fuso, p.horario_lembrete,
           (p_agora at time zone p.fuso_horario) as agora_l,
           (p_agora at time zone p.fuso_horario)::date as hoje,
           (p.criado_em at time zone p.fuso_horario) as criado_l,
           a.ultimo,
           (a.ultimo at time zone p.fuso_horario) as ultimo_l,
           coalesce(a.dias, 0) as dias_ativos,
           a.primeiro_dia,
           coalesce(s.atual, 0) as ofensiva,
           coalesce(s.protetores, 0) as protetores,
           s.ultimo_dia_ativo
    from public.profiles p
    join public.notification_preferences np on np.user_id = p.id
    left join public.streaks s on s.user_id = p.id
    left join lateral (
      select max(ca.concluido_em) as ultimo,
             count(distinct (ca.concluido_em at time zone p.fuso_horario)::date) as dias,
             min((ca.concluido_em at time zone p.fuso_horario)::date) as primeiro_dia
      from public.challenge_attempts ca
      where ca.user_id = p.id and ca.status = 'concluido'
    ) a on true
    where np.pausado_ate is null or np.pausado_ate <= p_agora
  ),
  amigos as (
    select f.user_a as user_id, f.user_b as amigo_id from public.friendships f
    union all
    select f.user_b, f.user_a from public.friendships f
  )
  -- A2: ainda sem o 1º desafio. Push em +2h, e-mail em +24h (ou no horário do lembrete).
  select id, 'A2', 'push', '{}'::jsonb from u
  where dias_ativos = 0
    and public.lembrete_janela(public.lembrete_ajustar(criado_l + interval '2 hours'), agora_l, interval '1 hour')
  union all
  select id, 'A2', 'email', '{}'::jsonb from u
  where dias_ativos = 0
    and public.lembrete_janela(
      public.lembrete_ajustar(coalesce((criado_l::date + 1) + horario_lembrete, criado_l + interval '24 hours')),
      agora_l, interval '2 hours')

  -- A4: fez o dia 1 ontem e ainda não fez o dia 2. No horário em que fez o dia 1.
  union all
  select id, 'A4', null, '{}'::jsonb from u
  where dias_ativos = 1 and ultimo_l::date = hoje - 1
    and public.lembrete_janela(public.lembrete_no_dia(hoje, ultimo_l::time), agora_l, interval '1 hour')

  -- A5: 2 dias ou mais, a partir do 3º dia, ainda treinando (ontem ou hoje) e sem
  -- nenhum convite. Uma vez só.
  union all
  select id, 'A5', null, '{}'::jsonb from u
  where dias_ativos >= 2 and hoje >= primeiro_dia + 2 and ultimo_l::date >= hoje - 1
    and not exists (select 1 from public.invites i where i.inviter_id = u.id)
    and not exists (select 1 from public.lembrete_eventos e where e.user_id = u.id and e.tipo = 'invite_sent')
    and not exists (select 1 from public.notification_log l where l.user_id = u.id and l.gatilho = 'A5')
    and public.lembrete_janela(public.lembrete_no_dia(hoje, ultimo_l::time), agora_l, interval '1 hour')

  -- H1: hive agendada começa em até 15 min. Para quem já confirmou.
  union all
  select hp.user_id, 'H1', null,
         jsonb_build_object('hora', public.lembrete_hora((h.inicio_em at time zone u.fuso)::time),
                            'n', (select count(*) from public.hive_participantes x where x.hive_id = h.id),
                            'caminho', '/hive/' || h.id)
  from public.hives h
  join public.hive_participantes hp on hp.hive_id = h.id and hp.entrou_em < h.inicio_em
  join u on u.id = hp.user_id
  where h.inicio_em > p_agora and h.inicio_em <= p_agora + interval '15 minutes'

  -- H2: a hive começou e o amigo do anfitrião não entrou (nem treinou na última hora).
  union all
  select am.amigo_id, 'H2', null,
         jsonb_strip_nulls(jsonb_build_object(
           'anfitrião', coalesce(pa.apelido, split_part(pa.nome, ' ', 1)),
           'n', nullif((select count(*) from public.hive_participantes x where x.hive_id = h.id and x.user_id <> h.anfitriao_id), 0),
           'caminho', '/hive/' || h.id))
  from public.hives h
  join public.profiles pa on pa.id = h.anfitriao_id
  join amigos am on am.user_id = h.anfitriao_id
  join u on u.id = am.amigo_id
  where h.inicio_em <= p_agora and h.inicio_em > p_agora - interval '15 minutes' and h.fim_em > p_agora
    and not exists (select 1 from public.hive_participantes x where x.hive_id = h.id and x.user_id = am.amigo_id)
    and not exists (select 1 from public.challenge_attempts ca where ca.user_id = am.amigo_id and ca.status = 'concluido'
                    and ca.concluido_em > p_agora - interval '1 hour')

  -- H3: a hive terminou (com 2 pessoas ou mais). E-mail para quem participou...
  union all
  select hp.user_id, 'H3', 'email',
         jsonb_build_object('n', hv.n, 'reps_total', hv.reps, 'min', hv.min, 'caminho', '/hive/' || h.id)
  from public.hives h
  cross join lateral (
    select count(*) as n, coalesce(sum(x.reps), 0) as reps,
           greatest(1, round(extract(epoch from h.fim_em - h.inicio_em) / 60))::int as min
    from public.hive_participantes x where x.hive_id = h.id
  ) hv
  join public.hive_participantes hp on hp.hive_id = h.id
  join u on u.id = hp.user_id
  where h.fim_em <= p_agora and h.fim_em > p_agora - interval '1 hour' and hv.n >= 2
  -- ...e push para os amigos do anfitrião que não foram.
  union all
  select am.amigo_id, 'H3', 'push',
         jsonb_strip_nulls(jsonb_build_object(
           'hora', public.lembrete_hora((h.inicio_em at time zone u.fuso)::time),
           'próximo_horário', (select public.lembrete_hora((min(h2.inicio_em) at time zone u.fuso)::time)
                               from public.hives h2 where h2.anfitriao_id = h.anfitriao_id and h2.inicio_em > p_agora),
           'caminho', '/hive'))
  from public.hives h
  join amigos am on am.user_id = h.anfitriao_id
  join u on u.id = am.amigo_id
  where h.fim_em <= p_agora and h.fim_em > p_agora - interval '1 hour'
    and (select count(*) from public.hive_participantes x where x.hive_id = h.id) >= 2
    and not exists (select 1 from public.hive_participantes x where x.hive_id = h.id and x.user_id = am.amigo_id)

  -- R0: lembrete diário no horário da última prática (A/B: 12h), se ainda não fez hoje.
  -- Para no 3º dia, quando entra a reativação. Quem está no dia 2 recebe o A4.
  union all
  select id, 'R0', null,
         case when ultimo_l::date = hoje - 1 then jsonb_build_object('hora', public.lembrete_hora(ultimo_l::time)) else '{}'::jsonb end
           || jsonb_build_object('grupo_ab', grupo)
  from u
  cross join lateral (select public.lembrete_grupo_r0(u.id) as grupo) gr
  where dias_ativos >= 1 and ultimo_l::date < hoje and ultimo_l::date >= hoje - 2
    and not (dias_ativos = 1 and ultimo_l::date = hoje - 1)
    and public.lembrete_janela(
      case when grupo = '12h'
        then greatest(hoje + time '08:00', public.lembrete_ajustar((hoje + ultimo_l::time) - interval '12 hours'))
        else public.lembrete_no_dia(hoje, ultimo_l::time)
      end, agora_l, interval '1 hour')

  -- R1: ofensiva de 3 dias ou mais e nada hoje, das 20h às 22h.
  union all
  select id, 'R1', null, '{}'::jsonb from u
  where ofensiva >= 3 and ultimo_dia_ativo = hoje - 1
    and agora_l::time >= time '20:00' and agora_l::time < time '22:00'

  -- R1b: idem, sem protetor, das 22h às 22h30.
  union all
  select id, 'R1b', null, '{}'::jsonb from u
  where ofensiva >= 3 and ultimo_dia_ativo = hoje - 1 and protetores = 0
    and agora_l::time >= time '22:00' and agora_l::time < time '22:30'

  -- R2: resumo semanal, sábado das 10h às 12h, para quem treinou nos últimos 14 dias.
  union all
  select id, 'R2', null, public.lembrete_vars_semana(u.id, p_agora) from u
  where extract(isodow from hoje) = 6 and ultimo >= p_agora - interval '14 days'
    and agora_l::time >= time '10:00' and agora_l::time < time '12:00'

  -- S3: ofensiva em dupla em risco: o amigo já fez hoje, a pessoa não. Das 18h às 20h.
  union all
  select x.user_id, 'S3', null, jsonb_build_object('amigo', x.amigo, 'n', x.n)
  from (
    select distinct on (u.id) u.id as user_id,
           coalesce(pf.apelido, split_part(pf.nome, ' ', 1)) as amigo,
           least(u.ofensiva + 1, sf.atual) as n
    from u
    join amigos am on am.user_id = u.id
    join public.profiles pf on pf.id = am.amigo_id
    join public.streaks sf on sf.user_id = am.amigo_id
    where u.ofensiva >= 1 and u.ultimo_dia_ativo = u.hoje - 1
      and sf.ultimo_dia_ativo = (p_agora at time zone pf.fuso_horario)::date and sf.atual >= 2
      and u.agora_l::time >= time '18:00' and u.agora_l::time < time '20:00'
    order by u.id, least(u.ofensiva + 1, sf.atual) desc
  ) x

  -- W1, W2, W3: 3, 7 e 14 dias sem desafio, no horário da última prática.
  -- Quem ainda está na ativação (menos de 2 dias feitos) não recebe.
  union all
  select id, case hoje - ultimo_l::date when 3 then 'W1' when 7 then 'W2' else 'W3' end, null,
         jsonb_strip_nulls(jsonb_build_object('amigos_ativos', nullif((
           select count(distinct ca.user_id) from amigos am
           join public.challenge_attempts ca on ca.user_id = am.amigo_id and ca.status = 'concluido'
             and ca.concluido_em > p_agora - interval '7 days'
           where am.user_id = u.id), 0),
           'dias_parado', hoje - ultimo_l::date))
  from u
  where dias_ativos >= 2
    and (hoje - ultimo_l::date in (3, 7)
         or (hoje - ultimo_l::date >= 14
             and not exists (select 1 from public.notification_log l
                             where l.user_id = u.id and l.gatilho = 'W3' and l.criado_em > u.ultimo)))
    and public.lembrete_janela(public.lembrete_no_dia(hoje, ultimo_l::time), agora_l, interval '1 hour');
$$;

-- ------------------------------------------------- chamadas do n8n
create function public.lembretes_pendentes(p_agora timestamptz default now())
returns setof public.lembrete_envio
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c record;
begin
  -- Duas rodadas ao mesmo tempo não disputam as mesmas pessoas.
  perform pg_advisory_xact_lock(hashtext('hive_break:lembretes_pendentes'));
  for c in
    select x.*, g.prioridade
    from public.lembrete_candidatos(p_agora) x
    join public.lembrete_gatilhos g on g.gatilho = x.gatilho
    order by x.user_id, g.prioridade, x.gatilho, x.canal
  loop
    return query
      select * from public.lembrete_reservar(
        c.user_id, c.gatilho, public.lembrete_vars_base(c.user_id, p_agora) || c.vars, p_agora, c.canal, false, true);
  end loop;
end;
$$;

-- Valores de exemplo para disparos de teste do /admin (gatilhos que pedem dados).
create function public.lembrete_vars_exemplo() returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'amigo', 'Ana', 'anfitrião', 'Ana', 'hora', '15h', 'próximo_horário', '18h', 'xp', 20, 'tempo', '15 dias',
    'reps', 42, 'min', 4, 'reps_total', 180, 'qtd', 3, 'amigos_ativos', 2, 'dias_parado', 3,
    'titulo_semana', 'Semana firme, {nome} 💪', 'dias_semana', '4 de 7', 'desafios', 6,
    'var_desafios', '+20%', 'var_min', '+15%', 'var_reps', 'igual', 'var_xp', '+10%');
$$;

create function public.lembrete_imediato(p_user_id uuid, p_gatilho text, p_dados jsonb)
returns setof public.lembrete_envio
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  g public.lembrete_gatilhos;
  v_agora timestamptz := now();
  v_dados jsonb := coalesce(p_dados, '{}');
  v_teste boolean;
  v_vars jsonb;
  v_extra jsonb := '{}';
  v_fuso text;
  v_dias integer;
  v_n integer;
  v_amigo text;
  v_attempt uuid;
begin
  select * into g from public.lembrete_gatilhos where gatilho = p_gatilho;
  select fuso_horario into v_fuso from public.profiles where id = p_user_id;
  if g.gatilho is null or v_fuso is null then
    return;
  end if;
  v_teste := coalesce((v_dados ->> 'teste')::boolean, false)
             and coalesce(public.lembretes_cfg('ADMINS'), '[]') ? p_user_id::text;
  if not v_teste and not g.imediato then
    return;
  end if;

  -- Só os campos esperados entram nas variáveis, com tamanho limitado.
  v_amigo := left(btrim(v_dados ->> 'amigo'), 40);
  v_extra := jsonb_strip_nulls(jsonb_build_object(
    'amigo', nullif(v_amigo, ''),
    'xp', case when (v_dados ->> 'xp') ~ '^\d{1,6}$' then (v_dados ->> 'xp')::int end,
    'tempo', nullif(left(btrim(v_dados ->> 'tempo'), 30), ''),
    'caminho', case when (v_dados ->> 'caminho') ~ '^/[A-Za-z0-9/_-]{0,80}$' then v_dados ->> 'caminho' end));

  if v_teste then
    v_vars := public.lembrete_vars_exemplo() || public.lembrete_vars_base(p_user_id, v_agora);
    if not v_vars ? 'n' then
      v_vars := v_vars || jsonb_build_object('n', 12, 'n+1', 13);
    end if;
    v_vars := v_vars || v_extra;
    return query select * from public.lembrete_reservar(p_user_id, p_gatilho, v_vars, v_agora, null, true, false);
    return;
  end if;

  select count(distinct (concluido_em at time zone v_fuso)::date) into v_dias
  from public.challenge_attempts where user_id = p_user_id and status = 'concluido';

  case p_gatilho
    when 'A1' then
      if exists (select 1 from public.notification_log where user_id = p_user_id and gatilho = 'A1') then
        return;
      end if;
    when 'A3' then
      -- Só no 1º dia de treino, uma vez na vida.
      if v_dias <> 1 or exists (select 1 from public.notification_log where user_id = p_user_id and gatilho = 'A3') then
        return;
      end if;
      select id into v_attempt from public.challenge_attempts
      where user_id = p_user_id and status = 'concluido' order by concluido_em limit 1;
      select jsonb_strip_nulls(jsonb_build_object(
               'reps', nullif((select sum(reps_validas) from public.attempt_blocks where attempt_id = v_attempt), 0),
               'min', greatest(1, round(c.duracao_s / 60.0))::int))
      into v_extra
      from public.challenge_attempts a join public.challenges c on c.id = a.challenge_id where a.id = v_attempt;
    when 'R3' then
      select atual into v_n from public.streaks where user_id = p_user_id;
      if v_n is null or v_n not in (7, 14, 30, 100, 365) or exists (
        select 1 from public.notification_log
        where user_id = p_user_id and gatilho = 'R3' and variaveis ->> 'n' = v_n::text
      ) then
        return;
      end if;
      v_extra := v_extra || jsonb_build_object('n', v_n, 'caminho', '/perfil');
    when 'S6' then
      -- Agrupado: um por dia. Se já chegaram vários hoje, sai o número.
      select count(distinct de_user) into v_n from public.high_fives
      where para_user = p_user_id and (criado_em at time zone v_fuso)::date = (v_agora at time zone v_fuso)::date;
      if v_n > 1 then
        v_extra := (v_extra - 'amigo') || jsonb_build_object('qtd', v_n);
      elsif v_amigo is null then
        return;
      end if;
    else
      -- S1, S4, S5: precisam do nome do amigo.
      if v_amigo is null or (p_gatilho = 'S4' and not v_extra ? 'xp') then
        return;
      end if;
  end case;

  v_vars := public.lembrete_vars_base(p_user_id, v_agora) || v_extra;
  return query select * from public.lembrete_reservar(p_user_id, p_gatilho, v_vars, v_agora, null, false, false);
end;
$$;

-- --------------------------------------------------------------- permissões
revoke execute on function
  public.lembrete_silencio(timestamp), public.lembrete_ajustar(timestamp), public.lembrete_no_dia(date, time),
  public.lembrete_janela(timestamp, timestamp, interval), public.lembrete_hora(time),
  public.lembrete_preencher(text, jsonb), public.lembrete_tem_token(text),
  public.lembrete_token(uuid, text), public.lembrete_grupo_r0(uuid),
  public.lembrete_vars_base(uuid, timestamptz), public.lembrete_vars_semana(uuid, timestamptz),
  public.lembrete_variacao(numeric, numeric), public.lembrete_vars_exemplo(),
  public.lembrete_reservar(uuid, text, jsonb, timestamptz, text, boolean, boolean),
  public.lembrete_candidatos(timestamptz), public.lembretes_pendentes(timestamptz),
  public.lembrete_imediato(uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.lembretes_pendentes(timestamptz) to n8n_lembretes;
grant execute on function public.lembrete_imediato(uuid, text, jsonb) to n8n_lembretes;
grant execute on all functions in schema public to service_role;
