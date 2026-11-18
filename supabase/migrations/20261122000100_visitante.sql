-- Hive Break · Visitante: joga antes do cadastro, username + código por e-mail
-- (docs/VISITANTE.md, item #5 da ordem social)
--
-- O visitante é um usuário anônimo do Supabase Auth (signInAnonymously). O
-- gatilho de cadastro cria o perfil dele com visitante = true. Ele escolhe um
-- username, faz a declaração de saúde e já pode jogar. Quando confirma o e-mail
-- (updateUser + código), o Auth grava o e-mail e o gatilho em auth.users chama
-- converter_visitante: a conta vira permanente com o mesmo id.
--
-- Enquanto é visitante:
--   * não pontua na liga (os pontos entram na confirmação);
--   * não recebe lembretes (sem notification_preferences, sem e-mail e sem push);
--   * não gera convite com recompensa (o código dele não vale como convite);
--   * o convite que o trouxe só é ativado depois da confirmação + 1º desafio;
--   * entra em hive normalmente (conta no bônus de tamanho, BONUS_HIVE.md).
--
-- Declaração de saúde (decisão do Luan em 18/11/2026): no lugar das perguntas
-- uma a uma, a pessoa declara que responde NÃO às perguntas do questionário de
-- prontidão e confirma o termo de responsabilidade. Quem não pode declarar fica
-- só com respiração e mobilidade de baixa intensidade.

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column username text check (username ~ '^[a-z0-9._]{3,20}$'),
  add column username_trocado_em timestamptz,
  add column ref_convite text,
  add column triagem_respondida_em timestamptz,
  add column triagem_restricao boolean not null default false,
  add column visitante boolean not null default false;
create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_visitante_idx on public.profiles (criado_em) where visitante;

-- Quem já fez a triagem antiga conta como respondida (sim em alguma = restrição antiga, por intensidade).
update public.profiles p set triagem_respondida_em = h.quando
from (select user_id, max(realizado_em) as quando from public.health_screenings group by user_id) h
where h.user_id = p.id;

-- ---------------------------------------------------------------------------
-- Eventos do funil do visitante (seção 9 e 10)
-- ---------------------------------------------------------------------------
create table public.eventos_visitante (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('visitor_started', 'username_created', 'screening_done', 'visitor_challenge_completed',
                                     'email_code_sent', 'email_code_verified', 'visitor_converted', 'visitor_expired')),
  -- Sem chave estrangeira: o evento sobrevive ao visitante apagado (visitor_expired).
  user_id uuid,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index eventos_visitante_tipo_idx on public.eventos_visitante (tipo, criado_em desc);
create index eventos_visitante_user_idx on public.eventos_visitante (user_id, criado_em desc);
alter table public.eventos_visitante enable row level security;
revoke all on public.eventos_visitante from anon, authenticated;
grant all on public.eventos_visitante to service_role;

create function public.evento_visitante(p_tipo text, p_user uuid, p_dados jsonb default '{}') returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.eventos_visitante (tipo, user_id, dados) values (p_tipo, p_user, coalesce(p_dados, '{}'));
$$;

-- Os dois eventos que só o app conhece (o envio e a confirmação do código).
-- Funciona sem login (login de quem já tem conta).
create function public.registrar_evento_codigo(p_tipo text, p_fluxo text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_tipo not in ('email_code_sent', 'email_code_verified') or p_fluxo not in ('conversao', 'login', 'migracao') then
    return;
  end if;
  perform public.evento_visitante(p_tipo, auth.uid(), jsonb_build_object('fluxo', p_fluxo));
end;
$$;

-- ---------------------------------------------------------------------------
-- Username (seção 5)
-- ---------------------------------------------------------------------------
-- tipo: reservado (nome exato, ignorando números, ponto e sublinhado),
-- reservado_parte (em qualquer lugar), proibido (em qualquer lugar),
-- proibido_exato (palavra curta: só o nome inteiro, para não barrar "cuidado").
create table public.usernames_bloqueados (
  palavra text primary key,
  tipo text not null check (tipo in ('reservado', 'reservado_parte', 'proibido', 'proibido_exato'))
);
alter table public.usernames_bloqueados enable row level security;
revoke all on public.usernames_bloqueados from anon, authenticated;
grant all on public.usernames_bloqueados to service_role;

insert into public.usernames_bloqueados (palavra, tipo) values
  ('admin', 'reservado_parte'), ('hivebreak', 'reservado_parte'), ('suporte', 'reservado_parte'),
  ('oficial', 'reservado_parte'), ('moderador', 'reservado_parte'), ('tavarescoach', 'reservado_parte'),
  ('administrador', 'reservado'), ('hive', 'reservado'), ('luan', 'reservado'), ('tavares', 'reservado'),
  ('root', 'reservado'), ('sistema', 'reservado'), ('equipe', 'reservado'), ('staff', 'reservado'),
  ('ajuda', 'reservado'), ('contato', 'reservado'), ('treinador', 'reservado'), ('coach', 'reservado'),
  ('null', 'reservado'), ('undefined', 'reservado'), ('anonimo', 'reservado'), ('visitante', 'reservado'),
  ('porra', 'proibido'), ('caralho', 'proibido'), ('merda', 'proibido'), ('buceta', 'proibido'),
  ('viado', 'proibido'), ('bosta', 'proibido'), ('foda', 'proibido'), ('cacete', 'proibido'),
  ('piroca', 'proibido'), ('xoxota', 'proibido'), ('arrombad', 'proibido'), ('otario', 'proibido'),
  ('vagabund', 'proibido'), ('babaca', 'proibido'), ('retardad', 'proibido'), ('nazista', 'proibido'),
  ('hitler', 'proibido'), ('estupr', 'proibido'), ('pedofil', 'proibido'), ('punheta', 'proibido'),
  ('putaria', 'proibido'), ('filhodaputa', 'proibido'), ('vadia', 'proibido'), ('macaco', 'proibido'),
  ('puta', 'proibido_exato'), ('puto', 'proibido_exato'), ('cu', 'proibido_exato'), ('pau', 'proibido_exato'),
  ('rola', 'proibido_exato'), ('corno', 'proibido_exato'), ('fdp', 'proibido_exato'), ('vsf', 'proibido_exato'),
  ('pqp', 'proibido_exato'), ('tnc', 'proibido_exato');

-- Motivo para recusar um username, ou null se ele pode ser usado.
-- formato | reservado | proibido | em_uso
create function public.username_motivo(p_username text, p_dono uuid default null) returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v text := lower(btrim(coalesce(p_username, '')));
  v_letras text;
  v_nucleo text;
begin
  if v !~ '^[a-z0-9._]{3,20}$' then
    return 'formato';
  end if;
  v_letras := regexp_replace(v, '[._]', '', 'g');
  v_nucleo := regexp_replace(v, '[._0-9]', '', 'g');
  if exists (select 1 from public.usernames_bloqueados b
             where (b.tipo = 'proibido' and v_letras like '%' || b.palavra || '%')
                or (b.tipo = 'proibido_exato' and (v_nucleo = b.palavra or v_letras = b.palavra))) then
    return 'proibido';
  end if;
  if exists (select 1 from public.usernames_bloqueados b
             where (b.tipo = 'reservado' and v_nucleo = b.palavra)
                or (b.tipo = 'reservado_parte' and v_letras like '%' || b.palavra || '%')) then
    return 'reservado';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v and id is distinct from p_dono) then
    return 'em_uso';
  end if;
  return null;
end;
$$;

-- Até 3 sugestões livres a partir do nome pedido (joana → joana.break, joana_23).
create function public.username_sugestoes(p_username text) returns text[]
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_base text := left(regexp_replace(lower(btrim(coalesce(p_username, ''))), '[^a-z0-9._]', '', 'g'), 14);
  v_candidatos text[];
  v_saida text[] := '{}';
  c text;
  n integer;
begin
  v_base := regexp_replace(v_base, '[._]+$', '');
  if length(v_base) < 2 then
    return v_saida;
  end if;
  v_candidatos := array[v_base || '.break', v_base || '_hb', v_base || '.fit', v_base || '.hive'];
  for i in 1..6 loop
    n := 10 + floor(random() * 90)::int;
    v_candidatos := v_candidatos || (v_base || '_' || n) || (v_base || '.' || n);
  end loop;
  foreach c in array v_candidatos loop
    exit when array_length(v_saida, 1) >= 3;
    if public.username_motivo(c) is null and not c = any (v_saida) then
      v_saida := v_saida || c;
    end if;
  end loop;
  return v_saida;
end;
$$;

-- Checagem ao digitar (funciona sem login): { ok, motivo, sugestoes }.
create function public.username_verificar(p_username text) returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_motivo text := public.username_motivo(p_username, auth.uid());
begin
  return jsonb_build_object(
    'ok', v_motivo is null,
    'motivo', v_motivo,
    'sugestoes', case when v_motivo in ('em_uso', 'reservado') then to_jsonb(public.username_sugestoes(p_username)) else '[]'::jsonb end);
end;
$$;

-- Troca depois do cadastro: no máximo 1 vez a cada 30 dias. Devolve o motivo
-- da recusa (formato, reservado, proibido, em_uso, espera) ou null se trocou.
create function public.trocar_username(p_username text) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  v text := lower(btrim(coalesce(p_username, '')));
  v_motivo text;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user for update;
  if p.username = v then
    return null;
  end if;
  if p.username is not null and p.username_trocado_em > now() - interval '30 days' then
    return 'espera';
  end if;
  v_motivo := public.username_motivo(v, v_user);
  if v_motivo is not null then
    return v_motivo;
  end if;
  update public.profiles
  set username = v,
      username_trocado_em = case when p.username is null then p.username_trocado_em else now() end,
      apelido = coalesce(apelido, v)
  where id = v_user;
  if p.username is null then
    perform public.evento_visitante('username_created', v_user, jsonb_build_object('visitante', p.visitante));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conta nova: visitante não ganha preferências de aviso (= sem lembretes)
-- ---------------------------------------------------------------------------
create or replace function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_visitante boolean := coalesce(new.is_anonymous, false);
begin
  insert into public.profiles (id, nome, avatar_url, codigo_convite, visitante)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    public.gerar_codigo_convite(),
    v_visitante
  );
  insert into public.streaks (user_id) values (new.id);
  if not v_visitante then
    insert into public.notification_preferences (user_id) values (new.id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Declaração de saúde (seção 4, com a decisão do Luan de 18/11/2026)
-- ---------------------------------------------------------------------------
-- p_todas_nao: declarou que responde NÃO a todas as perguntas.
-- p_ciente: confirmou o termo de responsabilidade (obrigatório).
-- Devolve true quando liberou tudo, false quando ficou com restrição.
create function public.registrar_declaracao_saude(p_todas_nao boolean, p_ciente boolean, p_versao text) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_todas_nao is null or p_ciente is not true or coalesce(p_versao, '') !~ '^[A-Za-z0-9._-]{1,20}$' then
    raise exception 'declaracao_invalida' using errcode = '22023';
  end if;

  insert into public.health_screenings (user_id, respostas, algum_sim)
  values (v_user, jsonb_build_object('modelo', 'declaracao', 'versao', p_versao, 'todas_nao', p_todas_nao,
                                     'ciente_responsabilidade', true), not p_todas_nao);

  update public.profiles
  set triagem_respondida_em = now(),
      triagem_restricao = not p_todas_nao,
      liberado_alta_intensidade = p_todas_nao,
      liberacao_declarada_em = null,
      dificuldade_atual = case when p_todas_nao then dificuldade_atual else least(dificuldade_atual, 3) end
  where id = v_user;

  perform public.evento_visitante('screening_done', v_user, jsonb_build_object('restricao', not p_todas_nao));
  return p_todas_nao;
end;
$$;

-- "Meu médico me liberou": também tira a restrição da declaração.
create or replace function public.declarar_liberacao_medica() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.health_screenings where user_id = v_user) then
    raise exception 'triagem_pendente' using errcode = '22023';
  end if;
  update public.profiles
  set liberado_alta_intensidade = true, liberacao_declarada_em = now(), triagem_restricao = false
  where id = v_user;
end;
$$;

-- Com restrição da declaração, só respiração e mobilidade de baixa intensidade
-- (decisão do Luan: "alongamento leve" = mobilidade baixa). Sem restrição,
-- vale a regra antiga (baixa intensidade até a liberação).
create or replace function public.trilha_estados(p_user uuid)
returns table (challenge_id text, level_id smallint, unit_id text, ordem smallint, seq integer, estado text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with base as (
    select c.id, c.level_id, c.unit_id, c.ordem,
           row_number() over (partition by c.level_id order by u.ordem, c.ordem)::int as seq,
           (p.concluido_em is not null) as feito,
           case
             when pf.triagem_restricao then c.modalidade = 'respiracao' or (c.modalidade = 'mobilidade' and c.intensidade = 'baixa')
             else pf.liberado_alta_intensidade or c.intensidade = 'baixa'
           end as permitido,
           coalesce(lp.liberado, false) as secao_liberada
    from public.challenges c
    join public.units u on u.id = c.unit_id
    cross join (select liberado_alta_intensidade, triagem_restricao from public.profiles where id = p_user) pf
    left join public.user_challenge_progress p on p.user_id = p_user and p.challenge_id = c.id
    left join public.user_level_progress lp on lp.user_id = p_user and lp.level_id = c.level_id
  ),
  marcado as (
    select *,
           coalesce(bool_or(permitido and not feito) over (
             partition by level_id order by seq rows between unbounded preceding and 1 preceding
           ), false) as pendente_antes
    from base
  )
  select id, level_id, unit_id, ordem, seq,
         case
           when feito then 'concluido'
           when not permitido then 'travado'
           when secao_liberada and not pendente_antes then 'disponivel'
           else 'bloqueado'
         end
  from marcado;
$$;

-- ---------------------------------------------------------------------------
-- Começar como visitante (passo 2)
-- ---------------------------------------------------------------------------
-- Chamada logo depois do signInAnonymously. Grava o username, os aceites
-- ("Tenho 18 anos ou mais e aceito os termos"), quem convidou e libera a
-- Seção 1. A declaração de saúde vem em seguida (registrar_declaracao_saude).
create function public.criar_visitante(
  p_username text, p_maior_idade boolean, p_versao_termos text,
  p_ref text default null, p_familia text default null, p_gancho_id text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  v_motivo text;
  v_ref text := upper(btrim(coalesce(p_ref, '')));
  v_quem_convidou uuid;
  v_novo boolean;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user for update;
  if p.id is null or not p.visitante then
    raise exception 'nao_visitante' using errcode = '22023';
  end if;
  if p_maior_idade is not true or coalesce(p_versao_termos, '') !~ '^[A-Za-z0-9._-]{1,20}$' then
    raise exception 'termos' using errcode = '22023';
  end if;
  v_novo := p.username is null;

  if v_novo then
    v_motivo := public.username_motivo(p_username, v_user);
    if v_motivo is not null then
      return jsonb_build_object('ok', false, 'motivo', v_motivo,
        'sugestoes', case when v_motivo in ('em_uso', 'reservado') then to_jsonb(public.username_sugestoes(p_username)) else '[]'::jsonb end);
    end if;
    update public.profiles set username = lower(btrim(p_username)), apelido = coalesce(apelido, lower(btrim(p_username)))
    where id = v_user;
  end if;

  insert into public.consents (user_id, tipo, versao)
  select v_user, t, p_versao_termos from unnest(array['termos', 'privacidade', 'dados_saude']) t
  where not exists (select 1 from public.consents c where c.user_id = v_user and c.tipo = t);

  insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, 1, true)
  on conflict (user_id, level_id) do update set liberado = true;

  -- Quem convidou: guardado agora, creditado só na confirmação + 1º desafio.
  if v_ref ~ '^[A-HJ-NP-Z2-9]{6}$' and p.convidado_por is null then
    select id into v_quem_convidou from public.profiles where codigo_convite = v_ref and not visitante;
    if v_quem_convidou is not null and v_quem_convidou <> v_user then
      update public.profiles set ref_convite = v_ref, convidado_por = v_quem_convidou where id = v_user;
      insert into public.invites (inviter_id, invitee_id, familia, gancho_id)
      values (v_quem_convidou, v_user,
              case when p_familia in ('D', 'B', 'C') and p_gancho_id ~ '^[DBC][0-9]{2}$' then p_familia end,
              case when p_familia in ('D', 'B', 'C') and p_gancho_id ~ '^[DBC][0-9]{2}$' then p_gancho_id end)
      on conflict (invitee_id) do nothing;
    end if;
  end if;

  if v_novo then
    perform public.evento_visitante('visitor_started', v_user, jsonb_build_object('ref', nullif(v_ref, '')));
    perform public.evento_visitante('username_created', v_user, jsonb_build_object('visitante', true));
  end if;
  return jsonb_build_object('ok', true, 'motivo', null, 'sugestoes', '[]'::jsonb);
end;
$$;

-- Quem pode jogar e entrar em hive: cadastro completo, ou visitante com a
-- declaração de saúde feita. (Usada pelas funções da hive e do bônus.)
create or replace function public.exigir_cadastro() returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user
                 and (onboarding_concluido_em is not null or (visitante and triagem_respondida_em is not null))) then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  return v_user;
end;
$$;

-- O visitante aparece na hive com o username.
create or replace view public.perfis_publicos with (security_invoker = false) as
  select id, apelido, avatar_url, divisao_atual, nivel_atual
  from public.profiles
  where onboarding_concluido_em is not null or (visitante and username is not null);

-- ---------------------------------------------------------------------------
-- finalizar_desafio: igual à da migração da hive, liberada para o visitante
-- ---------------------------------------------------------------------------
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
  -- Visitante (docs/VISITANTE.md) joga antes do cadastro, depois da declaração de saúde.
  if p.onboarding_concluido_em is null and not (p.visitante and p.triagem_respondida_em is not null) then
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

-- ---------------------------------------------------------------------------
-- Liga: pontos do visitante ficam pendentes
-- ---------------------------------------------------------------------------
create or replace function public.pontuar_liga() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_liga uuid;
begin
  -- Visitante: o XP fica em xp_events e entra na liga na confirmação (liga_lancar_pendentes).
  if exists (select 1 from public.profiles where id = new.user_id and visitante) then
    return null;
  end if;
  if not public.liga_xp_vale(new.user_id, new.tipo, new.valor, new.attempt_id, new.criado_em) then
    return null;
  end if;
  if new.attempt_id is not null then
    update public.challenge_attempts set valido_para_liga = true where id = new.attempt_id and not valido_para_liga;
  end if;
  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;
  v_liga := public.liga_garantir_membro(new.user_id);
  update public.league_members
  set pontos = pontos + new.valor, pontos_em = now()
  where league_id = v_liga and user_id = new.user_id;
  return null;
end;
$$;

-- Lança na liga desta semana o XP que ficou pendente. p_ids limita aos eventos
-- dados (na migração para uma conta existente, só os que vieram do visitante).
create function public.liga_lancar_pendentes(p_user uuid, p_ids bigint[] default null) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_desde timestamptz := public.liga_semana_inicio()::timestamp at time zone 'America/Sao_Paulo';
  e record;
  v_liga uuid;
  v_total integer := 0;
begin
  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;
  for e in
    select x.* from public.xp_events x
    where x.user_id = p_user and x.criado_em >= v_desde
      and (p_ids is null or x.id = any (p_ids))
      and public.liga_xp_vale(x.user_id, x.tipo, x.valor, x.attempt_id, x.criado_em)
    order by x.criado_em, x.id
  loop
    v_liga := coalesce(v_liga, public.liga_garantir_membro(p_user));
    update public.league_members set pontos = pontos + e.valor, pontos_em = e.criado_em
    where league_id = v_liga and user_id = p_user;
    if e.attempt_id is not null then
      update public.challenge_attempts set valido_para_liga = true where id = e.attempt_id;
    end if;
    v_total := v_total + e.valor;
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convite: visitante não convida com recompensa e só ativa depois de confirmar
-- ---------------------------------------------------------------------------
create or replace function public.registrar_convite(p_codigo text) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_quem_convidou uuid;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select id into v_quem_convidou from public.profiles where codigo_convite = upper(btrim(p_codigo)) and not visitante;
  if v_quem_convidou is null or v_quem_convidou = v_user then
    return false;
  end if;

  update public.profiles
  set convidado_por = v_quem_convidou, ref_convite = upper(btrim(p_codigo))
  where id = v_user
    and convidado_por is null
    and onboarding_concluido_em is null
    and criado_em > now() - interval '7 days';
  if not found then
    return false;
  end if;

  insert into public.invites (inviter_id, invitee_id) values (v_quem_convidou, v_user)
  on conflict (invitee_id) do nothing;
  return true;
end;
$$;

create or replace function public.convite_publico(p_codigo text)
returns table (apelido text, avatar_url text, ofensiva integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(p.apelido, split_part(p.nome, ' ', 1), 'Alguém'), p.avatar_url, coalesce(s.atual, 0)
  from public.profiles p
  left join public.streaks s on s.user_id = p.id
  where p.codigo_convite = upper(btrim(p_codigo)) and not p.visitante;
$$;

-- O desafio que quem convidou fez por último (e o placar), para a tela do convite.
-- Sem login: só título, duração e números.
create function public.convite_desafio(p_codigo text)
returns table (challenge_id text, titulo text, modalidade text, intensidade text, duracao_s integer, reps integer, tempo_valido_s numeric, estrelas smallint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id, c.titulo, c.modalidade, c.intensidade, c.duracao_s,
         (select coalesce(sum(b.reps_validas), 0)::int from public.attempt_blocks b where b.attempt_id = a.id),
         (select coalesce(sum(b.tempo_valido_s), 0) from public.attempt_blocks b where b.attempt_id = a.id),
         a.estrelas
  from public.profiles p
  join lateral (
    select * from public.challenge_attempts x
    where x.user_id = p.id and x.status = 'concluido'
    order by x.concluido_em desc limit 1
  ) a on true
  join public.challenges c on c.id = a.challenge_id
  where p.codigo_convite = upper(btrim(p_codigo)) and not p.visitante;
$$;

create or replace function public.ativar_convite_gatilho() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    if exists (select 1 from public.profiles where id = new.user_id and visitante) then
      -- Fica para a confirmação do e-mail (converter_visitante).
      perform public.evento_visitante('visitor_challenge_completed', new.user_id,
        jsonb_build_object('challenge_id', new.challenge_id, 'modo', new.modo));
      return null;
    end if;
    perform public.ativar_convite(new.user_id, coalesce(new.concluido_em, now()));
  end if;
  return null;
end;
$$;

-- Visitante não liga o push (ele só recebe lembretes depois de confirmar).
create or replace function public.salvar_push(p_endpoint text, p_chaves jsonb, p_aparelho text default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_user and visitante) then
    raise exception 'visitante' using errcode = '22023';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or jsonb_typeof(p_chaves) <> 'object'
     or not (p_chaves ? 'p256dh' and p_chaves ? 'auth') then
    raise exception 'inscricao_invalida' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, chaves, aparelho, ativo)
  values (v_user, p_endpoint, p_chaves, left(p_aparelho, 120), true)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, chaves = excluded.chaves, aparelho = excluded.aparelho, ativo = true;
  update public.notification_preferences set push_ativo = true where user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversão: o visitante confirmou o e-mail (passo 5)
-- ---------------------------------------------------------------------------
create function public.converter_visitante(p_user uuid) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles;
  i public.invites;
  v_pontos integer := 0;
begin
  select * into p from public.profiles where id = p_user for update;
  if p.id is null or not p.visitante then
    return false;
  end if;
  update public.profiles set visitante = false where id = p_user;
  insert into public.notification_preferences (user_id) values (p_user) on conflict (user_id) do nothing;

  begin
    v_pontos := public.liga_lancar_pendentes(p_user);
  exception when others then
    -- A liga nunca trava a confirmação: o XP entra quando a pessoa abrir a Liga.
    raise warning 'liga: pendentes de % não lançados (%)', p_user, sqlerrm;
  end;

  select * into i from public.invites where invitee_id = p_user;
  if i.id is not null then
    -- Convite ativado = e-mail confirmado + 1º desafio concluído.
    if exists (select 1 from public.challenge_attempts where user_id = p_user and status = 'concluido') then
      perform public.ativar_convite(p_user, now());
    end if;
    -- Funil do gancho: o "cadastro" é a confirmação do e-mail (vem depois do desafio).
    if i.familia is not null then
      insert into public.convite_eventos (tipo, familia, gancho_id, ref, user_id, invite_id)
      select 'cadastro', i.familia, i.gancho_id, pr.codigo_convite, p_user, i.id
      from public.profiles pr where pr.id = i.inviter_id;
    end if;
  end if;

  perform public.evento_visitante('visitor_converted', p_user,
    jsonb_build_object('pontos_liga', v_pontos, 'ref', p.ref_convite,
                       'desafios', (select count(*) from public.challenge_attempts where user_id = p_user and status = 'concluido')));
  return true;
end;
$$;

-- O Auth grava o e-mail do anônimo quando o código de troca de e-mail é confirmado.
create function public.ao_confirmar_email() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is not null and not coalesce(new.is_anonymous, false) then
    perform public.converter_visitante(new.id);
  end if;
  return null;
end;
$$;

create trigger ao_confirmar_email after update of email, is_anonymous on auth.users
for each row execute function public.ao_confirmar_email();

-- Reforço chamado pelo app logo depois do verifyOtp (idempotente).
create function public.confirmar_visitante() returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users where id = v_user and email is not null and not coalesce(is_anonymous, false)) then
    return false;
  end if;
  perform public.converter_visitante(v_user);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- E-mail que já tem conta: login + migração do resultado (seção 2)
-- ---------------------------------------------------------------------------
create table public.visitante_migracoes (
  token_hash text primary key,
  anon_id uuid not null references public.profiles (id) on delete cascade,
  expira_em timestamptz not null default now() + interval '1 day'
);
alter table public.visitante_migracoes enable row level security;
revoke all on public.visitante_migracoes from anon, authenticated;
grant all on public.visitante_migracoes to service_role;

-- O visitante, ainda logado, pede um token (guardado num cookie httpOnly).
create function public.preparar_migracao_visitante() returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user and visitante) then
    raise exception 'nao_visitante' using errcode = '22023';
  end if;
  delete from public.visitante_migracoes where anon_id = v_user;
  insert into public.visitante_migracoes (token_hash, anon_id)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user);
  return v_token;
end;
$$;

-- Leva o que o visitante fez para a conta existente e apaga o visitante.
-- O username de visitante é descartado.
create function public.migrar_visitante(p_anon uuid, p_conta uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a public.profiles;
  sa public.streaks;
  sc public.streaks;
  v_ids bigint[];
  v_desafios integer;
  v_pontos integer := 0;
begin
  select * into a from public.profiles where id = p_anon for update;
  if a.id is null or not a.visitante or p_anon = p_conta then
    return jsonb_build_object('ok', false, 'desafios', 0);
  end if;
  if not exists (select 1 from public.profiles where id = p_conta and not visitante) then
    return jsonb_build_object('ok', false, 'desafios', 0);
  end if;

  select count(*) into v_desafios from public.challenge_attempts where user_id = p_anon and status = 'concluido';
  select array_agg(id) into v_ids from public.xp_events where user_id = p_anon;

  update public.challenge_attempts set user_id = p_conta where user_id = p_anon;
  update public.xp_events set user_id = p_conta where user_id = p_anon;
  update public.pain_reports set user_id = p_conta where user_id = p_anon;

  insert into public.user_challenge_progress as u (user_id, challenge_id, liberado, melhor_score, melhores_estrelas, tentativas)
  select p_conta, challenge_id, liberado, melhor_score, melhores_estrelas, tentativas
  from public.user_challenge_progress where user_id = p_anon
  on conflict (user_id, challenge_id) do update
  set liberado = u.liberado or excluded.liberado,
      melhor_score = greatest(u.melhor_score, excluded.melhor_score),
      melhores_estrelas = greatest(u.melhores_estrelas, excluded.melhores_estrelas),
      tentativas = u.tentativas + excluded.tentativas;

  update public.hive_participantes hp set user_id = p_conta
  where hp.user_id = p_anon
    and not exists (select 1 from public.hive_participantes x where x.hive_id = hp.hive_id and x.user_id = p_conta);

  -- Ofensiva: os dias do visitante entram na conta.
  insert into public.streak_days (user_id, dia, tipo)
  select p_conta, dia, tipo from public.streak_days where user_id = p_anon
  on conflict (user_id, dia) do nothing;
  select * into sa from public.streaks where user_id = p_anon;
  select * into sc from public.streaks where user_id = p_conta for update;
  if sa.ultimo_dia_ativo is not null and (sc.ultimo_dia_ativo is null or sc.ultimo_dia_ativo < sa.ultimo_dia_ativo) then
    update public.streaks
    set atual = case when sc.ultimo_dia_ativo = sa.ultimo_dia_ativo - 1 then sc.atual + 1 else greatest(sa.atual, 1) end,
        ultimo_dia_ativo = sa.ultimo_dia_ativo
    where user_id = p_conta;
    update public.streaks set recorde = greatest(recorde, atual) where user_id = p_conta;
  end if;

  if v_ids is not null then
    begin
      v_pontos := public.liga_lancar_pendentes(p_conta, v_ids);
    exception when others then
      raise warning 'liga: migração de % sem pontos (%)', p_anon, sqlerrm;
    end;
  end if;

  perform public.evento_visitante('visitor_converted', p_anon,
    jsonb_build_object('migrado_para', p_conta, 'desafios', v_desafios, 'pontos_liga', v_pontos, 'ref', a.ref_convite));
  delete from auth.users where id = p_anon;
  return jsonb_build_object('ok', true, 'desafios', v_desafios);
end;
$$;

-- Chamada já logado na conta existente, com o token do cookie.
create function public.migrar_visitante_por_token(p_token text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_anon uuid;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  delete from public.visitante_migracoes
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and expira_em > now()
  returning anon_id into v_anon;
  if v_anon is null then
    return jsonb_build_object('ok', false, 'desafios', 0);
  end if;
  return public.migrar_visitante(v_anon, v_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rotina diária: visitante não confirmado some depois de 7 dias
-- ---------------------------------------------------------------------------
create function public.limpar_visitantes() returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select p.id, p.criado_em,
           (select count(*) from public.challenge_attempts a where a.user_id = p.id and a.status = 'concluido') as desafios
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.visitante and coalesce(u.is_anonymous, true) and p.criado_em < now() - interval '7 days'
  loop
    perform public.evento_visitante('visitor_expired', r.id, jsonb_build_object('desafios', r.desafios, 'criado_em', r.criado_em));
    delete from auth.users where id = r.id;
    v_n := v_n + 1;
  end loop;
  delete from public.visitante_migracoes where expira_em < now();
  delete from public.codigo_email_tentativas where atualizado_em < now() - interval '1 day';
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Código por e-mail (seção 6): reenvio depois de 60 s e no máximo 5 erros
-- ---------------------------------------------------------------------------
-- O Supabase cuida da validade (Email OTP expiration) e manda o código. Aqui
-- o app guarda o intervalo de reenvio e as tentativas erradas. O e-mail fica
-- só como hash.
create table public.codigo_email_tentativas (
  email_hash text primary key,
  enviado_em timestamptz not null,
  erros smallint not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.codigo_email_tentativas enable row level security;
revoke all on public.codigo_email_tentativas from anon, authenticated;
grant all on public.codigo_email_tentativas to service_role;

create function public.codigo_hash(p_email text) returns text
language sql immutable
set search_path = public, pg_temp
as $$ select encode(extensions.digest(lower(btrim(coalesce(p_email, ''))), 'sha256'), 'hex') $$;

-- Pode mandar agora? Se sim, já marca o envio e zera os erros.
-- { ok, espera_s }
create function public.codigo_pode_enviar(p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := public.codigo_hash(p_email);
  v_enviado timestamptz;
begin
  select enviado_em into v_enviado from public.codigo_email_tentativas where email_hash = v_hash for update;
  if v_enviado is not null and v_enviado > now() - interval '60 seconds' then
    return jsonb_build_object('ok', false, 'espera_s', ceil(60 - extract(epoch from now() - v_enviado))::int);
  end if;
  insert into public.codigo_email_tentativas (email_hash, enviado_em, erros, atualizado_em)
  values (v_hash, now(), 0, now())
  on conflict (email_hash) do update set enviado_em = now(), erros = 0, atualizado_em = now();
  return jsonb_build_object('ok', true, 'espera_s', 60);
end;
$$;

-- Tentativas que ainda restam para o código atual (0 = pedir outro).
create function public.codigo_restantes(p_email text) returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  select greatest(0, 5 - coalesce((select erros from public.codigo_email_tentativas where email_hash = public.codigo_hash(p_email)), 0))::int
$$;

-- Conta um erro e devolve quantas tentativas restam.
create function public.codigo_erro(p_email text) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_erros integer;
begin
  update public.codigo_email_tentativas set erros = least(erros + 1, 5), atualizado_em = now()
  where email_hash = public.codigo_hash(p_email)
  returning erros into v_erros;
  return greatest(0, 5 - coalesce(v_erros, 1));
end;
$$;

-- Código certo: apaga o registro.
create function public.codigo_ok(p_email text) returns void
language sql security definer
set search_path = public, pg_temp
as $$ delete from public.codigo_email_tentativas where email_hash = public.codigo_hash(p_email) $$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke execute on function
  public.evento_visitante(text, uuid, jsonb), public.registrar_evento_codigo(text, text),
  public.username_motivo(text, uuid), public.username_sugestoes(text), public.username_verificar(text), public.trocar_username(text),
  public.registrar_declaracao_saude(boolean, boolean, text), public.criar_visitante(text, boolean, text, text, text, text),
  public.liga_lancar_pendentes(uuid, bigint[]), public.convite_desafio(text),
  public.converter_visitante(uuid), public.ao_confirmar_email(), public.confirmar_visitante(),
  public.preparar_migracao_visitante(), public.migrar_visitante(uuid, uuid), public.migrar_visitante_por_token(text),
  public.limpar_visitantes(), public.codigo_hash(text), public.codigo_pode_enviar(text), public.codigo_restantes(text),
  public.codigo_erro(text), public.codigo_ok(text)
  from public, anon, authenticated;
grant execute on function public.username_verificar(text), public.registrar_evento_codigo(text, text),
  public.convite_desafio(text), public.codigo_pode_enviar(text), public.codigo_restantes(text),
  public.codigo_erro(text), public.codigo_ok(text)
  to anon, authenticated;
grant execute on function public.trocar_username(text), public.registrar_declaracao_saude(boolean, boolean, text),
  public.criar_visitante(text, boolean, text, text, text, text), public.confirmar_visitante(),
  public.preparar_migracao_visitante(), public.migrar_visitante_por_token(text)
  to authenticated;
grant execute on all functions in schema public to service_role;

-- Rotina diária (04:23 UTC).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hive-break-limpar-visitantes', '23 4 * * *', 'select public.limpar_visitantes()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível (%); rode select public.limpar_visitantes() uma vez por dia', sqlerrm;
end;
$$;
