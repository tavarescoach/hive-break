-- Hive Break · Hive ao vivo (decisões do Luan em 17/11/2026)
--
-- Uma hive é um grupo fazendo o mesmo desafio ao mesmo tempo:
--   * todos veem as hives abertas e todos podem dar join (visibilidade 'aberta');
--   * dá para entrar a qualquer momento, inclusive com a hive em andamento: quem
--     chega atrasado faz o desafio do início, no próprio relógio, e entra no
--     mesmo card coletivo;
--   * os números dos colegas ficam escondidos durante o exercício, a não ser
--     que o anfitrião ligue o modo competição;
--   * ninguém transmite vídeo: o tempo real (quem está em série, pausa, reps)
--     passa pelo canal Realtime do Supabase e só tem números.
--
-- O estado da hive vem do relógio, não de uma coluna:
--   sala       = antes de inicio_em (sala de espera de 60 s);
--   andamento  = entre inicio_em e fim_em;
--   encerrada  = depois de fim_em.
-- Cada join atrasado empurra fim_em para que o card coletivo espere todo mundo.

create table public.hives (
  id uuid primary key default gen_random_uuid(),
  anfitriao_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null references public.challenges (id),
  modo_competicao boolean not null default false,
  -- 'equipe' fica reservado para hives fechadas de empresa (pós-MVP).
  visibilidade text not null default 'aberta' check (visibilidade in ('aberta', 'equipe')),
  criada_em timestamptz not null default now(),
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  check (fim_em > inicio_em)
);
create index hives_fim_idx on public.hives (fim_em desc);
create index hives_anfitriao_idx on public.hives (anfitriao_id, fim_em desc);

create table public.hive_participantes (
  hive_id uuid not null references public.hives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  atrasado boolean not null default false,
  attempt_id uuid references public.challenge_attempts (id) on delete set null,
  concluido_em timestamptz,
  modo text check (modo in ('camera', 'manual')),
  xp integer check (xp >= 0),
  reps integer check (reps >= 0),
  tempo_valido_s numeric(6, 1) check (tempo_valido_s >= 0),
  primary key (hive_id, user_id)
);
create index hive_participantes_user_idx on public.hive_participantes (user_id, entrou_em desc);

alter table public.hives enable row level security;
alter table public.hive_participantes enable row level security;
revoke all on public.hives, public.hive_participantes from anon, authenticated;
grant select on public.hives, public.hive_participantes to authenticated;
grant all on public.hives, public.hive_participantes to service_role;
-- Todos veem as hives e quem está nelas (decisão do Luan). Nome e foto vêm de
-- perfis_publicos; dados de saúde continuam só com o dono.
create policy "hives: todos leem" on public.hives for select to authenticated using (true);
create policy "participantes: todos leem" on public.hive_participantes for select to authenticated using (true);

-- Duração de referência para fechar a hive: duração do desafio + 3 min de
-- folga (preparo, pausas e quem demora a tocar em começar).
create function public.hive_duracao(p_challenge_id text) returns interval
language sql stable
set search_path = public, pg_temp
as $$
  select make_interval(secs => coalesce((select duracao_s from public.challenges where id = p_challenge_id), 300) + 180)
$$;

create function public.hive_status(h public.hives) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case when now() < h.inicio_em then 'sala' when now() < h.fim_em then 'andamento' else 'encerrada' end
$$;

-- A pessoa entrou numa hive deste desafio nas últimas 3 horas. Quem está na
-- hive pode fazer o desafio mesmo que ele ainda esteja bloqueado na trilha
-- dela ("o objetivo é hive"). Travado pela triagem continua travado.
create function public.em_hive_do_desafio(p_user uuid, p_challenge_id text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hive_participantes hp join public.hives h on h.id = hp.hive_id
    where hp.user_id = p_user and h.challenge_id = p_challenge_id and hp.entrou_em > now() - interval '3 hours'
  )
$$;

create function public.exigir_cadastro() returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and onboarding_concluido_em is not null) then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  return v_user;
end;
$$;

-- Começar uma hive: o anfitrião escolhe um desafio liberado para ele.
-- Cada pessoa tem no máximo uma hive aberta como anfitriã.
create function public.criar_hive(p_challenge_id text, p_competicao boolean default false) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  v_estado text;
  v_id uuid;
begin
  select estado into v_estado from public.trilha_estados(v_user) where challenge_id = p_challenge_id;
  if v_estado is null then
    raise exception 'desafio_inexistente' using errcode = '22023';
  end if;
  if v_estado in ('bloqueado', 'travado') then
    raise exception 'desafio_bloqueado' using errcode = '22023';
  end if;
  select id into v_id from public.hives where anfitriao_id = v_user and fim_em > now() order by criada_em desc limit 1;
  if v_id is not null then
    raise exception 'hive_ativa' using errcode = '22023', hint = v_id::text;
  end if;
  insert into public.hives (anfitriao_id, challenge_id, modo_competicao, inicio_em, fim_em)
  values (v_user, p_challenge_id, coalesce(p_competicao, false), now() + interval '60 seconds',
          now() + interval '60 seconds' + public.hive_duracao(p_challenge_id))
  returning id into v_id;
  insert into public.hive_participantes (hive_id, user_id) values (v_id, v_user);
  return v_id;
end;
$$;

-- Join: vale na sala e com a hive em andamento. Quem entra atrasado empurra o
-- fim da hive para o card coletivo esperar por ele.
create function public.entrar_hive(p_hive uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  h public.hives;
  v_estado text;
  v_atrasado boolean;
begin
  select * into h from public.hives where id = p_hive for update;
  if h.id is null then
    raise exception 'hive_inexistente' using errcode = '22023';
  end if;
  if public.hive_status(h) = 'encerrada' then
    raise exception 'hive_encerrada' using errcode = '22023';
  end if;
  select estado into v_estado from public.trilha_estados(v_user) where challenge_id = h.challenge_id;
  if v_estado = 'travado' then
    raise exception 'desafio_travado' using errcode = '22023';
  end if;
  v_atrasado := now() >= h.inicio_em;
  insert into public.hive_participantes (hive_id, user_id, atrasado) values (h.id, v_user, v_atrasado)
  on conflict (hive_id, user_id) do nothing;
  if found and v_atrasado then
    update public.hives set fim_em = greatest(fim_em, now() + public.hive_duracao(challenge_id)) where id = h.id;
  end if;
  return jsonb_build_object('challenge_id', h.challenge_id, 'atrasado', v_atrasado);
end;
$$;

-- Anfitrião: começar já (pula o resto da sala de espera).
create function public.comecar_hive_agora(p_hive uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  update public.hives set inicio_em = now(), fim_em = now() + public.hive_duracao(challenge_id)
  where id = p_hive and anfitriao_id = v_user and now() < inicio_em;
end;
$$;

-- Anfitrião: liga ou desliga o modo competição enquanto a hive está na sala.
create function public.definir_competicao_hive(p_hive uuid, p_valor boolean) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  update public.hives set modo_competicao = coalesce(p_valor, false)
  where id = p_hive and anfitriao_id = v_user and now() < inicio_em;
end;
$$;

-- Fecha a participação com a tentativa que o servidor já gravou em
-- finalizar_desafio: os números do card coletivo não vêm do aparelho.
create function public.registrar_resultado_hive(p_hive uuid) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  hp public.hive_participantes;
  h public.hives;
  a public.challenge_attempts;
begin
  select * into hp from public.hive_participantes where hive_id = p_hive and user_id = v_user;
  if hp.hive_id is null then
    return false;
  end if;
  select * into h from public.hives where id = p_hive;
  select * into a from public.challenge_attempts
  where user_id = v_user and challenge_id = h.challenge_id and status = 'concluido' and concluido_em >= hp.entrou_em
  order by concluido_em desc limit 1;
  if a.id is null then
    return false;
  end if;
  update public.hive_participantes
  set attempt_id = a.id, concluido_em = a.concluido_em, modo = a.modo, xp = coalesce(a.xp, 0),
      reps = (select coalesce(sum(reps_validas), 0) from public.attempt_blocks where attempt_id = a.id),
      tempo_valido_s = (select coalesce(sum(tempo_valido_s), 0) from public.attempt_blocks where attempt_id = a.id)
  where hive_id = p_hive and user_id = v_user;
  return true;
end;
$$;

-- Uma hive com os participantes (nome e foto públicos) e os resultados.
create function public.hive_json(h public.hives, p_user uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', h.id,
    'status', public.hive_status(h),
    'inicio_em', h.inicio_em,
    'fim_em', h.fim_em,
    'modo_competicao', h.modo_competicao,
    'anfitriao_id', h.anfitriao_id,
    'anfitriao', (select apelido from public.perfis_publicos where id = h.anfitriao_id),
    'challenge_id', h.challenge_id,
    'desafio', c.titulo,
    'modalidade', c.modalidade,
    'duracao_s', c.duracao_s,
    'sou_participante', exists (select 1 from public.hive_participantes where hive_id = h.id and user_id = p_user),
    'amigo', h.anfitriao_id = p_user or exists (
      select 1 from public.friendships f
      where (f.user_a = p_user and f.user_b = h.anfitriao_id) or (f.user_b = p_user and f.user_a = h.anfitriao_id)
    ),
    'participantes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', hp.user_id, 'apelido', coalesce(pp.apelido, 'Alguém'), 'avatar_url', pp.avatar_url,
        'atrasado', hp.atrasado, 'concluido', hp.concluido_em is not null, 'modo', hp.modo,
        'xp', hp.xp, 'reps', hp.reps, 'tempo_valido_s', hp.tempo_valido_s
      ) order by hp.entrou_em), '[]'::jsonb)
      from public.hive_participantes hp
      left join public.perfis_publicos pp on pp.id = hp.user_id
      where hp.hive_id = h.id
    )
  )
  from public.challenges c where c.id = h.challenge_id
$$;

create function public.ler_hive(p_hive uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  h public.hives;
begin
  select * into h from public.hives where id = p_hive;
  if h.id is null then
    return null;
  end if;
  return public.hive_json(h, v_user)
    || jsonb_build_object('estado_desafio', (select estado from public.trilha_estados(v_user) where challenge_id = h.challenge_id));
end;
$$;

-- Aba Hive: hives na sala ou em andamento (as de amigos primeiro) e as
-- encerradas na última hora de que a pessoa participou.
create function public.listar_hives() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  return coalesce((
    select jsonb_agg(j order by (j ->> 'status') = 'encerrada', (j ->> 'amigo')::boolean desc, j ->> 'inicio_em')
    from (
      select public.hive_json(h, v_user) as j
      from public.hives h
      where h.visibilidade = 'aberta'
        and (h.fim_em > now()
             or (h.fim_em > now() - interval '1 hour'
                 and exists (select 1 from public.hive_participantes where hive_id = h.id and user_id = v_user)))
      order by h.inicio_em desc
      limit 50
    ) x
  ), '[]'::jsonb);
end;
$$;

-- finalizar_desafio igual à da migração 0007, com uma mudança: quem está numa
-- hive do desafio pode fazê-lo mesmo bloqueado na trilha.
create or replace function public.finalizar_desafio(p_challenge_id text, p_modo text, p_blocos jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  c public.challenges;
  v_estado text;
  v_modo text := p_modo;
  v_hoje date;
  v_refeito boolean;
  v_refazer_pago boolean;
  v_primeiro boolean;
  v_base integer;
  v_xp_desafio integer;
  v_xp_primeiro integer := 0;
  v_xp integer;
  v_attempt uuid;
  v_total_blocos integer;
  v_blocos_ativos integer := 0;
  v_sem_movimento boolean := false;
  v_unidade_concluida boolean := false;
  v_unidade_sessao boolean := false;
  v_nivel_concluido boolean := false;
  v_proximo smallint;
  v_ofensiva integer;
  b jsonb;
  bloco public.challenge_blocks;
  v_segundos integer;
  v_reps integer;
  v_tempo numeric;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_modo not in ('camera', 'manual') then
    raise exception 'modo_invalido' using errcode = '22023';
  end if;
  select * into p from public.profiles where id = v_user;
  if p.onboarding_concluido_em is null then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  select * into c from public.challenges where id = p_challenge_id;
  if c.id is null then
    raise exception 'desafio_inexistente' using errcode = '22023';
  end if;
  select estado into v_estado from public.trilha_estados(v_user) where challenge_id = c.id;
  -- Bloqueado na trilha, mas a pessoa está numa hive deste desafio: pode fazer.
  if v_estado = 'travado' or (v_estado = 'bloqueado' and not public.em_hive_do_desafio(v_user, c.id)) then
    raise exception 'desafio_bloqueado' using errcode = '22023';
  end if;
  v_refeito := v_estado = 'concluido';

  -- Confere os números enviados pelo aparelho e recusa valores impossíveis (seção 9.5).
  select count(*) into v_total_blocos from public.challenge_blocks where challenge_id = c.id;
  if jsonb_typeof(coalesce(p_blocos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_blocos, '[]'::jsonb)) > v_total_blocos
     or pg_column_size(p_blocos) > 20000 then
    raise exception 'kpis_invalidos' using errcode = '22023';
  end if;
  if v_modo = 'camera' then
    for b in select * from jsonb_array_elements(p_blocos) loop
      select * into bloco from public.challenge_blocks
      where challenge_id = c.id and ordem = (b ->> 'ordem')::int;
      if bloco.id is null or jsonb_typeof(b -> 'kpis') is distinct from 'object' then
        raise exception 'kpis_invalidos' using errcode = '22023';
      end if;
      v_segundos := coalesce((bloco.parametros_por_dificuldade -> 'padrao' ->> 'segundos')::int, c.duracao_s);
      v_reps := coalesce((b ->> 'reps_validas')::int, 0);
      v_tempo := coalesce((b ->> 'tempo_valido_s')::numeric, 0);
      -- Limite humano: no máximo 4 repetições por segundo; tempo válido não passa do tempo do bloco.
      if v_reps < 0 or v_reps > v_segundos * 4 or v_tempo < 0 or v_tempo > v_segundos + 5
         or coalesce((b ->> 'reps_parciais')::int, 0) not between 0 and v_segundos * 4
         or coalesce((b ->> 'fora_quadro_pct')::numeric, 0) not between 0 and 100 then
        raise exception 'kpis_invalidos' using errcode = '22023';
      end if;
      if v_reps > 0 or v_tempo >= 3 then
        v_blocos_ativos := v_blocos_ativos + 1;
      end if;
    end loop;
    -- A câmera não viu movimento em pelo menos metade dos exercícios: vale como modo manual.
    if v_blocos_ativos * 2 < v_total_blocos then
      v_modo := 'manual';
      v_sem_movimento := true;
    end if;
  end if;

  v_hoje := (now() at time zone p.fuso_horario)::date;
  select exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and challenge_id = c.id and status = 'concluido' and refeito and xp > 0
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_refazer_pago;
  select not exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_primeiro;

  v_base := public.xp_do_desafio(c.tipo);
  v_xp_desafio := case
    when v_refeito and v_refazer_pago then 0
    else greatest(1, round(v_base * (case when v_modo = 'manual' then 0.5 else 1 end) * (case when v_refeito then 1.0 / 3 else 1 end)))::int
  end;
  if v_primeiro then
    v_xp_primeiro := case when v_modo = 'manual' then 3 else 5 end;
  end if;
  v_xp := v_xp_desafio + v_xp_primeiro;

  insert into public.challenge_attempts
    (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp, valido_para_liga, refeito)
  values (v_user, c.id, p.dificuldade_atual, v_modo, 'concluido', now(), v_xp_desafio, false, v_refeito)
  returning id into v_attempt;

  if p_modo = 'camera' then
    insert into public.attempt_blocks
      (attempt_id, challenge_block_id, exercise_id, serie, reps_validas, reps_parciais, tempo_valido_s, kpis, fora_quadro_pct)
    select v_attempt, cb.id, cb.exercise_id, 1,
           coalesce((e ->> 'reps_validas')::int, 0), coalesce((e ->> 'reps_parciais')::int, 0),
           coalesce((e ->> 'tempo_valido_s')::numeric, 0), e -> 'kpis', coalesce((e ->> 'fora_quadro_pct')::numeric, 0)
    from jsonb_array_elements(p_blocos) e
    join public.challenge_blocks cb on cb.challenge_id = c.id and cb.ordem = (e ->> 'ordem')::int
    on conflict (attempt_id, challenge_block_id, serie) do nothing;
  end if;

  if v_xp_desafio > 0 then
    insert into public.xp_events (user_id, tipo, valor, attempt_id)
    values (v_user, case when v_refeito then 'refazer' else 'desafio' end, v_xp_desafio, v_attempt);
  end if;
  if v_xp_primeiro > 0 then
    insert into public.xp_events (user_id, tipo, valor, attempt_id) values (v_user, 'primeiro_do_dia', v_xp_primeiro, v_attempt);
  end if;

  insert into public.user_challenge_progress (user_id, challenge_id, liberado, tentativas, concluido_em)
  values (v_user, c.id, true, 1, now())
  on conflict (user_id, challenge_id) do update
    set tentativas = public.user_challenge_progress.tentativas + 1,
        concluido_em = coalesce(public.user_challenge_progress.concluido_em, now());

  -- Ofensiva: versão simples (dias seguidos). Protetor, recuperação, marcos e
  -- a virada do dia por cron entram na Fase 4.
  insert into public.streak_days (user_id, dia, tipo) values (v_user, v_hoje, 'feito')
  on conflict (user_id, dia) do nothing;
  update public.streaks
  set atual = case
        when ultimo_dia_ativo = v_hoje then atual
        when ultimo_dia_ativo = v_hoje - 1 then atual + 1
        else 1
      end,
      ultimo_dia_ativo = v_hoje
  where user_id = v_user;
  update public.streaks set recorde = greatest(recorde, atual) where user_id = v_user
  returning atual into v_ofensiva;

  if not v_refeito then
    select not exists (
      select 1 from public.trilha_estados(v_user) where unit_id = c.unit_id and estado in ('disponivel', 'bloqueado')
    ) into v_unidade_concluida;
    select not exists (
      select 1 from public.trilha_estados(v_user) where level_id = c.level_id and estado in ('disponivel', 'bloqueado')
    ) into v_nivel_concluido;
  end if;

  -- Unidade inteira numa única sessão: do primeiro ao último desafio em até 3 horas.
  if v_unidade_concluida then
    select max(ucp.concluido_em) - min(ucp.concluido_em) <= interval '3 hours' into v_unidade_sessao
    from public.user_challenge_progress ucp
    join public.challenges ch on ch.id = ucp.challenge_id
    where ucp.user_id = v_user and ch.unit_id = c.unit_id and ucp.concluido_em is not null;
    if v_unidade_sessao then
      insert into public.xp_events (user_id, tipo, valor, attempt_id) values (v_user, 'unidade_sessao', 50, v_attempt);
      v_xp := v_xp + 50;
    end if;
  end if;

  if v_nivel_concluido then
    update public.user_level_progress set concluido_em = now()
    where user_id = v_user and level_id = c.level_id and concluido_em is null;
    if found then
      insert into public.xp_events (user_id, tipo, valor) values (v_user, 'nivel_concluido', 30);
      v_xp := v_xp + 30;
      select id into v_proximo from public.levels where ordem = (select ordem + 1 from public.levels where id = c.level_id);
      if v_proximo is not null then
        insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, v_proximo, true)
        on conflict (user_id, level_id) do update set liberado = true;
        update public.profiles set nivel_atual = v_proximo where id = v_user and nivel_atual = c.level_id;
      end if;
    else
      v_nivel_concluido := false;
    end if;
  end if;

  return jsonb_build_object(
    'xp', v_xp, 'modo', v_modo, 'sem_movimento', v_sem_movimento,
    'primeiro_do_dia', v_primeiro, 'refeito', v_refeito, 'refazer_sem_xp', v_refeito and v_refazer_pago,
    'ofensiva', v_ofensiva, 'unidade_concluida', v_unidade_concluida, 'unidade_sessao', coalesce(v_unidade_sessao, false),
    'nivel_concluido', v_nivel_concluido, 'proximo_nivel', v_proximo
  );
end;
$$;

-- Privilégios: retira tudo e concede função por função (ver migração 0005).
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.minhas_ligas() to authenticated;
grant execute on function public.registrar_triagem(jsonb) to authenticated;
grant execute on function public.declarar_liberacao_medica() to authenticated;
grant execute on function public.definir_compromisso(integer) to authenticated;
grant execute on function public.registrar_convite(text) to authenticated;
grant execute on function public.concluir_onboarding() to authenticated;
grant execute on function public.convite_publico(text) to anon, authenticated;
grant execute on function public.ler_trilha() to authenticated;
grant execute on function public.finalizar_desafio(text, text, jsonb) to authenticated;
grant execute on function public.concluir_desafio_provisorio(text) to authenticated;
grant execute on function public.registrar_dor(text, text, text) to authenticated;
grant execute on function public.registrar_esforco(text, integer) to authenticated;
grant execute on function public.abrir_bau(text, integer) to authenticated;
grant execute on function public.pular_para_secao(integer) to authenticated;
grant execute on function public.criar_hive(text, boolean) to authenticated;
grant execute on function public.entrar_hive(uuid) to authenticated;
grant execute on function public.comecar_hive_agora(uuid) to authenticated;
grant execute on function public.definir_competicao_hive(uuid, boolean) to authenticated;
grant execute on function public.registrar_resultado_hive(uuid) to authenticated;
grant execute on function public.ler_hive(uuid) to authenticated;
grant execute on function public.listar_hives() to authenticated;
grant execute on all functions in schema public to service_role;
