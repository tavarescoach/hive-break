-- Hive Break · instalação inicial do banco (Fase 1).
-- GERADO por scripts/juntar-sql.mjs: não edite. Cole inteiro no SQL Editor do
-- Supabase, num projeto novo, e clique em Run. Só pode ser rodado uma vez.

begin;

-- >>> migrations/20261116000100_conteudo.sql
-- Hive Break · Conteúdo (seção 11.2 da especificação)
-- Lido por todos; só o servidor (service_role) escreve.

create table public.exercises (
  id text primary key,
  nome text not null,
  modalidade text not null,
  camera text not null check (camera in ('frontal', 'lateral')),
  definicao jsonb not null,
  equipamento text check (equipamento in ('tapete', 'cabo_vassoura')),
  demo_url text,
  variacao_facil_id text references public.exercises (id),
  ativo boolean not null default true
);
comment on table public.exercises is 'Catálogo de exercícios. A coluna definicao alimenta o motor de detecção (seção 8.2).';

create table public.levels (
  id smallint primary key,
  ordem smallint not null unique,
  tema text not null,
  equipamentos_necessarios text[] not null default '{}',
  -- Nível em que o aviso antecipado deste equipamento começa a aparecer.
  avisar_no_nivel smallint
);

create table public.challenges (
  id text primary key,
  level_id smallint not null references public.levels (id) on delete cascade,
  ordem smallint not null,
  titulo text not null,
  modalidade text not null,
  duracao_s integer not null check (duracao_s between 30 and 300),
  intensidade text not null check (intensidade in ('baixa', 'media', 'alta')),
  equipamento text check (equipamento in ('tapete', 'cabo_vassoura')),
  opcional_em_8 boolean not null default false,
  extra_em_12 boolean not null default false,
  unique (level_id, ordem)
);

create table public.challenge_blocks (
  id text primary key,
  challenge_id text not null references public.challenges (id) on delete cascade,
  ordem smallint not null,
  exercise_id text not null references public.exercises (id),
  formato text not null check (
    formato in ('repeticoes', 'amrap', 'intervalado', 'isometria', 'mobilidade', 'postura', 'equilibrio', 'precisao', 'respiracao')
  ),
  series smallint not null default 1 check (series between 1 and 20),
  parametros_por_dificuldade jsonb not null default '{}',
  descanso_s integer not null default 0 check (descanso_s between 0 and 300),
  unique (challenge_id, ordem)
);

create table public.music_tracks (
  id text primary key,
  estilo text not null check (estilo in ('eletronica', 'lofi', 'batida')),
  titulo text not null,
  url text not null,
  bpm smallint not null check (bpm between 60 and 200),
  duracao_s integer not null,
  -- Seção 12.6: só entram faixas com licença registrada.
  licenca text not null,
  fonte text not null,
  licenca_registrada_em date not null,
  comprovante_url text,
  ativo boolean not null default true
);

create table public.notification_templates (
  id text primary key,
  gatilho text not null,
  canal text not null check (canal in ('push', 'email', 'app')),
  variacao smallint not null,
  titulo text,
  texto text not null,
  ativo boolean not null default true,
  unique (gatilho, canal, variacao)
);

-- >>> migrations/20261116000200_usuario.sql
-- Hive Break · Usuário (seção 11.1)
-- Altura, peso, triagem, linha de base e relatos de dor são dados de saúde:
-- só o dono lê (ver a migração de RLS).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  avatar_url text,
  apelido text check (char_length(apelido) between 3 and 20),
  data_nascimento date check (data_nascimento > date '1900-01-01'),
  sexo text check (sexo in ('feminino', 'masculino', 'nao_informado')),
  altura_cm smallint check (altura_cm between 120 and 230),
  peso_kg numeric(5, 1) check (peso_kg between 30 and 250),
  objetivo text check (objetivo in ('emagrecer', 'forca', 'mobilidade', 'condicionamento', 'saude_geral')),
  nivel_atividade text check (nivel_atividade in ('sedentario', 'pouco_ativo', 'ativo')),
  dias_semana smallint check (dias_semana between 2 and 7),
  meta_desafios_dia smallint check (meta_desafios_dia between 1 and 3),
  -- null = ainda não respondeu; vazio = nenhum equipamento.
  equipamentos text[] check (equipamentos <@ array['tapete', 'cabo_vassoura']),
  musica_estilo text check (musica_estilo in ('eletronica', 'lofi', 'batida', 'sem_musica')),
  volume_musica smallint not null default 60 check (volume_musica between 0 and 100),
  volume_voz smallint not null default 100 check (volume_voz between 0 and 100),
  horario_lembrete time,
  fuso_horario text not null default 'America/Sao_Paulo',
  limitacoes text[] not null default '{}' check (limitacoes <@ array['joelho', 'ombro', 'lombar', 'punho']),
  -- Campos calculados: só funções do servidor alteram.
  dificuldade_atual smallint not null default 1 check (dificuldade_atual between 1 and 10),
  liberado_alta_intensidade boolean not null default false,
  liberacao_declarada_em timestamptz,
  divisao_atual text not null default 'bronze' check (divisao_atual in ('bronze', 'prata', 'ouro', 'safira', 'diamante')),
  nivel_atual smallint not null default 1 references public.levels (id),
  codigo_convite text not null unique check (codigo_convite ~ '^[A-HJ-NP-Z2-9]{6}$'),
  convidado_por uuid references public.profiles (id) on delete set null,
  onboarding_concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Idade mínima de 18 anos (seção 2). Gatilho, e não CHECK, porque depende da data de hoje.
create function public.validar_perfil() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.data_nascimento is not null and new.data_nascimento > (current_date - interval '18 years')::date then
    raise exception 'idade_minima' using errcode = 'check_violation', hint = 'O Hive Break é para maiores de 18 anos.';
  end if;
  if new.apelido is not null then
    new.apelido := btrim(new.apelido);
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger profiles_validar before insert or update on public.profiles
for each row execute function public.validar_perfil();

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('termos', 'privacidade', 'dados_saude')),
  versao text not null,
  aceito_em timestamptz not null default now()
);
comment on table public.consents is 'Histórico de aceites (LGPD). Nunca é sobrescrito: só recebe linhas novas.';
create index consents_user_idx on public.consents (user_id, tipo, aceito_em desc);

create table public.health_screenings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  respostas jsonb not null,
  algum_sim boolean not null,
  realizado_em timestamptz not null default now()
);
create index health_screenings_user_idx on public.health_screenings (user_id, realizado_em desc);

create table public.baselines (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  realizado_em timestamptz not null default now(),
  agachamentos_40s smallint,
  polichinelos_30s smallint,
  apoio_unipodal_e_s numeric(4, 1),
  apoio_unipodal_d_s numeric(4, 1),
  amplitude_ombro_graus numeric(4, 1),
  dificuldade_resultante smallint check (dificuldade_resultante between 1 and 10)
);
create index baselines_user_idx on public.baselines (user_id, realizado_em desc);

create table public.pain_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid,
  exercise_id text references public.exercises (id),
  regiao text not null check (regiao in ('joelho', 'ombro', 'lombar', 'punho', 'quadril', 'tornozelo', 'pescoco', 'outra')),
  acao_tomada text not null check (acao_tomada in ('trocou_exercicio', 'encerrou', 'continuou')),
  criado_em timestamptz not null default now()
);
create index pain_reports_user_idx on public.pain_reports (user_id, criado_em desc);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lembrete boolean not null default true,
  ofensiva boolean not null default true,
  amigos boolean not null default true,
  liga boolean not null default true,
  resumo_semanal boolean not null default true,
  email_ativo boolean not null default true,
  push_ativo boolean not null default true,
  -- Pausa de 7 dias da régua de avisos: só o servidor altera.
  pausado_ate timestamptz
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  chaves jsonb not null,
  aparelho text,
  criado_em timestamptz not null default now(),
  ativo boolean not null default true
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- >>> migrations/20261116000300_jogo.sql
-- Hive Break · Jogo (seção 11.3)
-- Estas tabelas só são escritas por funções do servidor (seção 11.4).
-- Nenhuma delas guarda imagem, vídeo ou pontos do corpo: só números.

create table public.level_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id smallint not null references public.levels (id),
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  desafios_concluidos smallint not null default 0,
  completa boolean not null default false
);
create index level_sessions_user_idx on public.level_sessions (user_id, iniciada_em desc);

create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null references public.challenges (id),
  level_session_id uuid references public.level_sessions (id) on delete set null,
  dificuldade smallint not null check (dificuldade between 1 and 10),
  modo text not null check (modo in ('camera', 'manual')),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'abandonado', 'encerrado_dor')),
  aquecimento_auto boolean not null default false,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  score numeric(5, 2) check (score between 0 and 100),
  estrelas smallint check (estrelas between 0 and 3),
  xp integer check (xp >= 0),
  esforco_percebido smallint check (esforco_percebido between 1 and 10),
  valido_para_liga boolean not null default false
);
create index challenge_attempts_user_idx on public.challenge_attempts (user_id, concluido_em desc);
create index challenge_attempts_challenge_idx on public.challenge_attempts (challenge_id);

alter table public.pain_reports
  add constraint pain_reports_attempt_fk foreign key (attempt_id) references public.challenge_attempts (id) on delete set null;

create table public.attempt_blocks (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.challenge_attempts (id) on delete cascade,
  challenge_block_id text not null references public.challenge_blocks (id),
  exercise_id text not null references public.exercises (id),
  serie smallint not null default 1,
  reps_validas integer not null default 0 check (reps_validas >= 0),
  reps_parciais integer not null default 0 check (reps_parciais >= 0),
  tempo_valido_s numeric(6, 1) not null default 0 check (tempo_valido_s >= 0),
  kpis jsonb not null default '{}',
  score_bloco numeric(5, 2) check (score_bloco between 0 and 100),
  fora_quadro_pct numeric(5, 2) not null default 0 check (fora_quadro_pct between 0 and 100),
  unique (attempt_id, challenge_block_id, serie)
);

create table public.user_challenge_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null references public.challenges (id) on delete cascade,
  liberado boolean not null default false,
  melhor_score numeric(5, 2),
  melhores_estrelas smallint not null default 0 check (melhores_estrelas between 0 and 3),
  tentativas integer not null default 0,
  primary key (user_id, challenge_id)
);

create table public.user_level_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id smallint not null references public.levels (id) on delete cascade,
  liberado boolean not null default false,
  concluido_em timestamptz,
  estrelas smallint not null default 0 check (estrelas between 0 and 3),
  primary key (user_id, level_id)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  valor integer not null,
  attempt_id uuid references public.challenge_attempts (id) on delete set null,
  criado_em timestamptz not null default now()
);
comment on table public.xp_events is 'Fonte da verdade do XP: o total é sempre a soma destes eventos.';
create index xp_events_user_idx on public.xp_events (user_id, criado_em desc);

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  atual integer not null default 0 check (atual >= 0),
  recorde integer not null default 0 check (recorde >= 0),
  ultimo_dia_ativo date,
  protetores smallint not null default 0 check (protetores between 0 and 4),
  meta_compromisso smallint check (meta_compromisso in (7, 14, 30)),
  recuperar_ate timestamptz,
  recuperacoes_no_mes smallint not null default 0,
  inicio_semana_perfeita date
);

create table public.streak_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('feito', 'protegido', 'recuperado')),
  primary key (user_id, dia)
);

-- Par único e sem direção: user_a é sempre o menor id.
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  origem text not null check (origem in ('convite', 'codigo')),
  criado_em timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b_idx on public.friendships (user_b);

create table public.friend_streaks (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  atual integer not null default 0,
  recorde integer not null default 0,
  ultimo_dia date,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.nudges (
  id bigint generated always as identity primary key,
  de_user uuid not null references public.profiles (id) on delete cascade,
  para_user uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  check (de_user <> para_user)
);
create index nudges_par_idx on public.nudges (de_user, para_user, criado_em desc);

create table public.invites (
  id bigint generated always as identity primary key,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  -- Cada pessoa só pode ter sido convidada por uma outra.
  invitee_id uuid not null unique references public.profiles (id) on delete cascade,
  canal text not null default 'link',
  cadastrado_em timestamptz not null default now(),
  ativado_em timestamptz,
  recompensado boolean not null default false,
  check (inviter_id <> invitee_id)
);
create index invites_inviter_idx on public.invites (inviter_id, cadastrado_em desc);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  divisao text not null check (divisao in ('bronze', 'prata', 'ouro', 'safira', 'diamante')),
  semana_inicio date not null,
  semana_fim date not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada'))
);
create index leagues_semana_idx on public.leagues (semana_inicio, divisao);

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pontos numeric(8, 2) not null default 0,
  posicao_final smallint,
  resultado text check (resultado in ('subiu', 'manteve', 'desceu')),
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);

create table public.achievements (
  id text primary key,
  nome text not null,
  descricao text not null,
  criterio jsonb not null default '{}'
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  conquistada_em timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  gatilho text not null,
  template_id text references public.notification_templates (id) on delete set null,
  canal text not null check (canal in ('push', 'email', 'app')),
  enviado_em timestamptz not null default now(),
  aberto_em timestamptz,
  desafio_em_2h boolean
);
create index notification_log_user_idx on public.notification_log (user_id, enviado_em desc);

-- >>> migrations/20261116000400_rls.sql
-- Hive Break · Segurança em nível de linha (RLS)
--
-- Regras:
--   * Conteúdo: qualquer pessoa lê; só o servidor escreve.
--   * Dados do usuário: só o dono lê. Dados de saúde (altura, peso, triagem,
--     linha de base, relatos de dor) nunca aparecem para outros, nem para amigos.
--   * Outros usuários enxergam só apelido, foto, divisão e nível, pela view
--     perfis_publicos.
--   * Jogo (score, XP, ofensiva, liga, convites): o cliente só lê. Quem escreve
--     são as funções do servidor.

-- Começa do zero: o Supabase concede tudo a anon/authenticated por padrão.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------ conteúdo
grant select on public.exercises, public.levels, public.challenges, public.challenge_blocks,
  public.music_tracks, public.notification_templates, public.achievements to anon, authenticated;

create policy "conteudo: todos leem" on public.exercises for select to anon, authenticated using (ativo);
create policy "conteudo: todos leem" on public.levels for select to anon, authenticated using (true);
create policy "conteudo: todos leem" on public.challenges for select to anon, authenticated using (true);
create policy "conteudo: todos leem" on public.challenge_blocks for select to anon, authenticated using (true);
create policy "conteudo: todos leem" on public.music_tracks for select to anon, authenticated using (ativo);
create policy "conteudo: todos leem" on public.notification_templates for select to anon, authenticated using (ativo);
create policy "conteudo: todos leem" on public.achievements for select to anon, authenticated using (true);

-- ------------------------------------------------------------------- usuário
grant select on public.profiles to authenticated;
-- O dono edita só os dados que ele mesmo informa. Dificuldade, liberação,
-- divisão, nível, código de convite e "convidado por" ficam de fora.
grant update (
  apelido, data_nascimento, sexo, altura_cm, peso_kg, objetivo, nivel_atividade, dias_semana,
  meta_desafios_dia, equipamentos, musica_estilo, volume_musica, volume_voz, horario_lembrete,
  fuso_horario, limitacoes
) on public.profiles to authenticated;

create policy "perfil: dono le" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "perfil: dono edita" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- O que os outros podem ver de alguém. A view roda com os direitos do dono
-- (ignora a RLS de profiles) e por isso expõe só estas cinco colunas.
create view public.perfis_publicos with (security_invoker = false) as
  select id, apelido, avatar_url, divisao_atual, nivel_atual
  from public.profiles
  where onboarding_concluido_em is not null;
grant select on public.perfis_publicos to authenticated;

grant select on public.consents to authenticated;
grant insert (user_id, tipo, versao) on public.consents to authenticated;
create policy "aceites: dono le" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "aceites: dono registra" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Sem política de update/delete: o histórico de aceites nunca é sobrescrito.

grant select on public.health_screenings, public.baselines to authenticated;
create policy "triagem: dono le" on public.health_screenings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "linha de base: dono le" on public.baselines for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.pain_reports to authenticated;
grant insert (user_id, attempt_id, exercise_id, regiao, acao_tomada) on public.pain_reports to authenticated;
create policy "dor: dono le" on public.pain_reports for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dor: dono registra" on public.pain_reports for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select on public.notification_preferences to authenticated;
grant update (lembrete, ofensiva, amigos, liga, resumo_semanal, email_ativo, push_ativo)
  on public.notification_preferences to authenticated;
create policy "avisos: dono le" on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "avisos: dono edita" on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, chaves, aparelho) on public.push_subscriptions to authenticated;
grant update (chaves, aparelho, ativo) on public.push_subscriptions to authenticated;
create policy "push: dono" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------- jogo
-- Só leitura para o cliente. Nenhum grant de escrita: quem grava é o servidor.
grant select on public.level_sessions, public.challenge_attempts, public.attempt_blocks,
  public.user_challenge_progress, public.user_level_progress, public.xp_events, public.streaks,
  public.streak_days, public.friendships, public.friend_streaks, public.nudges, public.invites,
  public.leagues, public.league_members, public.user_achievements, public.notification_log
  to authenticated;

create policy "sessoes: dono le" on public.level_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "tentativas: dono le" on public.challenge_attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "blocos: dono le" on public.attempt_blocks for select to authenticated
  using (exists (
    select 1 from public.challenge_attempts a
    where a.id = attempt_blocks.attempt_id and a.user_id = (select auth.uid())
  ));
create policy "progresso de desafio: dono le" on public.user_challenge_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "progresso de nivel: dono le" on public.user_level_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "xp: dono le" on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ofensiva: dono le" on public.streaks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "calendario: dono le" on public.streak_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy "amizades: os dois leem" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "ofensiva com amigo: os dois leem" on public.friend_streaks for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "cutucadas: os dois leem" on public.nudges for select to authenticated
  using ((select auth.uid()) in (de_user, para_user));
create policy "convites: os dois leem" on public.invites for select to authenticated
  using ((select auth.uid()) in (inviter_id, invitee_id));
create policy "conquistas: dono le" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
create policy "avisos enviados: dono le" on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));

-- Liga: visível para quem está no mesmo grupo. A função evita que a política
-- de league_members consulte a própria tabela (recursão).
create function public.minhas_ligas() returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select league_id from public.league_members where user_id = auth.uid();
$$;
grant execute on function public.minhas_ligas() to authenticated;

create policy "ligas: membros leem" on public.leagues for select to authenticated
  using (id in (select public.minhas_ligas()));
create policy "ranking: mesmo grupo le" on public.league_members for select to authenticated
  using (league_id in (select public.minhas_ligas()));

-- O servidor (service_role) faz tudo; ele já ignora a RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- >>> migrations/20261116000500_funcoes_fase1.sql
-- Hive Break · Funções do servidor da Fase 1 (cadastro, onboarding e convite)
-- Todas rodam como "security definer": validam e gravam os campos que o
-- cliente não pode alterar diretamente.

create function public.gerar_codigo_convite() returns text
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  -- Sem I, O, 0 e 1, para não confundir quem digita.
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
begin
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where codigo_convite = codigo);
  end loop;
  return codigo;
end;
$$;

-- Conta nova no Auth cria o perfil, a ofensiva e as preferências de aviso.
create function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome, avatar_url, codigo_convite)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    public.gerar_codigo_convite()
  );
  insert into public.streaks (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.criar_perfil_novo_usuario();

-- Dificuldade inicial quando não há nivelamento (seção 3.1, passo 9).
-- Quem não está liberado para alta intensidade fica limitado a 3 (seção 6.5).
create function public.dificuldade_inicial(p_nivel_atividade text, p_liberado boolean) returns smallint
language sql immutable
set search_path = public, pg_temp
as $$
  select least(
    case p_nivel_atividade when 'ativo' then 5 when 'pouco_ativo' then 3 else 2 end,
    case when p_liberado then 10 else 3 end
  )::smallint;
$$;

-- Triagem PAR-Q+ simplificada: 7 respostas sim/não (chaves q1 a q7).
-- Qualquer "sim" limita a pessoa a baixa intensidade até ela declarar liberação.
create function public.registrar_triagem(p_respostas jsonb) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_algum_sim boolean := false;
  v_chave text;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_respostas)) <> 7 then
    raise exception 'triagem_invalida' using errcode = '22023';
  end if;
  foreach v_chave in array array['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] loop
    if jsonb_typeof(p_respostas -> v_chave) is distinct from 'boolean' then
      raise exception 'triagem_invalida' using errcode = '22023';
    end if;
    v_algum_sim := v_algum_sim or (p_respostas ->> v_chave)::boolean;
  end loop;

  insert into public.health_screenings (user_id, respostas, algum_sim)
  values (v_user, p_respostas, v_algum_sim);

  update public.profiles
  set liberado_alta_intensidade = not v_algum_sim,
      liberacao_declarada_em = null,
      dificuldade_atual = case when v_algum_sim then least(dificuldade_atual, 3) else dificuldade_atual end
  where id = v_user;

  return not v_algum_sim;
end;
$$;

-- Autodeclaração: "Meu médico me liberou para exercício intenso".
create function public.declarar_liberacao_medica() returns void
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
  set liberado_alta_intensidade = true, liberacao_declarada_em = now()
  where id = v_user;
end;
$$;

-- Compromisso inicial de ofensiva: 7, 14 ou 30 dias (seção 10.2).
create function public.definir_compromisso(p_dias integer) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_dias not in (7, 14, 30) then
    raise exception 'compromisso_invalido' using errcode = '22023';
  end if;
  update public.streaks set meta_compromisso = p_dias where user_id = v_user;
end;
$$;

-- Registra quem convidou. Só vale para conta nova (até 7 dias, onboarding não
-- concluído), uma única vez, e nunca para o próprio código.
create function public.registrar_convite(p_codigo text) returns boolean
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
  select id into v_quem_convidou from public.profiles where codigo_convite = upper(btrim(p_codigo));
  if v_quem_convidou is null or v_quem_convidou = v_user then
    return false;
  end if;

  update public.profiles
  set convidado_por = v_quem_convidou
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

-- Dados de quem convidou para a landing /c/[codigo]: só o que é público.
create function public.convite_publico(p_codigo text)
returns table (apelido text, avatar_url text, ofensiva integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(p.apelido, split_part(p.nome, ' ', 1), 'Alguém'), p.avatar_url, coalesce(s.atual, 0)
  from public.profiles p
  left join public.streaks s on s.user_id = p.id
  where p.codigo_convite = upper(btrim(p_codigo));
$$;

-- Fecha o onboarding: confere se tudo foi preenchido, define a dificuldade
-- inicial e libera o Nível 1. Devolve { ok, faltando: [...] }.
create function public.concluir_onboarding() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  v_faltando text[] := '{}';
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user;

  if (select count(distinct tipo) from public.consents where user_id = v_user) < 3 then
    v_faltando := array_append(v_faltando, 'termos');
  end if;
  if p.apelido is null or p.data_nascimento is null or p.sexo is null or p.altura_cm is null
     or p.peso_kg is null or p.objetivo is null or p.nivel_atividade is null or p.dias_semana is null
     or p.equipamentos is null then
    v_faltando := array_append(v_faltando, 'perfil');
  end if;
  if not exists (select 1 from public.health_screenings where user_id = v_user) then
    v_faltando := array_append(v_faltando, 'triagem');
  end if;
  if p.meta_desafios_dia is null
     or (select meta_compromisso from public.streaks where user_id = v_user) is null then
    v_faltando := array_append(v_faltando, 'meta');
  end if;
  if p.musica_estilo is null then
    v_faltando := array_append(v_faltando, 'musica');
  end if;

  if array_length(v_faltando, 1) > 0 then
    return jsonb_build_object('ok', false, 'faltando', to_jsonb(v_faltando));
  end if;

  if p.onboarding_concluido_em is null then
    update public.profiles
    set onboarding_concluido_em = now(),
        dificuldade_atual = public.dificuldade_inicial(p.nivel_atividade, p.liberado_alta_intensidade)
    where id = v_user;
    insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, 1, true)
    on conflict (user_id, level_id) do update set liberado = true;
  end if;
  return jsonb_build_object('ok', true, 'faltando', '[]'::jsonb);
end;
$$;

-- No Postgres toda função nasce executável por qualquer papel. Aqui se retira
-- tudo e se concede função por função. Toda migração nova que criar funções
-- precisa repetir este bloco.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.minhas_ligas() to authenticated;
grant execute on function public.registrar_triagem(jsonb) to authenticated;
grant execute on function public.declarar_liberacao_medica() to authenticated;
grant execute on function public.definir_compromisso(integer) to authenticated;
grant execute on function public.registrar_convite(text) to authenticated;
grant execute on function public.concluir_onboarding() to authenticated;
grant execute on function public.convite_publico(text) to anon, authenticated;
grant execute on all functions in schema public to service_role;

-- >>> seed.sql
-- Hive Break · Seed de conteúdo fixo.
-- Fase 1: os 8 níveis (seção 6.1) e as 12 conquistas (seção 9.6).
-- Exercícios, desafios e blocos entram na Fase 3; textos de aviso, na Fase 5.

insert into public.levels (id, ordem, tema, equipamentos_necessarios, avisar_no_nivel) values
  (1, 1, 'Primeiros passos', '{}', null),
  (2, 2, 'Base de movimento', '{}', null),
  (3, 3, 'Equilíbrio e controle', '{}', null),
  (4, 4, 'Ritmo', '{}', null),
  (5, 5, 'Chão firme', '{tapete}', 3),
  (6, 6, 'Potência', '{tapete}', 3),
  (7, 7, 'Amplitude total', '{tapete,cabo_vassoura}', 5),
  (8, 8, 'Desafio final', '{tapete,cabo_vassoura}', 5)
on conflict (id) do update
  set ordem = excluded.ordem, tema = excluded.tema,
      equipamentos_necessarios = excluded.equipamentos_necessarios,
      avisar_no_nivel = excluded.avisar_no_nivel;

insert into public.achievements (id, nome, descricao, criterio) values
  ('primeiro_desafio', 'Primeiro desafio', 'Concluiu o primeiro desafio.', '{"tipo": "desafios_concluidos", "valor": 1}'),
  ('nivel_numa_sessao', 'Fôlego de sobra', 'Completou um nível inteiro numa única sessão.', '{"tipo": "nivel_completo_sessao", "valor": 1}'),
  ('ofensiva_7', 'Ofensiva de 7 dias', 'Sete dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 7}'),
  ('ofensiva_30', 'Ofensiva de 30 dias', 'Trinta dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 30}'),
  ('ofensiva_100', 'Ofensiva de 100 dias', 'Cem dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 100}'),
  ('semana_perfeita', 'Semana perfeita', 'Sete dias seguidos sem usar protetor.', '{"tipo": "semana_perfeita", "valor": 1}'),
  ('nivel_8', 'Desafio final vencido', 'Concluiu o Nível 8.', '{"tipo": "nivel_concluido", "valor": 8}'),
  ('agachamentos_100', '100 agachamentos', 'Somou 100 agachamentos válidos.', '{"tipo": "reps_validas", "exercicio": "agachamento_livre", "valor": 100}'),
  ('arvore_60', 'Raiz firme', 'Postura da árvore por 60 segundos em cada perna.', '{"tipo": "tempo_por_lado", "exercicio": "postura_arvore", "valor": 60}'),
  ('primeiro_amigo', 'Primeiro amigo ativado', 'Um convidado seu concluiu o primeiro desafio.', '{"tipo": "amigos_ativados", "valor": 1}'),
  ('cinco_amigos', '5 amigos ativados', 'Cinco convidados seus concluíram o primeiro desafio.', '{"tipo": "amigos_ativados", "valor": 5}'),
  ('primeira_subida', 'Primeira subida de divisão', 'Subiu de divisão na liga pela primeira vez.', '{"tipo": "subidas_divisao", "valor": 1}'),
  ('nivelamento_melhor', 'Evolução comprovada', 'Refez o nivelamento com melhora.', '{"tipo": "nivelamento_melhora", "valor": 1}')
on conflict (id) do update
  set nome = excluded.nome, descricao = excluded.descricao, criterio = excluded.criterio;

commit;
