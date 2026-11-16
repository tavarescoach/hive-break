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
