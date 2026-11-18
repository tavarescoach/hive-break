-- Hive Break · Bônus por tamanho da hive e bônus de hive completa
-- (especificação completa em docs/BONUS_HIVE.md; item #3 da ordem de execução)
--
-- Resumo do mecanismo:
--   * cada participante que CONCLUI (câmera + até 30% fora do quadro, igual à
--     regra da liga) rende um bônus % sobre o XP base do desafio, maior
--     conforme mais gente concluiu junto (seção 3);
--   * se todo mundo que entrou (menos quem marcou "parei por dor ou
--     compromisso") concluiu, e a hive tem 4+ pessoas, rola +20% extra (4.1);
--   * quando o último participante ativo acaba, se alguém ainda não concluiu
--     (e não se justificou), abre uma janela de 30 min pra essa pessoa
--     refazer sozinha; ao fim da janela a hive fecha de vez e os bônus são
--     creditados em xp_events (4.2);
--   * os bônus só valem nas 3 primeiras hives do dia de cada pessoa (seção 5).

alter table public.hive_participantes
  add column status text not null default 'ativo' check (status in ('ativo', 'concluiu', 'saiu', 'parou_justificado')),
  add column motivo_parada text check (motivo_parada in ('dor', 'compromisso')),
  add column xp_base integer check (xp_base >= 0),
  add column xp_bonus_tamanho integer not null default 0 check (xp_bonus_tamanho >= 0),
  add column xp_bonus_completa integer not null default 0 check (xp_bonus_completa >= 0),
  add column bonus_contou_no_dia boolean not null default false;

alter table public.hives
  add column n_concluiram integer not null default 0,
  add column bonus_tamanho_pct integer not null default 0,
  add column completa boolean not null default false,
  add column janela_ate timestamptz,
  add column fechada_em timestamptz;

-- ---------------------------------------------------------------------------
-- Fórmula do bônus por tamanho (seção 3): bonus% = min(60, round(18,5·ln(n) − 2,8))
-- ---------------------------------------------------------------------------
create function public.hive_bonus_tamanho_pct(p_n integer) returns integer
language sql immutable
set search_path = public, pg_temp
as $$
  select case when p_n < 2 then 0 else least(60, round(18.5 * ln(p_n::numeric) - 2.8))::integer end
$$;

-- Quem conta para os bônus (seção 2): concluiu com câmera e ficou no quadro
-- pelo menos 70% do tempo — a mesma regra de validade de liga_xp_vale.
create function public.hive_participante_conta(hp public.hive_participantes) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select hp.concluido_em is not null and hp.modo = 'camera'
    and coalesce((select avg(fora_quadro_pct) from public.attempt_blocks where attempt_id = hp.attempt_id), 0) <= 30
$$;

-- ---------------------------------------------------------------------------
-- Fechamento e crédito dos bônus (seção 4.2 e 5)
-- ---------------------------------------------------------------------------

-- Credita o XP de bônus de cada participante elegível, respeitando o limite
-- de 3 hives com bônus por dia (seção 5). Chamada só quando a hive já decidiu
-- fechar (completa de cara, ou janela esgotada).
create function public.hive_creditar(p_hive uuid, p_bonus_tamanho_pct integer, p_completa boolean) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  hp public.hive_participantes;
  v_fuso text;
  v_dia date;
  v_contagem_hoje integer;
  v_bonus_t integer;
  v_bonus_c integer;
  v_conta boolean;
begin
  for hp in select * from public.hive_participantes where hive_id = p_hive and status = 'concluiu' loop
    if not public.hive_participante_conta(hp) then
      continue;
    end if;
    -- Sem gente suficiente pra render bônus (n < 2): não consome vaga do dia.
    if p_bonus_tamanho_pct <= 0 then
      update public.hive_participantes set xp_bonus_tamanho = 0, xp_bonus_completa = 0, bonus_contou_no_dia = false, xp = coalesce(hp.xp_base, 0)
      where hive_id = hp.hive_id and user_id = hp.user_id;
      continue;
    end if;
    select fuso_horario into v_fuso from public.profiles where id = hp.user_id;
    v_dia := (hp.concluido_em at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date;
    select count(*) into v_contagem_hoje
    from public.hive_participantes x
    where x.user_id = hp.user_id and x.bonus_contou_no_dia and x.hive_id <> p_hive
      and (x.concluido_em at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date = v_dia;
    v_conta := v_contagem_hoje < 3;
    v_bonus_t := case when v_conta then round(coalesce(hp.xp_base, 0) * p_bonus_tamanho_pct / 100.0)::integer else 0 end;
    v_bonus_c := case when v_conta and p_completa then round(coalesce(hp.xp_base, 0) * 0.20)::integer else 0 end;
    update public.hive_participantes
    set xp_bonus_tamanho = v_bonus_t, xp_bonus_completa = v_bonus_c, bonus_contou_no_dia = v_conta,
        xp = coalesce(hp.xp_base, 0) + v_bonus_t + v_bonus_c
    where hive_id = hp.hive_id and user_id = hp.user_id;
    if v_bonus_t > 0 then
      insert into public.xp_events (user_id, tipo, valor, attempt_id) values (hp.user_id, 'bonus_hive_tamanho', v_bonus_t, hp.attempt_id);
    end if;
    if v_bonus_c > 0 then
      insert into public.xp_events (user_id, tipo, valor, attempt_id) values (hp.user_id, 'bonus_hive_completa', v_bonus_c, hp.attempt_id);
    end if;
  end loop;
end;
$$;

-- O coração do fechamento: idempotente, chamada a cada evento relevante (quem
-- concluiu, quem se justificou) e por um cron de 1 min (hive_fechar_tudo).
create function public.hive_fechar_se_pronto(p_hive uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  h public.hives;
  v_total integer;
  v_justificados integer;
  v_elegiveis integer;
  v_concluiram integer;
  v_pendentes integer;
  v_todos_concluiram boolean;
  v_completa boolean;
  v_bonus_pct integer;
begin
  select * into h from public.hives where id = p_hive for update;
  if h.id is null or h.fechada_em is not null then
    return;
  end if;
  -- A hive só pode fechar depois de começar: na sala de espera, mais gente ainda pode entrar.
  if now() < h.inicio_em then
    return;
  end if;

  select count(*) into v_total from public.hive_participantes where hive_id = h.id;
  select count(*) into v_justificados from public.hive_participantes where hive_id = h.id and status = 'parou_justificado';
  v_elegiveis := v_total - v_justificados;
  select count(*) into v_concluiram
  from public.hive_participantes hp
  where hp.hive_id = h.id and hp.status = 'concluiu' and public.hive_participante_conta(hp);
  select count(*) into v_pendentes from public.hive_participantes where hive_id = h.id and status = 'ativo';

  -- "Todo mundo concluiu" fecha a hive de cara (com ou sem o extra de completa,
  -- que só vale com 4+ pessoas na hive — seção 4.1).
  v_todos_concluiram := v_elegiveis = 0 or v_concluiram = v_elegiveis;
  v_completa := v_elegiveis > 0 and v_todos_concluiram and v_total >= 4;
  v_bonus_pct := public.hive_bonus_tamanho_pct(v_concluiram);

  -- Ainda tem gente ativa e a hive nem acabou no relógio: não é hora de decidir nada.
  if v_pendentes > 0 and now() < h.fim_em then
    return;
  end if;

  if v_todos_concluiram then
    perform public.hive_creditar(h.id, v_bonus_pct, v_completa);
    update public.hives set n_concluiram = v_concluiram, bonus_tamanho_pct = v_bonus_pct, completa = v_completa, fechada_em = now() where id = h.id;
    return;
  end if;

  if h.janela_ate is null then
    -- Último participante ativo acabou e falta gente: abre a janela de resgate.
    update public.hives set n_concluiram = v_concluiram, bonus_tamanho_pct = v_bonus_pct, janela_ate = now() + interval '30 minutes' where id = h.id;
    return;
  end if;

  if now() < h.janela_ate then
    update public.hives set n_concluiram = v_concluiram, bonus_tamanho_pct = v_bonus_pct where id = h.id;
    return;
  end if;

  -- Janela esgotada: fecha de vez com o que tiver.
  perform public.hive_creditar(h.id, v_bonus_pct, v_completa);
  update public.hives set n_concluiram = v_concluiram, bonus_tamanho_pct = v_bonus_pct, completa = v_completa, fechada_em = now() where id = h.id;
end;
$$;

-- Varredura do cron (fallback: se não tiver pg_cron, a hive fecha lazy em ler_hive).
create function public.hive_fechar_tudo() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  for r in
    select id from public.hives
    where fechada_em is null and criada_em > now() - interval '1 day'
      and (now() >= fim_em or janela_ate is not null)
  loop
    perform public.hive_fechar_se_pronto(r.id);
  end loop;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hive-break-fechar-hives', '* * * * *', 'select public.hive_fechar_tudo()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível (%); as hives fecham na primeira leitura', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Parei por dor ou compromisso" (seção 4.1): sai da conta sem travar o
-- bônus dos outros nem aparecer em avisos.
-- ---------------------------------------------------------------------------
create function public.hive_parar_justificado(p_hive uuid, p_motivo text) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  if p_motivo not in ('dor', 'compromisso') then
    raise exception 'motivo_invalido' using errcode = '22023';
  end if;
  update public.hive_participantes set status = 'parou_justificado', motivo_parada = p_motivo
  where hive_id = p_hive and user_id = v_user and status = 'ativo';
  if not found then
    return false;
  end if;
  perform public.hive_fechar_se_pronto(p_hive);
  return true;
end;
$$;
grant execute on function public.hive_parar_justificado(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- registrar_resultado_hive passa a marcar status = 'concluiu', gravar xp_base
-- e tentar fechar a hive (seção 4.2).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_resultado_hive(p_hive uuid) returns boolean
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
  set attempt_id = a.id, concluido_em = a.concluido_em, modo = a.modo, xp = coalesce(a.xp, 0), xp_base = coalesce(a.xp, 0),
      status = 'concluiu',
      reps = (select coalesce(sum(reps_validas), 0) from public.attempt_blocks where attempt_id = a.id),
      tempo_valido_s = (select coalesce(sum(tempo_valido_s), 0) from public.attempt_blocks where attempt_id = a.id)
  where hive_id = p_hive and user_id = v_user;
  perform public.hive_fechar_se_pronto(p_hive);
  return true;
end;
$$;

-- ler_hive: fecha a hive lazy (fallback sem pg_cron) e expõe os campos novos.
create or replace function public.hive_json(h public.hives, p_user uuid) returns jsonb
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
    'n_concluiram', h.n_concluiram,
    'bonus_tamanho_pct', h.bonus_tamanho_pct,
    'completa', h.completa,
    'janela_ate', h.janela_ate,
    'fechada_em', h.fechada_em,
    'participantes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', hp.user_id, 'apelido', coalesce(pp.apelido, 'Alguém'), 'avatar_url', pp.avatar_url,
        'atrasado', hp.atrasado, 'concluido', hp.concluido_em is not null, 'modo', hp.modo,
        'xp', hp.xp, 'reps', hp.reps, 'tempo_valido_s', hp.tempo_valido_s,
        'status', hp.status, 'motivo_parada', hp.motivo_parada,
        'xp_base', hp.xp_base, 'xp_bonus_tamanho', hp.xp_bonus_tamanho, 'xp_bonus_completa', hp.xp_bonus_completa
      ) order by hp.entrou_em), '[]'::jsonb)
      from public.hive_participantes hp
      left join public.perfis_publicos pp on pp.id = hp.user_id
      where hp.hive_id = h.id
    )
  )
  from public.challenges c where c.id = h.challenge_id
$$;

create or replace function public.ler_hive(p_hive uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  h public.hives;
begin
  perform public.hive_fechar_se_pronto(p_hive);
  select * into h from public.hives where id = p_hive;
  if h.id is null then
    return null;
  end if;
  return public.hive_json(h, v_user)
    || jsonb_build_object('estado_desafio', (select estado from public.trilha_estados(v_user) where challenge_id = h.challenge_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- O bônus de hive vale na liga como XP de desafio normal (seção 5): usa a
-- mesma tentativa (câmera, ≤30% fora do quadro) já validada por hive_participante_conta.
-- ---------------------------------------------------------------------------
create or replace function public.liga_xp_vale(p_user uuid, p_tipo text, p_valor integer, p_attempt uuid, p_quando timestamptz)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a public.challenge_attempts;
  v_respiracao boolean;
  v_fora numeric;
begin
  if p_valor <= 0 then
    return false;
  end if;
  if p_tipo = 'convite' then
    return true;
  end if;
  if p_tipo not in ('desafio', 'refazer', 'primeiro_do_dia', 'unidade_sessao', 'nivel_concluido', 'bonus_hive_tamanho', 'bonus_hive_completa') then
    return false;
  end if;

  if p_attempt is not null then
    select * into a from public.challenge_attempts where id = p_attempt;
  else
    -- Nível concluído não guarda a tentativa: vale a que fechou o nível.
    select * into a from public.challenge_attempts
    where user_id = p_user and status = 'concluido'
      and concluido_em between p_quando - interval '5 minutes' and p_quando
    order by concluido_em desc limit 1;
  end if;
  if a.id is null or a.status <> 'concluido' then
    return false;
  end if;

  select c.modalidade = 'respiracao' into v_respiracao from public.challenges c where c.id = a.challenge_id;
  if coalesce(v_respiracao, false) then
    return true;
  end if;
  if a.modo <> 'camera' then
    return false;
  end if;
  select coalesce(avg(fora_quadro_pct), 0) into v_fora from public.attempt_blocks where attempt_id = a.id;
  return v_fora <= 30;
end;
$$;
