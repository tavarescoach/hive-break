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
