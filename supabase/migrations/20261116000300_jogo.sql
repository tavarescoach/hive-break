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
