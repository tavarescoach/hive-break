-- Hive Break · Resgate: funções (docs/RESGATE.md, seções 2, 3, 5, 6 e 7)
--
-- amigos_para_resgatar(): candidatos elegíveis, na ordem da seção 3.
-- resgate_popup_hoje(): aplica o limite de 1 pop-up/dia (evento rescue_prompt_shown).
-- enviar_resgate(): grava o envio e devolve o caminho para onde o link leva.
-- resgate_concluir(): chamada depois de finalizar_desafio; fecha resgates abertos
--   em até 48h, dá a recompensa (seção 6) e devolve quem chamou a pessoa de volta.
--
-- Link de onde o desafio-por-link (item #6) ainda não existe: para quem já é
-- amigo cadastrado, o botão abre o próprio desafio disponível na trilha dela
-- (o mais curto, no gancho de benefício) ou a hive aberta, nunca um link de
-- visitante sem login.

create type public.resgate_candidato as (
  amigo_id uuid,
  apelido text,
  avatar_url text,
  dias_parado integer,
  hives_juntos integer,
  convidado_por_mim boolean,
  amizade_em timestamptz,
  app_disponivel boolean
);

-- ---------------------------------------------------------- quem resgatar
create function public.amigos_para_resgatar() returns setof public.resgate_candidato
language sql stable security definer
set search_path = public, pg_temp
as $$
  with candidatos as (
    select f.user_b as amigo_id from public.friendships f where f.user_a = auth.uid()
    union
    select f.user_a from public.friendships f where f.user_b = auth.uid()
    union
    select hp2.user_id from public.hive_participantes hp1
      join public.hive_participantes hp2 on hp2.hive_id = hp1.hive_id and hp2.user_id <> auth.uid()
      where hp1.user_id = auth.uid()
    union
    select p.id from public.profiles p where p.convidado_por = auth.uid()
  ),
  dados as (
    select
      c.amigo_id,
      pp.apelido, pp.avatar_url,
      (select count(*) from public.challenge_attempts ca where ca.user_id = c.amigo_id and ca.status = 'concluido') as total_desafios,
      ((now() at time zone p2.fuso_horario)::date - (
        select max((ca.concluido_em at time zone p2.fuso_horario)::date)
        from public.challenge_attempts ca where ca.user_id = c.amigo_id and ca.status = 'concluido'
      ))::int as dias_parado,
      (select count(distinct hp1.hive_id) from public.hive_participantes hp1
         join public.hive_participantes hp2 on hp2.hive_id = hp1.hive_id and hp2.user_id = c.amigo_id
         where hp1.user_id = auth.uid()) as hives_juntos,
      (p2.convidado_por = auth.uid()) as convidado_por_mim,
      (select max(f.criado_em) from public.friendships f
         where auth.uid() in (f.user_a, f.user_b) and c.amigo_id in (f.user_a, f.user_b)) as amizade_em,
      coalesce(np.amigos, true) and (np.pausado_ate is null or np.pausado_ate <= now()) as app_disponivel
    from candidatos c
    join public.profiles p2 on p2.id = c.amigo_id
    join public.perfis_publicos pp on pp.id = c.amigo_id
    left join public.notification_preferences np on np.user_id = c.amigo_id
    where c.amigo_id <> auth.uid()
  )
  select d.amigo_id, d.apelido, d.avatar_url, d.dias_parado, d.hives_juntos, d.convidado_por_mim, d.amizade_em, d.app_disponivel
  from dados d
  where d.total_desafios >= 2
    and d.dias_parado between 3 and 30
    -- Ninguém mais resgata quem já foi resgatado hoje (seção 3).
    and not exists (
      select 1 from public.resgates r join public.profiles pr on pr.id = r.para_usuario_id
      where r.para_usuario_id = d.amigo_id
        and (r.enviado_em at time zone pr.fuso_horario)::date = (now() at time zone pr.fuso_horario)::date
    )
    -- 3 por semana; depois do 14º dia parado, só 1 por semana (seção 2 e 7).
    and (select count(*) from public.resgates r where r.para_usuario_id = d.amigo_id and r.enviado_em > now() - interval '7 days')
        < case when d.dias_parado > 14 then 1 else 3 end
  order by d.hives_juntos desc, d.convidado_por_mim desc, d.amizade_em desc nulls last;
$$;

-- --------------------------------------------------------------- pop-up
-- No máximo 1 pop-up por dia (seção 3): o próprio evento registrado é o limite.
create function public.resgate_popup_hoje() returns public.resgate_candidato
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  r public.resgate_candidato;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if exists (
    select 1 from public.resgate_eventos e join public.profiles p on p.id = e.user_id
    where e.user_id = v_user and e.tipo = 'rescue_prompt_shown'
      and (e.criado_em at time zone p.fuso_horario)::date = (now() at time zone p.fuso_horario)::date
  ) then
    return null;
  end if;
  select * into r from public.amigos_para_resgatar() limit 1;
  if r.amigo_id is null then
    return null;
  end if;
  insert into public.resgate_eventos (user_id, tipo, dados) values (v_user, 'rescue_prompt_shown', jsonb_build_object('amigo_id', r.amigo_id));
  return r;
end;
$$;

create function public.resgate_dispensar(p_amigo_id uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  insert into public.resgate_eventos (user_id, tipo, dados) values (v_user, 'rescue_dismissed', jsonb_build_object('amigo_id', p_amigo_id));
end;
$$;

-- --------------------------------------------------------- limites de envio
create function public.resgate_enviados_hoje(p_de uuid) returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.resgates r join public.profiles p on p.id = r.de_usuario_id
  where r.de_usuario_id = p_de
    and (r.enviado_em at time zone p.fuso_horario)::date = (now() at time zone p.fuso_horario)::date;
$$;

-- Para onde o link leva (seção 5.3). Sem o desafio-por-link (item #6), usa a
-- trilha de quem foi resgatado: o mais curto no gancho de benefício, a hive
-- aberta no de companhia, senão o próximo desafio disponível.
create function public.resgate_caminho(p_para uuid, p_familia text, p_hive_id uuid default null) returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge text;
begin
  if p_familia = 'C' and p_hive_id is not null then
    return '/hive/' || p_hive_id;
  end if;
  if p_familia = 'B' then
    select t.challenge_id into v_challenge
    from public.trilha_estados(p_para) t
    join public.challenges c on c.id = t.challenge_id
    where t.estado = 'disponivel'
    order by c.duracao_s, t.level_id, t.seq
    limit 1;
  else
    select t.challenge_id into v_challenge
    from public.trilha_estados(p_para) t
    where t.estado = 'disponivel'
    order by t.level_id, t.seq
    limit 1;
  end if;
  return case when v_challenge is not null then '/desafio/' || v_challenge else '/trilha' end;
end;
$$;

-- ------------------------------------------------------------------ envio
create function public.enviar_resgate(p_para uuid, p_familia text, p_gancho_id text, p_texto text, p_canal text, p_hive_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_de uuid := auth.uid();
  v_app_disponivel boolean;
  v_caminho text;
  r public.resgates;
begin
  if v_de is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if v_de = p_para then
    raise exception 'resgate_invalido' using errcode = '22023';
  end if;
  if p_familia not in ('D', 'B', 'C') then
    raise exception 'familia_invalida' using errcode = '22023';
  end if;
  if p_canal not in ('app', 'whatsapp', 'hive') then
    raise exception 'canal_invalido' using errcode = '22023';
  end if;
  if p_texto is null or btrim(p_texto) = '' or char_length(p_texto) > 300 then
    raise exception 'texto_invalido' using errcode = '22023';
  end if;

  -- O candidato precisa estar na lista elegível de quem está mandando (seção 2, 3 e 7).
  select app_disponivel into v_app_disponivel from public.amigos_para_resgatar() where amigo_id = p_para;
  if v_app_disponivel is null then
    raise exception 'candidato_invalido' using errcode = '22023';
  end if;
  if p_canal = 'app' and not v_app_disponivel then
    raise exception 'canal_indisponivel' using errcode = '22023';
  end if;

  -- No máximo 3 resgates por dia por quem resgata (seção 7).
  if public.resgate_enviados_hoje(v_de) >= 3 then
    raise exception 'limite_diario_enviado' using errcode = '22023';
  end if;

  v_caminho := public.resgate_caminho(p_para, p_familia, p_hive_id);

  insert into public.resgates (de_usuario_id, para_usuario_id, familia, gancho_id, texto_final, canal, hive_id)
  values (v_de, p_para, p_familia, left(p_gancho_id, 10), btrim(p_texto), p_canal, p_hive_id)
  returning * into r;

  insert into public.resgate_eventos (resgate_id, user_id, tipo, dados)
  values (r.id, v_de, 'rescue_sent', jsonb_build_object('familia', p_familia, 'canal', p_canal));

  return jsonb_build_object('id', r.id, 'para_usuario_id', r.para_usuario_id, 'canal', r.canal,
                             'caminho', v_caminho, 'app_disponivel', v_app_disponivel);
end;
$$;

-- Melhor resultado de hoje de quem resgata, para preencher o gancho de
-- desafio (seção 4.1: "{reps} {exercicio} em {tempo}"). null se não tiver
-- repetições (cai no RD3, sem token).
create function public.resgate_resultado_hoje() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_fuso text;
  r record;
begin
  if v_user is null then
    return null;
  end if;
  select fuso_horario into v_fuso from public.profiles where id = v_user;
  select ab.reps_validas, e.nome as exercicio, c.duracao_s
  into r
  from public.attempt_blocks ab
  join public.challenge_attempts ca on ca.id = ab.attempt_id
  join public.challenges c on c.id = ca.challenge_id
  join public.exercises e on e.id = ab.exercise_id
  where ca.user_id = v_user and ca.status = 'concluido'
    and (ca.concluido_em at time zone v_fuso)::date = (now() at time zone v_fuso)::date
    and ab.reps_validas > 0
  order by ab.reps_validas desc
  limit 1;
  if r.reps_validas is null then
    return null;
  end if;
  return jsonb_build_object(
    'reps', r.reps_validas,
    'exercicio', r.exercicio,
    'tempo', case when r.duracao_s < 60 then r.duracao_s || ' segundos' else round(r.duracao_s / 60.0)::int || ' min' end
  );
end;
$$;

-- Registrado quando quem foi resgatado abre o link (sem login extra: já é amigo cadastrado).
create function public.registrar_resgate_link_aberto(p_resgate_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;
  if exists (select 1 from public.resgates where id = p_resgate_id and para_usuario_id = v_user) then
    insert into public.resgate_eventos (resgate_id, user_id, tipo) values (p_resgate_id, v_user, 'rescue_link_opened');
  end if;
end;
$$;

-- -------------------------------------------------------------- recompensa
-- Chamada depois de finalizar_desafio: fecha resgates abertos há até 48h,
-- dá 1 protetor de ofensiva (máx. 2 por mês) e progresso na conquista "acolhida".
create function public.resgate_concluir() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  r public.resgates;
  v_mes_inicio timestamptz := date_trunc('month', now());
  v_cap smallint;
  v_resultado jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  for r in
    select * from public.resgates
    where para_usuario_id = v_user and voltou_em is null and enviado_em > now() - interval '48 hours'
    order by enviado_em
  loop
    update public.resgates set voltou_em = now() where id = r.id;
    insert into public.resgate_eventos (resgate_id, user_id, tipo) values (r.id, v_user, 'rescue_returned');

    -- Máximo 2 protetores de resgate por mês para quem resgatou [validar].
    if (select count(*) from public.resgates
        where de_usuario_id = r.de_usuario_id and recompensa_dada and voltou_em >= v_mes_inicio) < 2 then
      select case when atual >= 100 then 4 else 2 end into v_cap from public.streaks where user_id = r.de_usuario_id;
      update public.streaks set protetores = least(protetores + 1, coalesce(v_cap, 2))
      where user_id = r.de_usuario_id and protetores < coalesce(v_cap, 2);
      update public.resgates set recompensa_dada = true where id = r.id;

      insert into public.user_achievements (user_id, achievement_id)
      select r.de_usuario_id, 'acolhida'
      where (select count(*) from public.resgates where de_usuario_id = r.de_usuario_id and recompensa_dada) >=
            coalesce((select (criterio ->> 'valor')::int from public.achievements where id = 'acolhida'), 3)
      on conflict do nothing;
    end if;

    v_resultado := v_resultado || jsonb_build_object('de_usuario_id', r.de_usuario_id, 'amigo', public.lembrete_apelido(r.de_usuario_id));
  end loop;
  return v_resultado;
end;
$$;

-- ------------------------------------------------- gatilhos imediatos novos
insert into public.lembrete_gatilhos (gatilho, etapa, categoria, prioridade, modo, imediato, fora_do_limite, caminho) values
  ('RESGATE',         'social', 'amigos', 1, 'ambos',   true, false, '/amigos'),
  ('RESGATE_VOLTOU',  'social', 'amigos', 1, 'push_so', true, false, '/amigos');

insert into public.notification_templates (id, gatilho, canal, variacao, assunto, preheader, titulo, texto, cta_texto) values
  ('resgate-push-1', 'RESGATE', 'push', 1, null, null, '{amigo} te chamou 🐝', '{gancho}', null),
  ('resgate-email-1', 'RESGATE', 'email', 1,
    '{amigo} te chamou para um break',
    '{gancho}',
    '{amigo} te chamou para um break',
    E'{gancho}',
    'Fazer agora'),
  ('resgate-voltou-push-1', 'RESGATE_VOLTOU', 'push', 1, null, null, '{amigo} voltou! 🙌', 'Seu convite funcionou.', null);

-- --------------------------------------------- gatilho imediato: whitelist
-- Igual à migração 20261120000200_lembretes_motor.sql, com 'gancho' na lista
-- de campos aceitos e o gatilho RESGATE (RESGATE_VOLTOU já cai no "else").
create or replace function public.lembrete_imediato(p_user_id uuid, p_gatilho text, p_dados jsonb)
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
    'gancho', nullif(left(btrim(v_dados ->> 'gancho'), 300), ''),
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
    when 'RESGATE' then
      if v_amigo is null or not (v_extra ? 'gancho') then
        return;
      end if;
    else
      -- S1, S4, S5, RESGATE_VOLTOU: precisam do nome do amigo.
      if v_amigo is null or (p_gatilho = 'S4' and not v_extra ? 'xp') then
        return;
      end if;
  end case;

  v_vars := public.lembrete_vars_base(p_user_id, v_agora) || v_extra;
  return query select * from public.lembrete_reservar(p_user_id, p_gatilho, v_vars, v_agora, null, false, false);
end;
$$;

-- -------------------------------------------- suprimir W1/W2 no dia do resgate
-- Igual à migração 20261120000200_lembretes_motor.sql: "quem cobra é o amigo,
-- não a marca" (docs/RESGATE.md, seção 1) — W1/W2 ficam de fora no dia em que
-- a pessoa já recebeu um resgate (W3 continua, pois já tem sua própria pausa).
create or replace function public.lembrete_candidatos(p_agora timestamptz)
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
  -- Quem ainda está na ativação (menos de 2 dias feitos) não recebe. W1/W2 ficam
  -- de fora no dia em que a pessoa já recebeu um resgate de um amigo.
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
    and public.lembrete_janela(public.lembrete_no_dia(hoje, ultimo_l::time), agora_l, interval '1 hour')
    and not (
      (hoje - ultimo_l::date) in (3, 7)
      and exists (
        select 1 from public.resgates r
        where r.para_usuario_id = u.id and (r.enviado_em at time zone u.fuso)::date = u.hoje
      )
    );
$$;

-- --------------------------------------------------------------- permissões
revoke execute on function
  public.amigos_para_resgatar(), public.resgate_popup_hoje(), public.resgate_dispensar(uuid),
  public.resgate_enviados_hoje(uuid), public.resgate_caminho(uuid, text, uuid), public.enviar_resgate(uuid, text, text, text, text, uuid),
  public.registrar_resgate_link_aberto(bigint), public.resgate_concluir(), public.resgate_resultado_hoje()
from public, anon, authenticated;

grant execute on function public.amigos_para_resgatar(), public.resgate_popup_hoje(), public.resgate_dispensar(uuid),
  public.enviar_resgate(uuid, text, text, text, text, uuid), public.registrar_resgate_link_aberto(bigint), public.resgate_concluir(),
  public.resgate_resultado_hoje()
to authenticated;
grant execute on all functions in schema public to service_role;
