-- Hive Break · instalação inicial do banco.
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

-- >>> migrations/20261117000600_trilha_unidades.sql
-- Hive Break · Trilha em unidades (pedido do Luan em 17/11/2026)
--
-- Estrutura nova: Nível (seção) -> Unidade temática -> Desafios.
-- Cada unidade tem de 8 a 12 desafios e termina no "Desafio da unidade".
-- A cada 4 desafios há um baú de XP.
--
-- Enquanto a câmera não entra nos desafios, a conclusão é pelo modo
-- provisório (timer + "Concluí"). XP, ofensiva e liberação continuam sendo
-- calculados aqui, no servidor.

create table public.units (
  id text primary key,
  level_id smallint not null references public.levels (id) on delete cascade,
  ordem smallint not null,
  titulo text not null,
  descricao text,
  unique (level_id, ordem)
);

alter table public.challenges
  add column unit_id text not null references public.units (id) on delete cascade,
  add column tipo text not null default 'desafio' check (tipo in ('desafio', 'final')),
  drop constraint challenges_level_id_ordem_key,
  add constraint challenges_unit_ordem_key unique (unit_id, ordem);

alter table public.user_challenge_progress add column concluido_em timestamptz;

-- Baús de XP já abertos (um a cada 4 desafios da unidade).
create table public.user_chests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id text not null references public.units (id) on delete cascade,
  posicao smallint not null check (posicao > 0 and posicao % 4 = 0),
  aberto_em timestamptz not null default now(),
  primary key (user_id, unit_id, posicao)
);

alter table public.units enable row level security;
alter table public.user_chests enable row level security;
revoke all on public.units, public.user_chests from anon, authenticated;
grant select on public.units to anon, authenticated;
grant select on public.user_chests to authenticated;
grant all on public.units, public.user_chests to service_role;
create policy "conteudo: todos leem" on public.units for select to anon, authenticated using (true);
create policy "baus: dono le" on public.user_chests for select to authenticated using (user_id = (select auth.uid()));

-- XP de cada tipo de item da trilha.
create function public.xp_do_desafio(p_tipo text) returns integer
language sql immutable
set search_path = public, pg_temp
as $$ select case p_tipo when 'final' then 20 else 10 end $$;

-- Estado de cada desafio para um usuário:
--   concluido  = já fez
--   travado    = intensidade média ou alta e a pessoa não está liberada (triagem)
--   disponivel = seção liberada e nada pendente antes dele na seção
--   bloqueado  = ainda há desafio pendente antes, ou a seção não foi liberada
-- Desafios travados não seguram a fila: quem está limitado a baixa
-- intensidade segue pelos desafios que pode fazer.
create function public.trilha_estados(p_user uuid)
returns table (challenge_id text, level_id smallint, unit_id text, ordem smallint, seq integer, estado text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with base as (
    select c.id, c.level_id, c.unit_id, c.ordem,
           row_number() over (partition by c.level_id order by u.ordem, c.ordem)::int as seq,
           (p.concluido_em is not null) as feito,
           (pf.liberado_alta_intensidade or c.intensidade = 'baixa') as permitido,
           coalesce(lp.liberado, false) as secao_liberada
    from public.challenges c
    join public.units u on u.id = c.unit_id
    cross join (select liberado_alta_intensidade from public.profiles where id = p_user) pf
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

-- Tudo o que a tela Trilha precisa, numa chamada só.
create function public.ler_trilha() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  s public.streaks;
  v_hoje date;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user;
  select * into s from public.streaks where user_id = v_user;
  v_hoje := (now() at time zone p.fuso_horario)::date;

  return jsonb_build_object(
    'nivel_atual', p.nivel_atual,
    'liberado_alta_intensidade', p.liberado_alta_intensidade,
    -- Ofensiva só vale se o último dia ativo foi hoje ou ontem.
    'ofensiva', case when s.ultimo_dia_ativo >= v_hoje - 1 then s.atual else 0 end,
    'fez_hoje', coalesce(s.ultimo_dia_ativo = v_hoje, false),
    'xp_hoje', (select coalesce(sum(valor), 0) from public.xp_events
                where user_id = v_user and (criado_em at time zone p.fuso_horario)::date = v_hoje),
    'meta_xp', coalesce(p.meta_desafios_dia, 1) * 10,
    'niveis', (select jsonb_agg(jsonb_build_object(
                 'id', l.id, 'ordem', l.ordem, 'tema', l.tema, 'equipamentos', l.equipamentos_necessarios,
                 'liberado', coalesce(lp.liberado, false), 'concluido', lp.concluido_em is not null) order by l.ordem)
               from public.levels l
               left join public.user_level_progress lp on lp.user_id = v_user and lp.level_id = l.id),
    'unidades', (select jsonb_agg(jsonb_build_object(
                   'id', u.id, 'level_id', u.level_id, 'ordem', u.ordem, 'titulo', u.titulo, 'descricao', u.descricao)
                   order by u.level_id, u.ordem)
                 from public.units u),
    'desafios', (select jsonb_agg(jsonb_build_object(
                   'id', c.id, 'unit_id', c.unit_id, 'level_id', c.level_id, 'ordem', c.ordem, 'titulo', c.titulo,
                   'modalidade', c.modalidade, 'duracao_s', c.duracao_s, 'intensidade', c.intensidade,
                   'equipamento', c.equipamento, 'tipo', c.tipo, 'xp', public.xp_do_desafio(c.tipo), 'estado', e.estado)
                   order by c.level_id, e.seq)
                 from public.challenges c join public.trilha_estados(v_user) e on e.challenge_id = c.id),
    'baus_abertos', (select coalesce(jsonb_agg(jsonb_build_object('unit_id', unit_id, 'posicao', posicao)), '[]'::jsonb)
                     from public.user_chests where user_id = v_user)
  );
end;
$$;

-- Modo provisório: a pessoa fez o desafio com o timer e tocou em "Concluí".
-- Dá o XP cheio (10, ou 20 no desafio da unidade, +5 no primeiro do dia),
-- conta o dia na ofensiva e libera o próximo. Sem nota, estrelas nem liga.
-- Refazer o mesmo desafio no mesmo dia não dá XP de novo.
create function public.concluir_desafio_provisorio(p_challenge_id text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  c public.challenges;
  v_estado text;
  v_hoje date;
  v_repetido boolean;
  v_primeiro boolean;
  v_xp integer := 0;
  v_ja_tinha_feito boolean;
  v_unidade_concluida boolean := false;
  v_nivel_concluido boolean := false;
  v_proximo smallint;
  v_ofensiva integer;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
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
  if v_estado in ('bloqueado', 'travado') then
    raise exception 'desafio_bloqueado' using errcode = '22023';
  end if;
  v_ja_tinha_feito := v_estado = 'concluido';

  v_hoje := (now() at time zone p.fuso_horario)::date;
  select exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and challenge_id = c.id and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_repetido;
  select not exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_primeiro;

  if not v_repetido then
    v_xp := public.xp_do_desafio(c.tipo) + case when v_primeiro then 5 else 0 end;
  end if;

  with nova as (
    insert into public.challenge_attempts
      (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp, valido_para_liga)
    values (v_user, c.id, p.dificuldade_atual, 'manual', 'concluido', now(), v_xp, false)
    returning id
  )
  insert into public.xp_events (user_id, tipo, valor, attempt_id)
  select v_user, t.tipo, t.valor, nova.id
  from nova, (values ('desafio', public.xp_do_desafio(c.tipo)), ('primeiro_do_dia', 5)) as t (tipo, valor)
  where not v_repetido and (t.tipo = 'desafio' or v_primeiro);

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

  if not v_ja_tinha_feito then
    select not exists (
      select 1 from public.trilha_estados(v_user) where unit_id = c.unit_id and estado in ('disponivel', 'bloqueado')
    ) into v_unidade_concluida;
    select not exists (
      select 1 from public.trilha_estados(v_user) where level_id = c.level_id and estado in ('disponivel', 'bloqueado')
    ) into v_nivel_concluido;
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
    'xp', v_xp, 'primeiro_do_dia', v_primeiro and not v_repetido, 'repetido', v_repetido,
    'ofensiva', v_ofensiva, 'unidade_concluida', v_unidade_concluida,
    'nivel_concluido', v_nivel_concluido, 'proximo_nivel', v_proximo
  );
end;
$$;

-- Baú de XP: abre uma vez, quando tudo até ele na seção já foi feito.
create function public.abrir_bau(p_unit_id text, p_posicao integer) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_level smallint;
  v_seq integer;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select e.level_id, e.seq into v_level, v_seq
  from public.trilha_estados(v_user) e
  join public.challenges c on c.id = e.challenge_id
  where e.unit_id = p_unit_id and e.ordem = p_posicao and c.tipo = 'desafio' and p_posicao % 4 = 0;
  if v_seq is null then
    raise exception 'bau_inexistente' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.trilha_estados(v_user)
    where level_id = v_level and seq <= v_seq and estado in ('disponivel', 'bloqueado')
  ) then
    raise exception 'bau_bloqueado' using errcode = '22023';
  end if;
  begin
    insert into public.user_chests (user_id, unit_id, posicao) values (v_user, p_unit_id, p_posicao);
  exception when unique_violation then
    raise exception 'bau_ja_aberto' using errcode = '22023';
  end;
  insert into public.xp_events (user_id, tipo, valor) values (v_user, 'bau', 10);
  return jsonb_build_object('xp', 10);
end;
$$;

-- "Pular para cá": libera a seção escolhida sem fazer as anteriores (decisão
-- do Luan). Quem não tem liberação médica continua limitado a baixa intensidade.
create function public.pular_para_secao(p_level_id integer) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.levels where id = p_level_id) then
    raise exception 'secao_inexistente' using errcode = '22023';
  end if;
  if (select onboarding_concluido_em from public.profiles where id = v_user) is null then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, p_level_id, true)
  on conflict (user_id, level_id) do update set liberado = true;
  update public.profiles set nivel_atual = p_level_id where id = v_user;
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
grant execute on function public.concluir_desafio_provisorio(text) to authenticated;
grant execute on function public.abrir_bau(text, integer) to authenticated;
grant execute on function public.pular_para_secao(integer) to authenticated;
grant execute on all functions in schema public to service_role;

-- >>> migrations/20261117000700_finalizar_desafio.sql
-- Hive Break · Desafio com câmera e regras novas de XP (17/11/2026)
--
-- finalizar_desafio passa a ser usada no lugar de concluir_desafio_provisorio. Recebe só números
-- (repetições, tempos, KPIs); nenhuma imagem, vídeo ou ponto do corpo.
--
-- XP (decisões do Luan):
--   * câmera: XP cheio (10, ou 20 no desafio da unidade);
--   * sem câmera (modo manual, seção 3.5): metade;
--   * refazer um desafio já concluído: 1/3 do XP, uma vez por desafio por dia;
--   * primeiro desafio do dia: +5;
--   * unidade inteira numa única sessão (até 3 horas): +50;
--   * nível concluído: +30.

alter table public.challenge_attempts add column refeito boolean not null default false;

-- concluir_desafio_provisorio continua existindo por enquanto, para a versão
-- antiga do app não quebrar entre rodar este SQL e publicar o código novo.

create function public.finalizar_desafio(p_challenge_id text, p_modo text, p_blocos jsonb) returns jsonb
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
  if v_estado in ('bloqueado', 'travado') then
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

-- Relato de dor durante um desafio (botão "Senti dor", seção 12.4).
create function public.registrar_dor(p_challenge_id text, p_exercise_id text, p_regiao text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
  select v_user, c.id, p.dificuldade_atual, 'camera', 'encerrado_dor', now(), 0
  from public.challenges c, public.profiles p
  where c.id = p_challenge_id and p.id = v_user;
  if not found then
    raise exception 'desafio_inexistente' using errcode = '22023';
  end if;
  insert into public.pain_reports (user_id, exercise_id, regiao, acao_tomada)
  values (v_user, (select id from public.exercises where id = p_exercise_id), p_regiao, 'encerrou');
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
grant execute on function public.abrir_bau(text, integer) to authenticated;
grant execute on function public.pular_para_secao(integer) to authenticated;
grant execute on all functions in schema public to service_role;

-- >>> migrations/20261118000800_metodos.sql
-- Hive Break · Métodos dos desafios (docs/METODOS.md, 18/11/2026)
--
-- Cada desafio passa a ter um método: intervalado, Tabata, séries e
-- repetições, circuito, EMOM, escada ou contra o relógio, com os parâmetros
-- (séries, reps, tempos de trabalho e descanso). O app monta a sequência de
-- fases a partir daqui. A duração do desafio (duracao_s) é a planejada,
-- somando trabalho e descanso, e fica em até 5 minutos.

alter table public.challenges add column metodo jsonb
  check (metodo is null or (jsonb_typeof(metodo) = 'object' and metodo ->> 'tipo' in
    ('intervalado', 'tabata', 'series', 'circuito', 'emom', 'escada', 'contra_relogio')));

comment on column public.challenges.metodo is 'Método do desafio e seus parâmetros (src/dominio/metodos.ts).';

-- >>> migrations/20261118000900_blocos.sql
-- Hive Break · Desafios em blocos com variáveis metodológicas (18/11/2026)
--
-- Cada desafio passa a ser uma lista de blocos (um por exercício), cada um com
-- método (AMRAP, isometria, repetições, EMOM, Tabata, contra o relógio),
-- séries, esforço ou reps-alvo, pausa, score, PSE alvo, cadência, ADM e ação.
-- O formato está em src/dominio/metodos.ts (Estrutura, versão 2). A coluna
-- `metodo` (formato anterior) fica vazia e deixa de ser usada.

alter table public.challenges add column estrutura jsonb
  check (estrutura is null or (jsonb_typeof(estrutura) = 'object'
    and estrutura ->> 'versao' = '2'
    and jsonb_typeof(estrutura -> 'blocos') = 'array'));

comment on column public.challenges.estrutura is 'Blocos do desafio com as variáveis metodológicas (src/dominio/metodos.ts).';

-- Segundos da contagem do pop-up "PREPARE-SE" antes de cada exercício (5 a 10).
alter table public.profiles add column contagem_preparo_s smallint not null default 10
  check (contagem_preparo_s between 5 and 10);
grant update (contagem_preparo_s) on public.profiles to authenticated;

-- Percepção subjetiva de esforço (PSE, 1 a 10) informada no fim do desafio.
-- Vai para a tentativa mais recente do desafio, feita nas últimas 3 horas.
create function public.registrar_esforco(p_challenge_id text, p_valor integer) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_valor is null or p_valor < 1 or p_valor > 10 then
    raise exception 'esforco_invalido' using errcode = '22023';
  end if;
  update public.challenge_attempts set esforco_percebido = p_valor
  where id = (
    select id from public.challenge_attempts
    where user_id = v_user and challenge_id = p_challenge_id and status = 'concluido'
      and concluido_em > now() - interval '3 hours'
    order by concluido_em desc
    limit 1
  );
  return found;
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
grant execute on all functions in schema public to service_role;

-- >>> migrations/20261119001000_hive.sql
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

-- >>> migrations/20261119002000_liga.sql
-- Hive Break · Liga semanal (docs/ESPECIFICACAO.md, seção 9.3, revisada em 17/11/2026)
--
-- Decisões do Luan:
--   * a semana vai de segunda 00h00 a domingo 23h59, no horário de Brasília para todos;
--   * a pessoa entra num grupo no 1º desafio válido da semana, no grupo aberto da
--     divisão dela; com 30 pessoas, abre outro grupo;
--   * pontos de liga = XP da semana ganho em desafios com câmera (desafio, refazer,
--     1º do dia, unidade numa sessão, nível concluído). Não contam modo manual,
--     respiração guiada, convites e nivelamento. Mais de 30% do tempo fora do quadro
--     tira o desafio da liga;
--   * fechamento proporcional: sobem 7 em cada 30 e descem 5 em cada 30, arredondando;
--     grupo com menos de 5 pessoas: só o 1º sobe e ninguém desce. Bronze não desce,
--     Diamante não sobe. Quem sobe ganha 1 protetor de ofensiva;
--   * ninguém é exposto: ler_liga devolve só o pódio, a pessoa e quem está logo acima.
--
-- Os pontos são somados por um gatilho em xp_events, então finalizar_desafio não muda.
-- O fechamento roda por cron (pg_cron, segunda 00h01) e, se o cron não existir, na
-- primeira leitura ou pontuação da semana seguinte.

alter table public.leagues add column criada_em timestamptz not null default now();
alter table public.league_members add column entrou_em timestamptz not null default now();
-- Quando a pessoa chegou aos pontos atuais: no empate, fica na frente quem chegou antes.
alter table public.league_members add column pontos_em timestamptz not null default now();
create index leagues_abertas_idx on public.leagues (status, semana_fim);

-- Segunda-feira da semana da liga (horário de Brasília).
create function public.liga_semana_inicio(p_quando timestamptz default now()) returns date
language sql stable
set search_path = public, pg_temp
as $$ select date_trunc('week', p_quando at time zone 'America/Sao_Paulo')::date $$;

-- Quantos sobem e quantos descem num grupo de p_n pessoas.
create function public.liga_vagas(p_divisao text, p_n integer, out sobem integer, out descem integer)
language sql immutable
set search_path = public, pg_temp
as $$
  select
    case when p_divisao = 'diamante' then 0
         when p_n < 5 then least(p_n, 1)
         else round(p_n * 7 / 30.0)::int end,
    case when p_divisao = 'bronze' or p_n < 5 then 0
         else round(p_n * 5 / 30.0)::int end
$$;

-- Fecha os grupos de semanas que já acabaram: posição final, quem sobe e quem desce,
-- divisão nova no perfil, protetor de ofensiva e a conquista da primeira subida.
create function public.fechar_ligas() returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  divisoes constant text[] := array['bronze', 'prata', 'ouro', 'safira', 'diamante'];
  l public.leagues;
  v_n integer;
  v_sobem integer;
  v_descem integer;
  v_fechadas integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('hive_break:fechar_ligas'));
  for l in
    select * from public.leagues
    where status = 'aberta' and semana_fim < (now() at time zone 'America/Sao_Paulo')::date
    order by semana_inicio, criada_em
    for update
  loop
    select count(*) into v_n from public.league_members where league_id = l.id;
    select v.sobem, v.descem into v_sobem, v_descem from public.liga_vagas(l.divisao, v_n) v;

    with ranking as (
      select user_id, row_number() over (order by pontos desc, pontos_em, user_id) as pos
      from public.league_members where league_id = l.id
    )
    update public.league_members m
    set posicao_final = r.pos,
        resultado = case when r.pos <= v_sobem then 'subiu'
                         when r.pos > v_n - v_descem then 'desceu'
                         else 'manteve' end
    from ranking r
    where m.league_id = l.id and m.user_id = r.user_id;

    update public.profiles p
    set divisao_atual = divisoes[array_position(divisoes, l.divisao) + case m.resultado when 'subiu' then 1 else -1 end]
    from public.league_members m
    where m.league_id = l.id and m.user_id = p.id and m.resultado in ('subiu', 'desceu');

    -- Protetor de ofensiva: guarda até 2 (até 4 com ofensiva de 100 dias ou mais).
    update public.streaks s
    set protetores = least(s.protetores + 1, case when s.atual >= 100 then 4 else 2 end)
    from public.league_members m
    where m.league_id = l.id and m.user_id = s.user_id and m.resultado = 'subiu'
      and s.protetores < case when s.atual >= 100 then 4 else 2 end;

    insert into public.user_achievements (user_id, achievement_id)
    select m.user_id, 'primeira_subida' from public.league_members m
    where m.league_id = l.id and m.resultado = 'subiu'
      and exists (select 1 from public.achievements where id = 'primeira_subida')
    on conflict do nothing;

    update public.leagues set status = 'fechada' where id = l.id;
    v_fechadas := v_fechadas + 1;
  end loop;
  return v_fechadas;
end;
$$;

-- Há grupo de semana passada ainda aberto? (consulta barata, usada antes de fechar)
create function public.liga_tem_pendente() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leagues
    where status = 'aberta' and semana_fim < (now() at time zone 'America/Sao_Paulo')::date
  )
$$;

-- Gatilho em xp_events: decide se o XP vale para a liga, põe a pessoa num grupo
-- no 1º XP válido da semana e soma os pontos.
create function public.pontuar_liga() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a public.challenge_attempts;
  v_respiracao boolean;
  v_fora numeric;
  v_semana date;
  v_divisao text;
  v_liga uuid;
begin
  if new.tipo not in ('desafio', 'refazer', 'primeiro_do_dia', 'unidade_sessao', 'nivel_concluido') or new.valor <= 0 then
    return null;
  end if;

  if new.attempt_id is not null then
    select * into a from public.challenge_attempts where id = new.attempt_id;
  else
    -- Nível concluído não guarda a tentativa: vale a que acabou de ser concluída.
    select * into a from public.challenge_attempts
    where user_id = new.user_id and status = 'concluido' and concluido_em >= now() - interval '5 minutes'
    order by concluido_em desc limit 1;
  end if;
  if a.id is null or a.modo <> 'camera' or a.status <> 'concluido' then
    return null;
  end if;

  select c.modalidade = 'respiracao' into v_respiracao from public.challenges c where c.id = a.challenge_id;
  select coalesce(avg(fora_quadro_pct), 0) into v_fora from public.attempt_blocks where attempt_id = a.id;
  if coalesce(v_respiracao, false) or v_fora > 30 then
    return null;
  end if;

  update public.challenge_attempts set valido_para_liga = true where id = a.id and not valido_para_liga;

  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;

  v_semana := public.liga_semana_inicio();
  select m.league_id into v_liga
  from public.league_members m join public.leagues l on l.id = m.league_id
  where m.user_id = new.user_id and l.semana_inicio = v_semana;

  if v_liga is null then
    select divisao_atual into v_divisao from public.profiles where id = new.user_id;
    -- Uma entrada por vez em cada divisão, para nenhum grupo passar de 30.
    perform pg_advisory_xact_lock(hashtext('hive_break:liga:' || v_divisao || ':' || v_semana));
    select m.league_id into v_liga
    from public.league_members m join public.leagues l on l.id = m.league_id
    where m.user_id = new.user_id and l.semana_inicio = v_semana;
  end if;
  if v_liga is null then
    select l.id into v_liga
    from public.leagues l
    where l.semana_inicio = v_semana and l.divisao = v_divisao and l.status = 'aberta'
      and (select count(*) from public.league_members m where m.league_id = l.id) < 30
    order by l.criada_em, l.id
    limit 1;
    if v_liga is null then
      insert into public.leagues (divisao, semana_inicio, semana_fim)
      values (v_divisao, v_semana, v_semana + 6)
      returning id into v_liga;
    end if;
    insert into public.league_members (league_id, user_id, pontos, pontos_em)
    values (v_liga, new.user_id, new.valor, now());
  else
    update public.league_members
    set pontos = pontos + new.valor, pontos_em = now()
    where league_id = v_liga and user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger xp_events_liga after insert on public.xp_events
  for each row execute function public.pontuar_liga();

-- Ranking de um grupo: mais pontos primeiro; no empate, quem chegou antes.
create function public.liga_ranking(p_league_id uuid) returns table (user_id uuid, pontos integer, pos integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.user_id, floor(m.pontos)::int, (row_number() over (order by m.pontos desc, m.pontos_em, m.user_id))::int
  from public.league_members m where m.league_id = p_league_id
$$;

-- Tela da Liga. Devolve só o que a pessoa pode ver: o pódio, ela mesma e quem está
-- logo acima dela. A zona de descida e os pontos que faltam são só dela.
create function public.ler_liga() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_semana date;
  v_divisao text;
  v_anterior jsonb;
  l public.leagues;
  v_n integer;
  v_sobem integer;
  v_descem integer;
  v_pos integer;
  v_pontos integer;
  v_corte_subida integer;
  v_corte_ficar integer;
  v_linhas jsonb;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;
  v_semana := public.liga_semana_inicio();
  select divisao_atual into v_divisao from public.profiles where id = v_user;

  select jsonb_build_object('divisao', pl.divisao, 'posicao', m.posicao_final, 'resultado', m.resultado)
  into v_anterior
  from public.league_members m join public.leagues pl on pl.id = m.league_id
  where m.user_id = v_user and pl.status = 'fechada' and pl.semana_inicio = v_semana - 7;

  select pl.* into l
  from public.leagues pl join public.league_members m on m.league_id = pl.id
  where m.user_id = v_user and pl.semana_inicio = v_semana;

  if l.id is null then
    return jsonb_build_object(
      'divisao', v_divisao, 'semana_fim', v_semana + 6, 'no_grupo', false, 'semana_passada', v_anterior);
  end if;

  select count(*) into v_n from public.league_members where league_id = l.id;
  select v.sobem, v.descem into v_sobem, v_descem from public.liga_vagas(l.divisao, v_n) v;

  select pos, pontos into v_pos, v_pontos from public.liga_ranking(l.id) where user_id = v_user;
  select pontos into v_corte_subida from public.liga_ranking(l.id) where pos = v_sobem;
  select pontos into v_corte_ficar from public.liga_ranking(l.id) where pos = v_n - v_descem;

  select jsonb_agg(jsonb_build_object(
           'posicao', r.pos, 'apelido', coalesce(p.apelido, 'Alguém da hive'), 'avatar_url', p.avatar_url,
           'pontos', r.pontos, 'eu', r.user_id = v_user) order by r.pos)
  into v_linhas
  from public.liga_ranking(l.id) r join public.profiles p on p.id = r.user_id
  where r.pos <= 3 or r.user_id = v_user or r.pos = v_pos - 1;

  return jsonb_build_object(
    'divisao', l.divisao, 'semana_fim', l.semana_fim, 'no_grupo', true,
    'tamanho', v_n, 'sobem', v_sobem, 'descem', v_descem,
    'posicao', v_pos, 'pontos', v_pontos,
    'zona', case when v_pos <= v_sobem then 'subida' when v_pos > v_n - v_descem then 'descida' else 'meio' end,
    'faltam_para_subir', case when v_sobem > 0 and v_pos > v_sobem then v_corte_subida - v_pontos + 1 end,
    'faltam_para_ficar', case when v_descem > 0 and v_pos > v_n - v_descem then v_corte_ficar - v_pontos + 1 end,
    'linhas', coalesce(v_linhas, '[]'::jsonb),
    'semana_passada', v_anterior);
end;
$$;

revoke execute on function public.liga_semana_inicio(timestamptz), public.liga_vagas(text, integer),
  public.fechar_ligas(), public.liga_tem_pendente(), public.pontuar_liga(), public.liga_ranking(uuid),
  public.ler_liga()
  from public, anon, authenticated;
grant execute on function public.ler_liga() to authenticated;
grant execute on function public.liga_semana_inicio(timestamptz), public.liga_vagas(text, integer),
  public.fechar_ligas(), public.liga_tem_pendente(), public.liga_ranking(uuid), public.ler_liga() to service_role;

-- Fechamento automático toda segunda às 00h01 de Brasília (03h01 UTC). Se o pg_cron
-- não estiver disponível, o fechamento acontece na primeira leitura ou pontuação da
-- semana seguinte, então nada quebra.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('hive-break-fechar-ligas', '1 3 * * 1', 'select public.fechar_ligas()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível (%); a liga fecha na primeira leitura da semana seguinte', sqlerrm;
end;
$$;

-- >>> migrations/20261120000100_lembretes_base.sql
-- Hive Break · Lembretes, parte 1: estrutura (FUNIL_LEMBRETES.md, doc do Luan)
--
-- O n8n agenda e envia; o banco decide quem recebe o quê. Esta migração cria:
--   * as colunas de envio em notification_log (reserva → enviado/falhou/simulado);
--   * assunto, pré-header e CTA em notification_templates;
--   * lembretes_config: chaves de configuração (simular, URL do app, segredo, admins);
--   * lembrete_gatilhos: categoria, prioridade e canal de cada gatilho do funil;
--   * high_fives e lembrete_eventos (convite enviado), que alimentam S6 e A5;
--   * o role n8n_lembretes, que só executa as duas funções e marca o resultado do envio.

-- pgcrypto (hmac) já vem instalado no Supabase, no schema extensions.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- --------------------------------------------------------- notification_log
alter table public.notification_log
  add column status text not null default 'reservado'
    check (status in ('reservado', 'enviado', 'falhou', 'simulado')),
  add column assunto text,
  add column preheader text,
  add column titulo text,
  add column texto text,
  add column cta_texto text,
  add column url text,
  add column erro text,
  add column variaveis jsonb,
  -- Quando a linha foi reservada, e o dia no fuso da pessoa (base de "um por dia").
  add column criado_em timestamptz not null default now(),
  add column dia_local date;

-- Avisos gravados antes desta migração já tinham saído.
update public.notification_log set status = 'enviado', criado_em = enviado_em where enviado_em is not null;

-- enviado_em passa a ser preenchido só quando o envio dá certo.
alter table public.notification_log alter column enviado_em drop not null, alter column enviado_em drop default;

-- Um envio por gatilho, canal e dia: a segunda reserva do mesmo aviso não entra,
-- nem se o n8n rodar duas vezes ao mesmo tempo. Disparos de teste têm dia_local nulo.
create unique index notification_log_um_por_dia
  on public.notification_log (user_id, gatilho, canal, dia_local);
create index notification_log_criado_idx on public.notification_log (user_id, criado_em desc);
create index notification_log_status_idx on public.notification_log (criado_em desc) where status = 'reservado';

-- ---------------------------------------------------- notification_templates
alter table public.notification_templates
  add column assunto text,
  add column preheader text,
  add column cta_texto text;

-- ---------------------------------------------------------- configuração
create table public.lembretes_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.lembretes_config enable row level security;
revoke all on public.lembretes_config from anon, authenticated;

insert into public.lembretes_config (chave, valor) values
  -- Ligado: o motor grava 'simulado' e não devolve nada ao n8n. Desligue para valer.
  ('LEMBRETES_SIMULAR', 'true'),
  -- Endereço público do app, usado nos links (sem barra no fim).
  ('APP_URL', '"https://hive-break.vercel.app"'),
  -- Mesmo valor da variável LEMBRETES_SEGREDO da Vercel. Troque antes de desligar a simulação.
  ('LEMBRETES_SEGREDO', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex'))),
  -- ids (uuid) de quem acessa /admin/lembretes.
  ('ADMINS', '[]'),
  -- Teste A/B do lembrete diário: % de pessoas no grupo "12h" (o resto fica em "24h").
  ('R0_AB_12H_PCT', '0'),
  ('LIMITE_EMAIL_DIA', '1'),
  ('LIMITE_PUSH_DIA', '3')
on conflict (chave) do nothing;

create function public.lembretes_cfg(p_chave text) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select valor from public.lembretes_config where chave = p_chave;
$$;

-- --------------------------------------------------------- gatilhos do funil
-- modo: 'email' só e-mail · 'push' push, ou e-mail se a pessoa não tem push ·
--       'push_so' só push · 'ambos' push e e-mail.
-- categoria: o interruptor que desliga o gatilho; null = só "Desativar todos".
-- prioridade: 1 Hive ao vivo · 2 Ofensiva em risco · 3 Social · 4 Ativação · 5 Hábito · 6 Reativação.
create table public.lembrete_gatilhos (
  gatilho text primary key,
  etapa text not null,
  categoria text check (categoria in ('lembrete', 'ofensiva', 'amigos', 'liga', 'resumo_semanal')),
  prioridade smallint not null,
  modo text not null check (modo in ('email', 'push', 'push_so', 'ambos')),
  imediato boolean not null default false,
  -- Fora do limite diário de e-mail (boas-vindas).
  fora_do_limite boolean not null default false,
  -- Para onde o botão leva.
  caminho text not null default '/trilha'
);
alter table public.lembrete_gatilhos enable row level security;
revoke all on public.lembrete_gatilhos from anon, authenticated;

insert into public.lembrete_gatilhos (gatilho, etapa, categoria, prioridade, modo, imediato, fora_do_limite, caminho) values
  ('A1',  'ativacao',   null,             4, 'email',   true,  true,  '/trilha'),
  ('A2',  'ativacao',   'lembrete',       4, 'push',    false, false, '/trilha'),
  ('A3',  'ativacao',   null,             4, 'email',   true,  false, '/amigos'),
  ('A4',  'ativacao',   'lembrete',       4, 'push',    false, false, '/trilha'),
  ('A5',  'ativacao',   'amigos',         4, 'email',   false, false, '/amigos'),
  ('H1',  'hive',       'amigos',         1, 'push_so', false, false, '/hive'),
  ('H2',  'hive',       'amigos',         1, 'push_so', false, false, '/hive'),
  ('H3',  'hive',       'amigos',         1, 'email',   false, false, '/hive'),
  ('R0',  'habito',     'lembrete',       5, 'push',    false, false, '/trilha'),
  ('R1',  'habito',     'ofensiva',       2, 'ambos',   false, false, '/trilha'),
  ('R1b', 'habito',     'ofensiva',       2, 'push_so', false, false, '/trilha'),
  ('R2',  'habito',     'resumo_semanal', 5, 'email',   false, false, '/perfil'),
  ('R3',  'habito',     'ofensiva',       5, 'ambos',   true,  false, '/perfil'),
  ('S1',  'social',     'amigos',         3, 'ambos',   true,  false, '/amigos'),
  ('S3',  'social',     'amigos',         2, 'push',    false, false, '/trilha'),
  ('S4',  'social',     'liga',           3, 'push_so', true,  false, '/liga'),
  ('S5',  'social',     'amigos',         3, 'email',   true,  false, '/amigos'),
  ('S6',  'social',     'amigos',         3, 'push_so', true,  false, '/amigos'),
  ('W1',  'reativacao', 'lembrete',       6, 'ambos',   false, false, '/trilha'),
  ('W2',  'reativacao', 'lembrete',       6, 'email',   false, false, '/hive'),
  ('W3',  'reativacao', null,             6, 'email',   false, false, '/trilha');

-- ------------------------------------------------------ eventos do funil
-- High five recebido (S6). Gravado pelo app; o Realtime continua mostrando na hora.
create table public.high_fives (
  id bigint generated always as identity primary key,
  hive_id uuid references public.hives (id) on delete set null,
  de_user uuid not null references public.profiles (id) on delete cascade,
  para_user uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  check (de_user <> para_user)
);
create index high_fives_para_idx on public.high_fives (para_user, criado_em desc);
alter table public.high_fives enable row level security;
revoke all on public.high_fives from anon, authenticated;

-- Eventos do app que nenhuma outra tabela guarda (ex.: convite enviado, para A5).
create table public.lembrete_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('invite_sent')),
  criado_em timestamptz not null default now()
);
create index lembrete_eventos_user_idx on public.lembrete_eventos (user_id, tipo, criado_em desc);
alter table public.lembrete_eventos enable row level security;
revoke all on public.lembrete_eventos from anon, authenticated;

create function public.registrar_evento_lembrete(p_tipo text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_tipo not in ('invite_sent') then
    raise exception 'evento_invalido' using errcode = '22023';
  end if;
  -- Um por hora basta: o botão pode ser tocado várias vezes seguidas.
  if not exists (
    select 1 from public.lembrete_eventos
    where user_id = v_user and tipo = p_tipo and criado_em > now() - interval '1 hour'
  ) then
    insert into public.lembrete_eventos (user_id, tipo) values (v_user, p_tipo);
  end if;
end;
$$;

-- High five dentro de uma hive: as duas pessoas precisam estar nela.
create function public.registrar_high_five(p_hive uuid, p_para uuid) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if v_user = p_para then
    return false;
  end if;
  if (select count(*) from public.hive_participantes where hive_id = p_hive and user_id in (v_user, p_para)) < 2 then
    return false;
  end if;
  -- Um por par e por hive: o push é agrupado, não precisa de mais.
  if exists (select 1 from public.high_fives where hive_id = p_hive and de_user = v_user and para_user = p_para) then
    return false;
  end if;
  insert into public.high_fives (hive_id, de_user, para_user) values (p_hive, v_user, p_para);
  return true;
end;
$$;

-- --------------------------------------------- volta da pessoa ao treino
-- Qualquer desafio concluído: tira a pausa do W3 e marca os avisos das
-- últimas 2 h como convertidos (desafio_em_2h, a métrica do rodízio).
create function public.lembretes_desafio_concluido() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'concluido' or (tg_op = 'UPDATE' and old.status = 'concluido') then
    return null;
  end if;
  update public.notification_preferences set pausado_ate = null
  where user_id = new.user_id and pausado_ate is not null;
  update public.notification_log set desafio_em_2h = true
  where user_id = new.user_id and status = 'enviado'
    and enviado_em between coalesce(new.concluido_em, now()) - interval '2 hours' and coalesce(new.concluido_em, now())
    and desafio_em_2h is distinct from true;
  return null;
end;
$$;

create trigger challenge_attempts_lembretes after insert or update of status on public.challenge_attempts
  for each row execute function public.lembretes_desafio_concluido();

-- ------------------------------------------------------------ role do n8n
-- Entra pelo pooler do Supabase. A senha é definida à mão (ver docs/CONFIGURACAO.md):
--   alter role n8n_lembretes with password '...';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_lembretes') then
    create role n8n_lembretes with login noinherit;
  end if;
end $$;

grant usage on schema public to n8n_lembretes;
-- UPDATE ... WHERE id = $1 precisa ler o id.
grant select (id, status) on public.notification_log to n8n_lembretes;
grant update (status, enviado_em, erro) on public.notification_log to n8n_lembretes;
create policy "n8n: le avisos" on public.notification_log for select to n8n_lembretes using (true);
create policy "n8n: marca envio" on public.notification_log for update to n8n_lembretes using (true) with check (true);

-- --------------------------------------------------------------- permissões
revoke execute on function public.lembretes_cfg(text), public.registrar_evento_lembrete(text),
  public.registrar_high_five(uuid, uuid), public.lembretes_desafio_concluido() from public, anon, authenticated;
grant execute on function public.registrar_evento_lembrete(text) to authenticated;
grant execute on function public.registrar_high_five(uuid, uuid) to authenticated;
grant all on public.lembretes_config, public.lembrete_gatilhos, public.high_fives, public.lembrete_eventos to service_role;
grant execute on all functions in schema public to service_role;

-- >>> migrations/20261120000200_lembretes_motor.sql
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

-- >>> migrations/20261120000300_lembretes_textos.sql
-- Hive Break · Lembretes, parte 3: textos (FUNIL_LEMBRETES.md, doc do Luan)
--
-- 2 a 3 variações por gatilho e canal. O motor escolhe a menos vista pela
-- pessoa e pula variações com token sem valor (ex.: {hora} só existe no R0
-- quando a última prática foi ontem). Pode ser rodado de novo: atualiza os textos.
--
-- Tokens: {nome} {n} {n+1} {desafio} {duração} {objetivo} {reps} {min} {amigo}
-- {hora} {anfitrião} {reps_total} {próximo_horário} {xp} {tempo} {qtd}
-- {titulo_semana} {dias_semana} {desafios} {var_desafios} {var_min} {var_reps}
-- {var_xp} {amigos_ativos}
--
-- Push: titulo + texto. E-mail: assunto, preheader, titulo (manchete), texto
-- (uma linha por parágrafo) e cta_texto. Tom: leve, sem culpa, sem falar de corpo.

insert into public.notification_templates (id, gatilho, canal, variacao, assunto, preheader, titulo, texto, cta_texto) values
-- ------------------------------------------------------------ ATIVAÇÃO
('A1-email-1', 'A1', 'email', 1,
  'Bem-vindo à Hive Break, {nome} 🐝',
  'Sem equipamento, sem roupa de academia. Só a câmera do celular.',
  'Oi, {nome}!',
  E'A Hive Break funciona assim: desafios de 3 a 5 minutos, a câmera conta as repetições e você vê quem da sua hive já fez hoje.\nSeu objetivo: {objetivo}. O primeiro desafio já está separado: {desafio} · {duração} min.',
  'Bora, 3 minutinhos'),
('A1-email-2', 'A1', 'email', 2,
  'Seu primeiro break leva 3 minutos',
  'Sem equipamento, sem roupa de academia. Só a câmera do celular.',
  'Que bom ter você aqui, {nome}',
  E'Desafios curtos, a câmera conta as repetições e a sua hive vê quem já fez hoje.\nSeu primeiro desafio: {desafio}, {duração} min. Dá para fazer de pé, do lado da mesa.',
  'Começar agora'),

('A2-push-1', 'A2', 'push', 1, null, null, 'Seu primeiro desafio tá pronto 🐝', '3 minutinhos agora?', null),
('A2-push-2', 'A2', 'push', 2, null, null, 'Hive Break', '{desafio} leva {duração} min. Bora fazer o primeiro? 🐝', null),
('A2-push-3', 'A2', 'push', 3, null, null, 'Primeiro break, {nome}?', 'Sem trocar de roupa, sem sair do lugar. 3 minutinhos.', null),
('A2-email-1', 'A2', 'email', 1,
  '{nome}, 3 minutos e pronto ⏱️',
  'Dá para fazer de pé, do lado da mesa.',
  'Seu primeiro desafio continua esperando',
  E'{desafio}, {duração} min. Não precisa trocar de roupa, nem de lugar.\nA câmera conta as repetições para você.',
  'Começar agora'),
('A2-email-2', 'A2', 'email', 2,
  'Seu primeiro break continua aqui',
  'Dá para fazer de pé, do lado da mesa.',
  '3 minutinhos, {nome}?',
  E'Seu primeiro desafio está separado: {desafio}, {duração} min.\nÉ só abrir, apoiar o celular e começar.',
  'Bora, 3 minutinhos'),

('A3-email-1', 'A3', 'email', 1,
  'Dia 1 ✅ Sua ofensiva começou',
  'Amanhã é o dia 2. Fica mais fácil com companhia.',
  'Belo começo, {nome}',
  E'Você fez {reps} repetições em {min} min. A câmera conferiu, tá valendo.\nAmanhã é o dia 2. Quem você chamaria para fazer junto?',
  'Chamar minha hive'),
('A3-email-2', 'A3', 'email', 2,
  '{reps} repetições. Belo começo, {nome}',
  'Amanhã é o dia 2. Fica mais fácil com companhia.',
  'Dia 1 ✅',
  E'{reps} repetições em {min} min. Sua ofensiva começou hoje.\nAmanhã é o dia 2. Chama alguém para fazer junto?',
  'Chamar minha hive'),
('A3-email-3', 'A3', 'email', 3,
  'Dia 1 ✅ Sua ofensiva começou',
  'Amanhã é o dia 2. Fica mais fácil com companhia.',
  'Primeiro break feito, {nome}',
  E'{min} minutos e o dia 1 é seu.\nAmanhã é o dia 2. Quem você chamaria para fazer junto?',
  'Chamar minha hive'),

('A4-push-1', 'A4', 'push', 1, null, null, 'Dia 2 🔥', 'Dia 2 é o mais importante. E leva só 3 minutos.', null),
('A4-push-2', 'A4', 'push', 2, null, null, 'Bora pro dia 2, {nome}?', '{desafio} leva {duração} min. Ontem você mandou bem 🔥', null),
('A4-push-3', 'A4', 'push', 3, null, null, 'Hive Break', 'Mais 3 minutinhos e sua ofensiva vira 2 dias 🔥', null),
('A4-email-1', 'A4', 'email', 1,
  'O dia 2 é o mais curto da sua vida',
  'Ontem foi o dia 1. Hoje leva só 3 minutos.',
  'Dia 2, {nome}',
  E'O dia 2 é o mais importante, e leva só 3 minutos.\nSeu desafio de hoje: {desafio}, {duração} min.',
  'Fazer o dia 2'),
('A4-email-2', 'A4', 'email', 2,
  'Dia 2? 3 minutinhos e pronto 🔥',
  'Ontem foi o dia 1. Hoje leva só 3 minutos.',
  'Sua ofensiva quer o dia 2',
  E'Ontem você começou. Hoje é o dia que transforma o começo em hábito.\n{desafio}, {duração} min.',
  'Fazer o dia 2'),

('A5-email-1', 'A5', 'email', 1,
  'Quem você tiraria da cadeira hoje?',
  'Treinar com alguém do lado é mais fácil.',
  'Sua hive ainda tem lugar 🐝',
  E'Você já tem {n} dias de ofensiva. Agora falta alguém do seu lado.\nManda o link para um colega, alguém da família ou aquele amigo que vive reclamando das costas.',
  'Chamar no WhatsApp'),
('A5-email-2', 'A5', 'email', 2,
  'Sua hive ainda tem lugar 🐝',
  'Treinar com alguém do lado é mais fácil.',
  'Bora chamar alguém, {nome}?',
  E'{n} dias de ofensiva, só você na hive. Que tal chamar alguém?\nCom amigo na hive, vocês veem quem já fez hoje e mandam high five um para o outro.',
  'Chamar no WhatsApp'),

-- ---------------------------------------------------------- HIVE AO VIVO
('H1-push-1', 'H1', 'push', 1, null, null, 'Sua hive começa às {hora} ⏰', '{n} pessoas já confirmaram. Vou entrar?', null),
('H1-push-2', 'H1', 'push', 2, null, null, 'Daqui a pouco: hive às {hora} 🐝', 'Separa 5 minutinhos. {n} pessoas já estão dentro.', null),

('H2-push-1', 'H2', 'push', 1, null, null, 'Let''s hive 🐝', '{anfitrião} e mais {n} já estão no break. Ainda dá tempo, entra.', null),
('H2-push-2', 'H2', 'push', 2, null, null, 'A hive de {anfitrião} começou 🐝', 'Dá para entrar no meio. Bora?', null),

('H3-email-1', 'H3', 'email', 1,
  'Sua hive fez {reps_total} repetições juntas 🐝',
  '{n} pessoas, {min} minutos.',
  'Que hive, {nome}!',
  E'{n} pessoas, {min} minutos, {reps_total} repetições.\nCada um no seu ritmo, todo mundo junto.',
  'Mandar high five para a hive'),
('H3-email-2', 'H3', 'email', 2,
  '{n} pessoas, {reps_total} repetições, uma hive 🐝',
  'Obrigado por puxar o ritmo.',
  'A hive se mexeu',
  E'Foram {min} minutos com {n} pessoas e {reps_total} repetições no total.\nManda um high five para quem estava lá.',
  'Mandar high five para a hive'),
('H3-push-1', 'H3', 'push', 1, null, null, 'Sua hive se mexeu às {hora} 👋', 'Próximo break: {próximo_horário}.', null),
('H3-push-2', 'H3', 'push', 2, null, null, 'Sua hive se mexeu hoje 👋', 'Na próxima, entra junto. Dá para entrar no meio.', null),

-- ---------------------------------------------------------------- HÁBITO
('R0-push-1', 'R0', 'push', 1, null, null, 'Hora do break 🐝', 'Ontem você fez seu break às {hora}. Bora repetir?', null),
('R0-push-2', 'R0', 'push', 2, null, null, 'Dia {n+1} da ofensiva', '3 minutinhos agora?', null),
('R0-push-3', 'R0', 'push', 3, null, null, 'Hora do break, {nome}', 'Seu desafio de hoje leva {duração} min.', null),
('R0-email-1', 'R0', 'email', 1,
  'Seu break de hoje: {desafio}, {duração} min',
  'Um desafio curto e o dia de hoje está feito.',
  'Hora do break, {nome}',
  E'Seu desafio de hoje: {desafio}, {duração} min.\nÉ só apoiar o celular e começar.',
  'Fazer meu break'),
('R0-email-2', 'R0', 'email', 2,
  'Seu break de hoje: {desafio}, {duração} min',
  'Um desafio curto e o dia de hoje está feito.',
  'Bora repetir hoje?',
  E'{duração} minutos e o dia de hoje é seu.\nSeu próximo desafio: {desafio}.',
  'Fazer meu break'),

('R1-push-1', 'R1', 'push', 1, null, null, '🔥 {n} dias', 'Mais 3 minutos e o dia {n+1} é seu.', null),
('R1-push-2', 'R1', 'push', 2, null, null, '🔥 {n} dias. Hoje vira {n+1}?', 'Um desafio curto mantém a sequência.', null),
('R1-email-1', 'R1', 'email', 1,
  'Sua ofensiva de {n} dias quer mais 3 minutos',
  'Um desafio curto mantém a sequência.',
  '🔥 {n} dias',
  E'Um desafio curto mantém a sequência.\nSeu desafio de hoje: {desafio}, {duração} min.',
  'Manter a ofensiva'),
('R1-email-2', 'R1', 'email', 2,
  '🔥 {n} dias. Hoje vira {n+1}?',
  'Um desafio curto mantém a sequência.',
  'Mais 3 minutos, {nome}',
  E'Você está com {n} dias seguidos. Com mais um desafio hoje, vira {n+1}.\n{desafio}, {duração} min.',
  'Manter a ofensiva'),

('R1b-push-1', 'R1b', 'push', 1, null, null, 'Ainda dá tempo 🌙', '3 minutos até meia-noite mantêm seus {n} dias.', null),
('R1b-push-2', 'R1b', 'push', 2, null, null, '🔥 {n} dias', 'Um alongamento de 3 min e o dia {n+1} tá garantido.', null),

('R2-email-1', 'R2', 'email', 1,
  '{titulo_semana}',
  '{desafios} desafios, {min} minutos ativos e {xp} XP nesta semana.',
  '{titulo_semana}',
  E'Dias com break: {dias_semana}.\nMinutos ativos: {min} ({var_min} contra a semana anterior).\nDesafios: {desafios} ({var_desafios}).\nRepetições: {reps} ({var_reps}).\nXP: {xp} ({var_xp}).\nFecha a semana perfeita na próxima?',
  'Ver meu progresso'),
('R2-email-2', 'R2', 'email', 2,
  '{titulo_semana}',
  'Seu resumo da semana na Hive Break.',
  'Sua semana, {nome}',
  E'{desafios} desafios ({var_desafios}) em {dias_semana} dias.\n{min} minutos ativos ({var_min}) e {reps} repetições ({var_reps}).\n{xp} XP ({var_xp}).\nFecha a semana perfeita na próxima?',
  'Ver meu progresso'),

('R3-push-1', 'R3', 'push', 1, null, null, '{n} dias seguidos 🎉', 'Isso merece um card. Compartilha?', null),
('R3-push-2', 'R3', 'push', 2, null, null, '🔥 {n} dias!', 'Marco desbloqueado. Seu card está pronto.', null),
('R3-email-1', 'R3', 'email', 1,
  '{n} dias seguidos 🎉 Isso merece um card',
  'Seu card de {n} dias está pronto para compartilhar.',
  '{n} dias',
  E'{n} dias seguidos de break. Isso é hábito, {nome}.\nSeu card está pronto para compartilhar.',
  'Compartilhar meu card'),
('R3-email-2', 'R3', 'email', 2,
  '🔥 {n} dias seguidos, {nome}',
  'Seu card de {n} dias está pronto para compartilhar.',
  '{n} dias seguidos',
  E'Marco de {n} dias desbloqueado.\nMostra para a sua hive: o card já está pronto.',
  'Compartilhar meu card'),

-- ---------------------------------------------------------------- SOCIAL
('S1-push-1', 'S1', 'push', 1, null, null, '{amigo} entrou na sua hive 🐝', 'Manda um high five?', null),
('S1-push-2', 'S1', 'push', 2, null, null, 'Hive Break', '{amigo} chegou na sua hive. Bora treinar junto? 🐝', null),
('S1-email-1', 'S1', 'email', 1,
  '{amigo} entrou na sua hive 🐝',
  'Agora vocês veem quem já fez o break do dia.',
  '{amigo} chegou',
  E'{amigo} entrou na sua hive.\nAgora vocês veem quem já fez o break do dia e podem treinar juntos.',
  'Mandar high five'),
('S1-email-2', 'S1', 'email', 2,
  'Sua hive cresceu: {amigo} chegou 🐝',
  'Agora vocês veem quem já fez o break do dia.',
  'Sua hive cresceu',
  E'{amigo} acabou de entrar na sua hive.\nUm high five de boas-vindas faz diferença.',
  'Mandar high five'),

('S3-push-1', 'S3', 'push', 1, null, null, '{amigo} já fez hoje 🤝', 'Falta você para a dupla chegar a {n} dias.', null),
('S3-push-2', 'S3', 'push', 2, null, null, 'Sua dupla com {amigo} 🤝', '{amigo} já treinou. 3 minutos e vocês chegam a {n} dias.', null),
('S3-email-1', 'S3', 'email', 1,
  '{amigo} já fez hoje 🤝',
  'Falta você para a dupla chegar a {n} dias.',
  'Falta só você',
  E'{amigo} já fez o break de hoje. Falta você para a dupla chegar a {n} dias.\n{desafio}, {duração} min.',
  'Fazer meu desafio'),
('S3-email-2', 'S3', 'email', 2,
  'Sua dupla com {amigo} chega a {n} dias hoje?',
  'Falta você para a dupla chegar a {n} dias.',
  'Dupla em ação 🤝',
  E'{amigo} já treinou hoje.\nUm desafio curto e a dupla chega a {n} dias.',
  'Fazer meu desafio'),

('S4-push-1', 'S4', 'push', 1, null, null, '{amigo} te passou na liga 😏', 'Faltam {xp} XP para retomar.', null),
('S4-push-2', 'S4', 'push', 2, null, null, 'Movimento na liga 😏', '{amigo} passou na sua frente. {xp} XP e você volta.', null),

('S5-email-1', 'S5', 'email', 1,
  '{amigo} voltou depois de {tempo} 🎉',
  'Um high five agora faz diferença.',
  '{amigo} voltou',
  E'{amigo} voltou a treinar depois de {tempo}.\nUm high five agora faz diferença. E se você também deu uma pausa, sua hive está voltando a se mexer.',
  'Mandar high five'),
('S5-email-2', 'S5', 'email', 2,
  'Olha quem voltou: {amigo} 🎉',
  'Um high five agora faz diferença.',
  'Sua hive está voltando a se mexer',
  E'{amigo} fez um break hoje, depois de {tempo}.\nManda um high five para comemorar.',
  'Mandar high five'),

('S6-push-1', 'S6', 'push', 1, null, null, 'High five 🙌', '{amigo} te mandou um high five.', null),
('S6-push-2', 'S6', 'push', 2, null, null, '{amigo} te mandou um high five 🙌', 'Bora devolver no próximo break?', null),
('S6-push-3', 'S6', 'push', 3, null, null, 'High five 🙌', '{qtd} pessoas te mandaram high five hoje.', null),

-- ------------------------------------------------------------ REATIVAÇÃO
('W1-push-1', 'W1', 'push', 1, null, null, '3 minutinhos? 🐝', 'Um desafio curto para voltar ao ritmo.', null),
('W1-push-2', 'W1', 'push', 2, null, null, '{nome}, seu próximo break tá pronto', '{desafio}, {duração} min. A gente começa leve.', null),
('W1-email-1', 'W1', 'email', 1,
  '3 minutinhos para voltar ao ritmo',
  'Um desafio curto e você está de volta.',
  'Seu próximo break tá pronto',
  E'Separamos um desafio curto: {desafio}, {duração} min.\nEnquanto isso, {amigos_ativos} pessoas da sua hive treinaram esta semana.',
  'Voltar com 3 minutos'),
('W1-email-2', 'W1', 'email', 2,
  '{nome}, seu próximo break tá pronto',
  'Um desafio curto e você está de volta.',
  'Bora voltar leve?',
  E'Seu próximo desafio: {desafio}, {duração} min.\nSem pressa, sem cobrança. É só abrir e começar.',
  'Voltar com 3 minutos'),

('W2-email-1', 'W2', 'email', 1,
  'Olha o que sua hive andou fazendo 🐝',
  'Sua hive continua se mexendo.',
  'Sua hive continua aqui',
  E'Nesta semana, {amigos_ativos} pessoas da sua hive fizeram seus breaks.\nQuando der, entra também. Um desafio de {duração} min já conta.',
  'Entrar na hive'),
('W2-email-2', 'W2', 'email', 2,
  'Olha o que sua hive andou fazendo 🐝',
  'Um desafio curto e você está de volta.',
  'Faz uma semana, {nome}',
  E'Sua hive continua aqui, e tem desafio novo te esperando: {desafio}, {duração} min.\nVolta leve, no seu ritmo.',
  'Entrar na hive'),

('W3-email-1', 'W3', 'email', 1,
  'Vamos dar um tempo nos lembretes',
  'Quando der vontade de um break, é só abrir.',
  'Vamos dar um tempo',
  E'Parece que os lembretes não estão ajudando agora, então vamos parar de mandar.\nQuando der vontade de um break, é só abrir. A sua hive continua aqui.',
  'Fazer um break agora'),
('W3-email-2', 'W3', 'email', 2,
  'Vamos dar um tempo nos lembretes',
  'Quando der vontade de um break, é só abrir.',
  'A gente para por aqui, {nome}',
  E'Os lembretes não parecem estar ajudando agora, então vamos pausar.\nSeu progresso fica guardado e a sua hive continua aqui. Quando quiser, é só abrir.',
  'Fazer um break agora')
on conflict (id) do update set
  gatilho = excluded.gatilho, canal = excluded.canal, variacao = excluded.variacao,
  assunto = excluded.assunto, preheader = excluded.preheader, titulo = excluded.titulo,
  texto = excluded.texto, cta_texto = excluded.cta_texto, ativo = true;

-- >>> migrations/20261120000400_lembretes_app.sql
-- Hive Break · Lembretes, parte 4: funções que o app chama
--
-- Gatilhos imediatos: depois de uma ação, o app pergunta ao banco quem deve ser
-- avisado (lembretes_apos_desafio, lembretes_ao_entrar_hive,
-- lembretes_ao_concluir_cadastro) e manda cada item para o webhook do n8n, que
-- chama lembrete_imediato(). As regras finais (uma vez só, limites, preferências)
-- continuam em lembrete_imediato.
--
-- Push, "desativar" e abertura: rotas do app sem login, protegidas pelo segredo
-- (LEMBRETES_SEGREDO, igual na Vercel e em lembretes_config) ou por token HMAC.

-- ------------------------------------------------------------ auxiliares
create function public.lembrete_segredo_ok(p_segredo text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_segredo, '') <> '' and p_segredo = (public.lembretes_cfg('LEMBRETES_SEGREDO') #>> '{}');
$$;

create function public.lembrete_apelido(p_user uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(apelido), ''), nullif(split_part(btrim(coalesce(nome, '')), ' ', 1), ''), 'Alguém')
  from public.profiles where id = p_user;
$$;

-- ---------------------------------------------- eventos depois de uma ação
-- Pontos da liga nesta semana (null fora da liga). O app lê antes de finalizar
-- o desafio para saber quem foi ultrapassado (S4).
create function public.lembretes_meus_pontos_liga() returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.pontos from public.league_members m
  join public.leagues l on l.id = m.league_id
  where m.user_id = auth.uid() and l.semana_inicio = public.liga_semana_inicio();
$$;

-- Depois de um desafio concluído: A3 (1º dia), R3 (marco), S5 (voltou após
-- 14 dias, para os amigos) e S4 (amigos ultrapassados na liga).
create function public.lembretes_apos_desafio(p_pontos_antes numeric default null) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_fuso text;
  v_hoje date;
  v_hoje_qtd integer;
  v_dias integer;
  v_atual integer;
  v_ultimo timestamptz;
  v_anterior timestamptz;
  v_eu text;
  v_liga uuid;
  v_pontos numeric;
  r jsonb := '[]';
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select fuso_horario into v_fuso from public.profiles where id = v_user;
  v_hoje := (now() at time zone v_fuso)::date;
  v_eu := public.lembrete_apelido(v_user);

  select count(*) filter (where (concluido_em at time zone v_fuso)::date = v_hoje),
         count(distinct (concluido_em at time zone v_fuso)::date)
  into v_hoje_qtd, v_dias
  from public.challenge_attempts where user_id = v_user and status = 'concluido';
  select concluido_em into v_ultimo from public.challenge_attempts
  where user_id = v_user and status = 'concluido' order by concluido_em desc limit 1;
  select concluido_em into v_anterior from public.challenge_attempts
  where user_id = v_user and status = 'concluido' order by concluido_em desc offset 1 limit 1;
  select atual into v_atual from public.streaks where user_id = v_user;

  if v_hoje_qtd = 1 then
    if v_dias = 1 then
      r := r || jsonb_build_object('user_id', v_user, 'gatilho', 'A3', 'dados', '{}'::jsonb);
    end if;
    if v_atual in (7, 14, 30, 100, 365) then
      r := r || jsonb_build_object('user_id', v_user, 'gatilho', 'R3', 'dados', jsonb_build_object('n', v_atual));
    end if;
    if v_anterior is not null and v_ultimo - v_anterior >= interval '14 days' then
      r := r || coalesce((
        select jsonb_agg(jsonb_build_object('user_id', am.amigo, 'gatilho', 'S5',
                 'dados', jsonb_build_object('amigo', v_eu, 'tempo', extract(day from v_ultimo - v_anterior)::int || ' dias')))
        from (select case when f.user_a = v_user then f.user_b else f.user_a end as amigo
              from public.friendships f where v_user in (f.user_a, f.user_b)) am
      ), '[]');
    end if;
  end if;

  -- S4: amigos do mesmo grupo da liga que estavam na frente e agora ficaram atrás.
  select m.league_id, m.pontos into v_liga, v_pontos
  from public.league_members m join public.leagues l on l.id = m.league_id
  where m.user_id = v_user and l.semana_inicio = public.liga_semana_inicio();
  if v_liga is not null then
    r := r || coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'gatilho', 'S4',
               'dados', jsonb_build_object('amigo', v_eu, 'xp', ceil(v_pontos - m.pontos)::int + 1)))
      from public.league_members m
      where m.league_id = v_liga and m.user_id <> v_user
        and m.pontos >= coalesce(p_pontos_antes, 0) and m.pontos < v_pontos
        and exists (select 1 from public.friendships f
                    where (f.user_a, f.user_b) = (least(v_user, m.user_id), greatest(v_user, m.user_id)))
    ), '[]');
  end if;
  return r;
end;
$$;

-- Entrou numa hive: S1 para o anfitrião.
create function public.lembretes_ao_entrar_hive(p_hive uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', h.anfitriao_id, 'gatilho', 'S1',
           'dados', jsonb_build_object('amigo', public.lembrete_apelido(auth.uid()), 'caminho', '/hive/' || h.id))), '[]')
  from public.hives h
  where h.id = p_hive and h.anfitriao_id <> auth.uid()
    and exists (select 1 from public.hive_participantes hp where hp.hive_id = h.id and hp.user_id = auth.uid());
$$;

-- Cadastro concluído: A1 para a pessoa e S1 para quem convidou.
create function public.lembretes_ao_concluir_cadastro() returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_array(jsonb_build_object('user_id', p.id, 'gatilho', 'A1', 'dados', '{}'::jsonb))
         || case when p.convidado_por is not null
              then jsonb_build_array(jsonb_build_object('user_id', p.convidado_por, 'gatilho', 'S1',
                     'dados', jsonb_build_object('amigo', public.lembrete_apelido(p.id), 'caminho', '/amigos')))
              else '[]'::jsonb end
  from public.profiles p
  where p.id = auth.uid() and p.onboarding_concluido_em is not null;
$$;

-- ----------------------------------------------------------------- push
-- Guarda o aparelho (o mesmo endpoint pode mudar de dono se outra pessoa
-- entrar no mesmo navegador) e liga o push nas preferências.
create function public.salvar_push(p_endpoint text, p_chaves jsonb, p_aparelho text default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
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

-- Usada pela rota /api/lembretes/push: o que mandar e para quais aparelhos.
create function public.lembrete_push_dados(p_segredo text, p_log_id bigint) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  l public.notification_log;
begin
  if not public.lembrete_segredo_ok(p_segredo) then
    raise exception 'segredo_invalido' using errcode = '28000';
  end if;
  select * into l from public.notification_log where id = p_log_id and canal = 'push';
  if l.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'log_id', l.id, 'user_id', l.user_id, 'gatilho', l.gatilho,
    'titulo', l.titulo, 'texto', l.texto, 'url', l.url,
    'inscricoes', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'chaves', s.chaves))
      from public.push_subscriptions s where s.user_id = l.user_id and s.ativo
    ), '[]'));
end;
$$;

-- Aparelhos que responderam 404/410: a inscrição acabou.
create function public.lembrete_push_desativar(p_segredo text, p_endpoints text[]) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  if not public.lembrete_segredo_ok(p_segredo) then
    raise exception 'segredo_invalido' using errcode = '28000';
  end if;
  update public.push_subscriptions set ativo = false where endpoint = any(p_endpoints) and ativo;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- Assinatura que vai junto do push, para o service worker registrar a abertura.
create function public.lembrete_assinatura_abertura(p_log_id bigint) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select encode(extensions.hmac('aberto.' || p_log_id, public.lembretes_cfg('LEMBRETES_SEGREDO') #>> '{}', 'sha256'), 'hex');
$$;

create function public.registrar_abertura_lembrete(p_log_id bigint, p_assinatura text) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_assinatura is distinct from public.lembrete_assinatura_abertura(p_log_id) then
    return false;
  end if;
  update public.notification_log set aberto_em = now() where id = p_log_id and aberto_em is null;
  return true;
end;
$$;

-- ------------------------------------------------------------- desativar
-- Link do rodapé: <user_id>.<categoria>.<hmac>. Sem login.
create function public.desativar_lembretes(p_token text, p_tudo boolean default false) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_partes text[] := string_to_array(coalesce(p_token, ''), '.');
  v_user uuid;
  v_categoria text;
begin
  if coalesce(array_length(v_partes, 1), 0) <> 3 or v_partes[1] !~ '^[0-9a-f-]{36}$'
     or v_partes[2] not in ('lembrete', 'ofensiva', 'amigos', 'liga', 'resumo_semanal', 'todos') then
    return jsonb_build_object('ok', false);
  end if;
  v_user := v_partes[1]::uuid;
  v_categoria := v_partes[2];
  if public.lembrete_token(v_user, v_categoria) is distinct from p_token then
    return jsonb_build_object('ok', false);
  end if;
  if p_tudo or v_categoria = 'todos' then
    update public.notification_preferences
    set lembrete = false, ofensiva = false, amigos = false, liga = false, resumo_semanal = false,
        email_ativo = false, push_ativo = false
    where user_id = v_user;
    v_categoria := 'todos';
  else
    execute format('update public.notification_preferences set %I = false where user_id = $1', v_categoria) using v_user;
  end if;
  return jsonb_build_object('ok', true, 'categoria', v_categoria);
end;
$$;

-- --------------------------------------------------------------- admin
create function public.lembretes_sou_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and coalesce(public.lembretes_cfg('ADMINS'), '[]') ? auth.uid()::text;
$$;

create function public.lembretes_admin_log(p_limite integer default 50) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.lembretes_sou_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'simular', coalesce((public.lembretes_cfg('LEMBRETES_SIMULAR'))::boolean, true),
    'envios', coalesce((
      select jsonb_agg(x order by x.id desc) from (
        select l.id, l.criado_em, l.enviado_em, l.aberto_em, l.gatilho, l.canal, l.status, l.erro,
               coalesce(l.assunto, l.titulo) as assunto, l.texto, l.desafio_em_2h,
               public.lembrete_apelido(l.user_id) as pessoa
        from public.notification_log l
        order by l.id desc
        limit least(greatest(coalesce(p_limite, 50), 1), 200)
      ) x
    ), '[]'),
    'gatilhos', (select jsonb_agg(gatilho order by gatilho) from public.lembrete_gatilhos));
end;
$$;

-- --------------------------------------------------------------- permissões
revoke execute on function
  public.lembrete_segredo_ok(text), public.lembrete_apelido(uuid), public.lembretes_meus_pontos_liga(),
  public.lembretes_apos_desafio(numeric), public.lembretes_ao_entrar_hive(uuid), public.lembretes_ao_concluir_cadastro(),
  public.salvar_push(text, jsonb, text), public.lembrete_push_dados(text, bigint), public.lembrete_push_desativar(text, text[]),
  public.lembrete_assinatura_abertura(bigint), public.registrar_abertura_lembrete(bigint, text),
  public.desativar_lembretes(text, boolean), public.lembretes_sou_admin(), public.lembretes_admin_log(integer)
from public, anon, authenticated;

grant execute on function public.lembretes_meus_pontos_liga(), public.lembretes_apos_desafio(numeric),
  public.lembretes_ao_entrar_hive(uuid), public.lembretes_ao_concluir_cadastro(), public.salvar_push(text, jsonb, text),
  public.lembretes_sou_admin(), public.lembretes_admin_log(integer)
to authenticated;
-- Rotas sem login: protegidas pelo segredo ou pelo token assinado.
grant execute on function public.lembrete_push_dados(text, bigint), public.lembrete_push_desativar(text, text[]),
  public.registrar_abertura_lembrete(bigint, text), public.desativar_lembretes(text, boolean)
to anon, authenticated;
grant execute on all functions in schema public to service_role;

-- >>> migrations/20261120001000_liga_todos.sql
-- Hive Break · Liga para todos (decisões do Luan em 17/11/2026, seção 9.3)
--
-- Muda a liga da migração 20261119002000_liga.sql:
--   * todo mundo com cadastro completo entra na liga da semana, mesmo com 0 XP;
--   * grupos de até 15 pessoas, do mesmo tamanho: 20 pessoas viram 2 grupos de 10,
--     30 viram 2 de 15 e 40 viram 3 grupos (14, 13 e 13);
--   * quem termina o cadastro no meio da semana entra no grupo de quem convidou (se tiver vaga)
--     ou no grupo menor da divisão;
--   * a respiração guiada vale XP de liga, mesmo sem câmera;
--   * convite ativado (o convidado concluiu o 1º desafio) dá 20 XP a quem convidou,
--     e esse XP vale na liga. Também dá 1 protetor de ofensiva a cada um e cria a
--     amizade (seção 9.4). Até 10 convites recompensados com XP por mês;
--   * modo manual continua não valendo na liga;
--   * só sobe quem fez pelo menos 1 XP na semana;
--   * a tela mostra todo mundo que treinou na semana; quem tem 0 XP aparece só
--     como contagem.
--
-- A semana atual é refeita: os grupos são montados de novo com todos e os pontos
-- recalculados a partir do XP desde segunda (inclusive o de antes da liga existir).

-- ---------------------------------------------------------------------------
-- Que XP vale para a liga
-- ---------------------------------------------------------------------------
create function public.liga_xp_vale(p_user uuid, p_tipo text, p_valor integer, p_attempt uuid, p_quando timestamptz)
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
  if p_tipo not in ('desafio', 'refazer', 'primeiro_do_dia', 'unidade_sessao', 'nivel_concluido') then
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

-- ---------------------------------------------------------------------------
-- Montagem dos grupos
-- ---------------------------------------------------------------------------

-- Põe uma pessoa num grupo já existente da semana: o de quem convidou, se for da
-- mesma divisão e tiver vaga; senão, o grupo menor da divisão; com todos cheios
-- (15), um grupo novo.
create function public.liga_colocar(p_user uuid, p_divisao text, p_semana date) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_liga uuid;
  v_convidou uuid;
begin
  select convidado_por into v_convidou from public.profiles where id = p_user;
  select l.id into v_liga
  from public.leagues l
  where l.semana_inicio = p_semana and l.divisao = p_divisao and l.status = 'aberta'
    and (select count(*) from public.league_members m where m.league_id = l.id) < 15
  order by
    (v_convidou is not null and exists (
      select 1 from public.league_members m where m.league_id = l.id and m.user_id = v_convidou)) desc,
    (select count(*) from public.league_members m where m.league_id = l.id),
    l.criada_em, l.id
  limit 1;
  if v_liga is null then
    insert into public.leagues (divisao, semana_inicio, semana_fim)
    values (p_divisao, p_semana, p_semana + 6)
    returning id into v_liga;
  end if;
  insert into public.league_members (league_id, user_id, pontos, pontos_em) values (v_liga, p_user, 0, now());
  return v_liga;
end;
$$;

-- Monta os grupos da semana: todo mundo com cadastro completo, em grupos de até
-- 15 do mesmo tamanho. Numa divisão que já tem grupos nesta semana, quem ficou de
-- fora entra pelo liga_colocar.
create function public.liga_formar_semana(p_semana date) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  d text;
  v_ids uuid[];
  v_n integer;
  v_k integer;
  v_grupos uuid[];
  i integer;
begin
  perform pg_advisory_xact_lock(hashtext('hive_break:liga_formar:' || p_semana));
  foreach d in array array['bronze', 'prata', 'ouro', 'safira', 'diamante'] loop
    select array_agg(p.id order by random()) into v_ids
    from public.profiles p
    where p.onboarding_concluido_em is not null and p.divisao_atual = d
      and not exists (
        select 1 from public.league_members m join public.leagues l on l.id = m.league_id
        where m.user_id = p.id and l.semana_inicio = p_semana);
    v_n := coalesce(array_length(v_ids, 1), 0);
    continue when v_n = 0;

    if exists (select 1 from public.leagues where semana_inicio = p_semana and divisao = d) then
      for i in 1..v_n loop
        perform public.liga_colocar(v_ids[i], d, p_semana);
      end loop;
      continue;
    end if;

    v_k := ceil(v_n / 15.0)::int;
    v_grupos := array[]::uuid[];
    for i in 1..v_k loop
      insert into public.leagues (divisao, semana_inicio, semana_fim)
      values (d, p_semana, p_semana + 6)
      returning array_append(v_grupos, id) into v_grupos;
    end loop;
    -- Distribui um por grupo, em rodízio: os tamanhos diferem em no máximo 1.
    for i in 1..v_n loop
      insert into public.league_members (league_id, user_id, pontos, pontos_em)
      values (v_grupos[((i - 1) % v_k) + 1], v_ids[i], 0, now());
    end loop;
  end loop;
end;
$$;

-- Garante que a pessoa está num grupo desta semana e devolve o grupo.
create function public.liga_garantir_membro(p_user uuid) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_semana date := public.liga_semana_inicio();
  v_liga uuid;
  v_divisao text;
begin
  select m.league_id into v_liga
  from public.league_members m join public.leagues l on l.id = m.league_id
  where m.user_id = p_user and l.semana_inicio = v_semana;
  if v_liga is not null then
    return v_liga;
  end if;

  -- Semana passada ainda aberta (o cron não rodou): fecha antes, para a divisão estar certa.
  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;
  select divisao_atual into v_divisao from public.profiles where id = p_user;
  if v_divisao is null then
    return null;
  end if;

  -- 1ª pessoa da semana: monta os grupos de todo mundo (inclusive ela, se o cadastro está completo).
  perform public.liga_formar_semana(v_semana);
  perform pg_advisory_xact_lock(hashtext('hive_break:liga:' || v_divisao || ':' || v_semana));
  select m.league_id into v_liga
  from public.league_members m join public.leagues l on l.id = m.league_id
  where m.user_id = p_user and l.semana_inicio = v_semana;
  if v_liga is not null then
    return v_liga;
  end if;

  -- Chegou no meio da semana (cadastro novo ou divisão sem ninguém ainda).
  v_liga := public.liga_colocar(p_user, v_divisao, v_semana);
  return v_liga;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pontos: o gatilho em xp_events passa a usar liga_xp_vale e liga_garantir_membro
-- ---------------------------------------------------------------------------
create or replace function public.pontuar_liga() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_liga uuid;
begin
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

-- ---------------------------------------------------------------------------
-- Fechamento: igual ao anterior, mas só sobe quem fez pelo menos 1 XP
-- ---------------------------------------------------------------------------
create or replace function public.fechar_ligas() returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  divisoes constant text[] := array['bronze', 'prata', 'ouro', 'safira', 'diamante'];
  l public.leagues;
  v_n integer;
  v_sobem integer;
  v_descem integer;
  v_fechadas integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('hive_break:fechar_ligas'));
  for l in
    select * from public.leagues
    where status = 'aberta' and semana_fim < (now() at time zone 'America/Sao_Paulo')::date
    order by semana_inicio, criada_em
    for update
  loop
    select count(*) into v_n from public.league_members where league_id = l.id;
    select v.sobem, v.descem into v_sobem, v_descem from public.liga_vagas(l.divisao, v_n) v;

    with ranking as (
      select user_id, pontos, row_number() over (order by pontos desc, pontos_em, user_id) as pos
      from public.league_members where league_id = l.id
    )
    update public.league_members m
    set posicao_final = r.pos,
        resultado = case when r.pos <= v_sobem and r.pontos > 0 then 'subiu'
                         when r.pos > v_n - v_descem then 'desceu'
                         else 'manteve' end
    from ranking r
    where m.league_id = l.id and m.user_id = r.user_id;

    update public.profiles p
    set divisao_atual = divisoes[array_position(divisoes, l.divisao) + case m.resultado when 'subiu' then 1 else -1 end]
    from public.league_members m
    where m.league_id = l.id and m.user_id = p.id and m.resultado in ('subiu', 'desceu');

    update public.streaks s
    set protetores = least(s.protetores + 1, case when s.atual >= 100 then 4 else 2 end)
    from public.league_members m
    where m.league_id = l.id and m.user_id = s.user_id and m.resultado = 'subiu'
      and s.protetores < case when s.atual >= 100 then 4 else 2 end;

    insert into public.user_achievements (user_id, achievement_id)
    select m.user_id, 'primeira_subida' from public.league_members m
    where m.league_id = l.id and m.resultado = 'subiu'
      and exists (select 1 from public.achievements where id = 'primeira_subida')
    on conflict do nothing;

    update public.leagues set status = 'fechada' where id = l.id;
    v_fechadas := v_fechadas + 1;
  end loop;
  return v_fechadas;
end;
$$;

-- Virada da semana (cron de segunda): fecha a semana passada e monta a nova.
create function public.liga_virar_semana() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fechar_ligas();
  perform public.liga_formar_semana(public.liga_semana_inicio());
end;
$$;

-- ---------------------------------------------------------------------------
-- Tela da Liga: todo mundo que treinou na semana; quem tem 0 XP vira contagem
-- ---------------------------------------------------------------------------
create or replace function public.ler_liga() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_semana date;
  v_divisao text;
  v_anterior jsonb;
  l public.leagues;
  v_liga uuid;
  v_n integer;
  v_sobem integer;
  v_descem integer;
  v_pos integer;
  v_pontos integer;
  v_corte_subida integer;
  v_corte_ficar integer;
  v_sem_treino integer;
  v_linhas jsonb;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if public.liga_tem_pendente() then
    perform public.fechar_ligas();
  end if;
  v_semana := public.liga_semana_inicio();
  select divisao_atual into v_divisao from public.profiles where id = v_user;

  select jsonb_build_object('divisao', pl.divisao, 'posicao', m.posicao_final, 'resultado', m.resultado)
  into v_anterior
  from public.league_members m join public.leagues pl on pl.id = m.league_id
  where m.user_id = v_user and pl.status = 'fechada' and pl.semana_inicio = v_semana - 7;

  v_liga := public.liga_garantir_membro(v_user);
  select * into l from public.leagues where id = v_liga;
  if l.id is null then
    return jsonb_build_object(
      'divisao', v_divisao, 'semana_fim', v_semana + 6, 'no_grupo', false, 'semana_passada', v_anterior);
  end if;

  select count(*) into v_n from public.league_members where league_id = l.id;
  select v.sobem, v.descem into v_sobem, v_descem from public.liga_vagas(l.divisao, v_n) v;

  select pos, pontos into v_pos, v_pontos from public.liga_ranking(l.id) where user_id = v_user;
  select pontos into v_corte_subida from public.liga_ranking(l.id) where pos = v_sobem;
  select pontos into v_corte_ficar from public.liga_ranking(l.id) where pos = v_n - v_descem;
  select count(*) into v_sem_treino from public.liga_ranking(l.id) where pontos = 0 and user_id <> v_user;

  select jsonb_agg(jsonb_build_object(
           'posicao', r.pos, 'apelido', coalesce(p.apelido, 'Alguém da hive'), 'avatar_url', p.avatar_url,
           'pontos', r.pontos, 'eu', r.user_id = v_user) order by r.pos)
  into v_linhas
  from public.liga_ranking(l.id) r join public.profiles p on p.id = r.user_id
  where r.pontos > 0 or r.user_id = v_user;

  return jsonb_build_object(
    'divisao', l.divisao, 'semana_fim', l.semana_fim, 'no_grupo', true,
    'tamanho', v_n, 'sobem', v_sobem, 'descem', v_descem,
    'posicao', v_pos, 'pontos', v_pontos, 'sem_treino', v_sem_treino,
    'zona', case when v_pos <= v_sobem then 'subida' when v_pos > v_n - v_descem then 'descida' else 'meio' end,
    'faltam_para_subir', case when v_sobem > 0 and v_pos > v_sobem then v_corte_subida - v_pontos + 1 end,
    'faltam_para_ficar', case when v_descem > 0 and v_pos > v_n - v_descem then v_corte_ficar - v_pontos + 1 end,
    'linhas', coalesce(v_linhas, '[]'::jsonb),
    'semana_passada', v_anterior);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ativação de convite (seção 9.4): no 1º desafio concluído do convidado
-- ---------------------------------------------------------------------------
create function public.ativar_convite(p_invitee uuid, p_quando timestamptz) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  i public.invites;
  v_recompensados integer;
begin
  select * into i from public.invites where invitee_id = p_invitee and ativado_em is null for update;
  if i.id is null then
    return;
  end if;
  update public.invites set ativado_em = p_quando where id = i.id;

  insert into public.friendships (user_a, user_b, origem)
  values (least(i.inviter_id, i.invitee_id), greatest(i.inviter_id, i.invitee_id), 'convite')
  on conflict do nothing;

  -- 1 protetor de ofensiva para cada um (limite de 2, ou 4 com ofensiva de 100 dias ou mais).
  insert into public.streaks (user_id, protetores) values (i.inviter_id, 1), (i.invitee_id, 1)
  on conflict (user_id) do update
  set protetores = least(public.streaks.protetores + 1, case when public.streaks.atual >= 100 then 4 else 2 end)
  where public.streaks.protetores < case when public.streaks.atual >= 100 then 4 else 2 end;

  -- 20 XP para quem convidou, até 10 convites recompensados por mês.
  select count(*) into v_recompensados from public.invites
  where inviter_id = i.inviter_id and recompensado
    and date_trunc('month', ativado_em at time zone 'America/Sao_Paulo') = date_trunc('month', p_quando at time zone 'America/Sao_Paulo');
  if v_recompensados < 10 then
    update public.invites set recompensado = true where id = i.id;
    insert into public.xp_events (user_id, tipo, valor) values (i.inviter_id, 'convite', 20);
  end if;
end;
$$;

create function public.ativar_convite_gatilho() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    perform public.ativar_convite(new.user_id, coalesce(new.concluido_em, now()));
  end if;
  return null;
end;
$$;

create trigger challenge_attempts_convite after insert or update of status on public.challenge_attempts
  for each row execute function public.ativar_convite_gatilho();

-- Quem termina o cadastro no meio da semana já entra num grupo (com 0 XP).
create function public.liga_ao_concluir_cadastro() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.onboarding_concluido_em is not null and old.onboarding_concluido_em is null then
    begin
      perform public.liga_garantir_membro(new.id);
    exception when others then
      -- A liga nunca pode travar o cadastro: a pessoa entra no grupo ao abrir a Liga.
      raise warning 'liga: não deu para pôr % num grupo (%)', new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

create trigger profiles_liga after update of onboarding_concluido_em on public.profiles
  for each row execute function public.liga_ao_concluir_cadastro();

revoke execute on function public.liga_xp_vale(uuid, text, integer, uuid, timestamptz), public.liga_colocar(uuid, text, date), public.liga_formar_semana(date),
  public.liga_garantir_membro(uuid), public.liga_virar_semana(), public.ativar_convite(uuid, timestamptz),
  public.ativar_convite_gatilho(), public.liga_ao_concluir_cadastro()
  from public, anon, authenticated;
grant execute on function public.liga_formar_semana(date), public.liga_garantir_membro(uuid),
  public.liga_virar_semana(), public.ativar_convite(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Refaz a semana atual com as regras novas
-- ---------------------------------------------------------------------------
do $$
declare
  v_semana date := public.liga_semana_inicio();
  v_desde timestamptz := public.liga_semana_inicio()::timestamp at time zone 'America/Sao_Paulo';
  e record;
  v_liga uuid;
begin
  perform public.fechar_ligas();
  delete from public.leagues where semana_inicio = v_semana;
  perform public.liga_formar_semana(v_semana);

  for e in
    select x.* from public.xp_events x
    where x.criado_em >= v_desde
      and public.liga_xp_vale(x.user_id, x.tipo, x.valor, x.attempt_id, x.criado_em)
    order by x.criado_em, x.id
  loop
    v_liga := public.liga_garantir_membro(e.user_id);
    update public.league_members set pontos = pontos + e.valor, pontos_em = e.criado_em
    where league_id = v_liga and user_id = e.user_id;
    if e.attempt_id is not null then
      update public.challenge_attempts set valido_para_liga = true where id = e.attempt_id;
    end if;
  end loop;

  -- Convites de quem já concluiu um desafio: ativa agora (o XP entra na liga desta semana).
  for e in
    select i.invitee_id, min(a.concluido_em) as quando
    from public.invites i join public.challenge_attempts a on a.user_id = i.invitee_id and a.status = 'concluido'
    where i.ativado_em is null
    group by i.invitee_id
  loop
    perform public.ativar_convite(e.invitee_id, e.quando);
  end loop;
end;
$$;

-- Cron de segunda passa a fechar e já montar a semana nova.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hive-break-fechar-ligas', '1 3 * * 1', 'select public.liga_virar_semana()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível (%); a semana vira na primeira leitura ou pontuação', sqlerrm;
end;
$$;

-- >>> migrations/20261121000100_ganchos_convite.sql
-- Hive Break · Ganchos de convite (docs/GANCHOS_CONVITE.md)
--
-- Funil da seção 4 (convite enviado → link aberto → desafio iniciado →
-- desafio concluído → cadastro), sempre com família, id do gancho e o código
-- de quem convidou. Reaproveita o que já existe: a tabela invites e o gatilho
-- de ativação (ativar_convite_gatilho, migração 20261120001000).

-- -------------------------------------------------------------- convite_eventos
create table public.convite_eventos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('convite_enviado', 'link_aberto', 'desafio_iniciado', 'desafio_concluido', 'cadastro')),
  familia text not null check (familia in ('D', 'B', 'C')),
  gancho_id text not null check (gancho_id ~ '^[DBC][0-9]{2}$'),
  -- Código de convite de quem convidou (o link é dele, mesmo quando quem gera
  -- o evento é o convidado, como em desafio_iniciado/concluido e cadastro).
  ref text not null,
  -- Quem gerou o evento: quem convidou (convite_enviado) ou o convidado
  -- (os demais). Nulo em link_aberto, que é anônimo.
  user_id uuid references public.profiles (id) on delete set null,
  -- Liga o evento a um convite específico (não existe para convite_enviado/link_aberto).
  invite_id bigint references public.invites (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index convite_eventos_funil_idx on public.convite_eventos (familia, gancho_id, tipo, criado_em desc);
create index convite_eventos_ref_idx on public.convite_eventos (ref, criado_em desc);
alter table public.convite_eventos enable row level security;
revoke all on public.convite_eventos from anon, authenticated;
grant all on public.convite_eventos to service_role;

-- invites ganha a família e o id do gancho do link que trouxe o convidado.
alter table public.invites
  add column familia text check (familia in ('D', 'B', 'C')),
  add column gancho_id text check (gancho_id ~ '^[DBC][0-9]{2}$');

-- ------------------------------------------------------------------ link_aberto
-- Anônimo: a landing /c/[codigo] roda antes do login.
create function public.registrar_link_aberto(p_codigo text, p_familia text, p_gancho_id text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_familia not in ('D', 'B', 'C') or p_gancho_id !~ '^[DBC][0-9]{2}$' then
    return;
  end if;
  if not exists (select 1 from public.profiles where codigo_convite = upper(btrim(p_codigo))) then
    return;
  end if;
  insert into public.convite_eventos (tipo, familia, gancho_id, ref)
  values ('link_aberto', p_familia, p_gancho_id, upper(btrim(p_codigo)));
end;
$$;

-- -------------------------------------------------------------- convite_enviado
-- Quem envia o card pós-treino (seção 3.1). O gancho é sempre o que foi
-- sorteado, mesmo que a pessoa tenha desligado a frase antes de compartilhar.
create function public.registrar_convite_enviado(p_familia text, p_gancho_id text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_codigo text;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_familia not in ('D', 'B', 'C') or p_gancho_id !~ '^[DBC][0-9]{2}$' then
    return;
  end if;
  select codigo_convite into v_codigo from public.profiles where id = v_user;
  if v_codigo is null then
    return;
  end if;
  insert into public.convite_eventos (tipo, familia, gancho_id, ref, user_id)
  values ('convite_enviado', p_familia, p_gancho_id, v_codigo, v_user);
end;
$$;

-- ------------------------------------------------------------- cadastro (convite)
-- Chamada depois de registrar_convite, só quando a pessoa chegou por um link
-- com gancho. Guarda a família/id no invite e registra o evento "cadastro".
create function public.registrar_cadastro_convite(p_familia text, p_gancho_id text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_invite public.invites;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_familia not in ('D', 'B', 'C') or p_gancho_id !~ '^[DBC][0-9]{2}$' then
    return;
  end if;
  update public.invites set familia = p_familia, gancho_id = p_gancho_id
  where invitee_id = v_user and familia is null
  returning * into v_invite;
  if v_invite.id is null then
    return;
  end if;
  insert into public.convite_eventos (tipo, familia, gancho_id, ref, user_id, invite_id)
  select 'cadastro', p_familia, p_gancho_id, pr.codigo_convite, v_user, v_invite.id
  from public.profiles pr where pr.id = v_invite.inviter_id;
end;
$$;

-- ---------------------------------------------------------- desafio_iniciado
-- Chamada ao abrir a tela do desafio, antes da ativação (seção 9.4). Uma vez
-- por convite: a segunda chamada não insere de novo.
create function public.registrar_desafio_iniciado() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_invite public.invites;
begin
  if v_user is null then
    return;
  end if;
  select * into v_invite from public.invites
  where invitee_id = v_user and ativado_em is null and familia is not null;
  if v_invite.id is null then
    return;
  end if;
  if exists (select 1 from public.convite_eventos where invite_id = v_invite.id and tipo = 'desafio_iniciado') then
    return;
  end if;
  insert into public.convite_eventos (tipo, familia, gancho_id, ref, user_id, invite_id)
  select 'desafio_iniciado', v_invite.familia, v_invite.gancho_id, pr.codigo_convite, v_user, v_invite.id
  from public.profiles pr where pr.id = v_invite.inviter_id;
end;
$$;

-- ---------------------------------------------------------- desafio_concluido
-- Mesmo momento da ativação do convite (ativar_convite, migração
-- 20261120001000): o 1º desafio concluído do convidado.
create or replace function public.ativar_convite(p_invitee uuid, p_quando timestamptz) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  i public.invites;
  v_recompensados integer;
begin
  select * into i from public.invites where invitee_id = p_invitee and ativado_em is null for update;
  if i.id is null then
    return;
  end if;
  update public.invites set ativado_em = p_quando where id = i.id;

  if i.familia is not null then
    insert into public.convite_eventos (tipo, familia, gancho_id, ref, user_id, invite_id)
    select 'desafio_concluido', i.familia, i.gancho_id, pr.codigo_convite, i.invitee_id, i.id
    from public.profiles pr where pr.id = i.inviter_id;
  end if;

  insert into public.friendships (user_a, user_b, origem)
  values (least(i.inviter_id, i.invitee_id), greatest(i.inviter_id, i.invitee_id), 'convite')
  on conflict do nothing;

  -- 1 protetor de ofensiva para cada um (limite de 2, ou 4 com ofensiva de 100 dias ou mais).
  insert into public.streaks (user_id, protetores) values (i.inviter_id, 1), (i.invitee_id, 1)
  on conflict (user_id) do update
  set protetores = least(public.streaks.protetores + 1, case when public.streaks.atual >= 100 then 4 else 2 end)
  where public.streaks.protetores < case when public.streaks.atual >= 100 then 4 else 2 end;

  -- 20 XP para quem convidou, até 10 convites recompensados por mês.
  select count(*) into v_recompensados from public.invites
  where inviter_id = i.inviter_id and recompensado
    and date_trunc('month', ativado_em at time zone 'America/Sao_Paulo') = date_trunc('month', p_quando at time zone 'America/Sao_Paulo');
  if v_recompensados < 10 then
    update public.invites set recompensado = true where id = i.id;
    insert into public.xp_events (user_id, tipo, valor) values (i.inviter_id, 'convite', 20);
  end if;
end;
$$;

revoke execute on function public.registrar_link_aberto(text, text, text), public.registrar_convite_enviado(text, text),
  public.registrar_cadastro_convite(text, text), public.registrar_desafio_iniciado()
  from public, anon, authenticated;
grant execute on function public.registrar_link_aberto(text, text, text) to anon, authenticated;
grant execute on function public.registrar_convite_enviado(text, text), public.registrar_cadastro_convite(text, text),
  public.registrar_desafio_iniciado()
  to authenticated;
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

-- >>> seed_trilha.sql
-- Hive Break · Seed da trilha: exercícios, unidades, desafios e blocos.
-- GERADO por scripts/gerar-seed-trilha.ts: não edite à mão. Pode ser rodado
-- mais de uma vez (atualiza o que já existe). Precisa da migração 0009 (coluna estrutura).

insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values
  ('agachamento_livre', 'Agachamento livre', 'forca', 'frontal', '{"id":"agachamento_livre","nome":"Agachamento livre","modalidade":"forca","camera":"frontal","formato":"repeticoes","seg_por_rep":3,"pontos_obrigatorios":["quadril_e","quadril_d","joelho_e","joelho_d"],"medida_principal":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"media","espaco":"3d"},"medidas":{"joelho_2d":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"media","espaco":"2d"},"joelhos_tornozelos":{"tipo":"distancia","pontos":["joelho_e","joelho_d"],"normalizar_por":["tornozelo_e","tornozelo_d"]}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 155"},{"nome":"fundo","condicao":"medida < 120"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 140","parcial_feedback":"Desça mais","amplitude":{"extremo":"min","minimo_aceito":120,"ideal":85},"duracao_minima_ms":500,"fase_minima_ms":150,"erros":[{"id":"valgo","condicao":"vis(tornozelos) > 0.7 e dist(joelhos) < 0.7 * dist(tornozelos)","fase":"fundo","feedback":"Joelhos para fora"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 100","feedback":"Desça mais"}],"kpis":["reps_validas","reps_parciais","amplitude_media","tempo_excentrico","tempo_concentrico","cadencia"],"variacao_facil":"agachamento_parcial_cadeira","alternativas":{"joelho":"ponte_gluteo"},"instrucoes":["Fique de frente para o celular, com o corpo inteiro na tela.","Pés na largura dos ombros.","Desça até as coxas ficarem paralelas ao chão e suba até estender os joelhos."]}'::jsonb, null),
  ('afundo_alternado', 'Afundo alternado', 'forca', 'lateral', '{"id":"afundo_alternado","nome":"Afundo alternado","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3.5,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"min","espaco":"3d"},"medidas":{"tronco":{"tipo":"inclinacao","pontos":["quadril","ombro"]}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 145"},{"nome":"fundo","condicao":"medida < 115"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 140","parcial_feedback":"Desça mais","amplitude":{"extremo":"min","minimo_aceito":115,"ideal":85},"duracao_minima_ms":600,"erros":[{"id":"tronco_inclinado","condicao":"tronco > 35","fase":"fundo","feedback":"Tronco mais reto"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 100","feedback":"Desça mais"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de lado para o celular, com o corpo inteiro na tela.","Dê um passo para trás e desça até o joelho de trás chegar perto do chão.","Volte e troque a perna."]}'::jsonb, null),
  ('flexao_braco', 'Flexão de braço', 'forca', 'lateral', '{"id":"flexao_braco","nome":"Flexão de braço","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3,"pontos_obrigatorios":["ombro","cotovelo","punho","quadril"],"medida_principal":{"tipo":"angulo","pontos":["ombro","cotovelo","punho"],"lado":"visivel","espaco":"2d"},"medidas":{"alinhamento":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"tronco":{"tipo":"inclinacao","pontos":["quadril","ombro"],"lado":"visivel"}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 145 e tronco > 45"},{"nome":"fundo","condicao":"medida < 110 e tronco > 45"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 130","parcial_feedback":"Desça mais o peito","amplitude":{"extremo":"min","minimo_aceito":110,"ideal":75},"duracao_minima_ms":600,"erros":[{"id":"quadril_fora","condicao":"vis(joelho) > 0.6 e alinhamento < 150","feedback":"Alinhe o quadril"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 90","feedback":"Desça mais o peito"}],"kpis":["reps_validas","reps_parciais","amplitude_media","cadencia","indice_tecnico"],"variacao_facil":"flexao_joelhos","instrucoes":["Celular no chão, de lado para você, mostrando o corpo inteiro.","Mãos no chão na linha dos ombros, corpo reto.","Desça até o cotovelo dobrar 90 graus e suba."]}'::jsonb, null),
  ('ponte_gluteo', 'Ponte de glúteo', 'forca', 'lateral', '{"id":"ponte_gluteo","nome":"Ponte de glúteo","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"tronco":{"tipo":"inclinacao","pontos":["quadril","ombro"],"lado":"visivel"}},"histerese":5,"fases":[{"nome":"baixo","condicao":"medida < 135 e tronco > 45"},{"nome":"alto","condicao":"medida > 155"}],"repeticao":["baixo","alto","baixo"],"parcial_se":"max_medida > 140","parcial_feedback":"Suba mais o quadril","amplitude":{"extremo":"max","minimo_aceito":155,"ideal":175},"duracao_minima_ms":600,"erros":[{"id":"amplitude_curta","quando":"fim_rep","condicao":"max_medida < 165","feedback":"Suba mais o quadril"}],"kpis":["reps_validas","reps_parciais","amplitude_media"],"instrucoes":["Celular no chão, de lado para você.","Deite de costas, joelhos dobrados e pés no chão.","Suba o quadril até alinhar ombro, quadril e joelho, e desça."]}'::jsonb, null),
  ('prancha', 'Prancha', 'core', 'lateral', '{"id":"prancha","nome":"Prancha","modalidade":"core","camera":"lateral","formato":"isometria","pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"tronco":{"tipo":"inclinacao","pontos":["quadril","ombro"],"lado":"visivel"}},"histerese":4,"sustentacao":{"condicao":"medida > 155 e tronco > 45","feedback_perda":"Alinhe o quadril","controle":{"ponto":"quadril","normalizar_por":["ombro","quadril"],"oscilacao_maxima":0.06},"histerese":6},"erros":[],"kpis":["tempo_valido_s","estabilidade","pct_tempo_valido"],"instrucoes":["Celular no chão, de lado para você.","Apoie as mãos ou os antebraços, corpo reto da cabeça aos pés.","O tempo só corre com o quadril alinhado."]}'::jsonb, null),
  ('polichinelo', 'Polichinelo', 'cardio', 'frontal', '{"id":"polichinelo","nome":"Polichinelo","modalidade":"cardio","camera":"frontal","formato":"repeticoes","seg_por_rep":1.5,"pontos_obrigatorios":["ombro_e","ombro_d","quadril_e","quadril_d","tornozelo_e","tornozelo_d"],"medida_principal":{"tipo":"distancia","pontos":["tornozelo_e","tornozelo_d"],"normalizar_por":["ombro_e","ombro_d"]},"medidas":{"maos_cabeca":{"tipo":"altura","pontos":["nariz","punho"],"lado":"min","normalizar_por":["ombro_e","ombro_d"]},"maos_ombro":{"tipo":"altura","pontos":["ombro","punho"],"lado":"max","normalizar_por":["ombro_e","ombro_d"]}},"histerese":0.1,"fases":[{"nome":"fechado","condicao":"medida < 1.1 e maos_ombro < 0"},{"nome":"aberto","condicao":"medida > 1.3"}],"repeticao":["fechado","aberto","fechado"],"parcial_se":"max_medida > 1.15","parcial_feedback":"Abra mais as pernas","amplitude":{"extremo":"max","minimo_aceito":1.3,"ideal":1.9},"duracao_minima_ms":400,"fase_minima_ms":150,"erros":[{"id":"bracos_baixos","quando":"fim_rep","condicao":"max_maos_ombro < 0","invalida":true,"feedback":"Suba os braços"},{"id":"bracos_meio","quando":"fim_rep","condicao":"max_maos_ombro >= 0 e max_maos_cabeca < 0","feedback":"Braços acima da cabeça"}],"kpis":["reps_validas","reps_parciais","cadencia","regularidade"],"variacao_facil":"polichinelo_sem_salto","alternativas":{"joelho":"marcha_estacionaria"},"instrucoes":["Fique de frente para o celular, com o corpo inteiro na tela, inclusive as mãos no alto.","Comece com os pés juntos e os braços ao lado do corpo.","Abra as pernas além da largura dos ombros e leve as mãos acima da cabeça."]}'::jsonb, null),
  ('skipping', 'Skipping (elevação de joelhos)', 'cardio', 'frontal', '{"id":"skipping","nome":"Skipping (elevação de joelhos)","modalidade":"cardio","camera":"frontal","formato":"alternado","seg_por_rep":0.6,"pontos_obrigatorios":["ombro_e","ombro_d","quadril_e","quadril_d","joelho_e","joelho_d"],"medida_principal":{"tipo":"altura","pontos":["quadril","joelho"],"lado":"max","normalizar_por":["ombro","quadril"]},"medidas":{"joelho_e_alt":{"tipo":"altura","pontos":["quadril_e","joelho_e"],"normalizar_por":["ombro","quadril"]},"joelho_d_alt":{"tipo":"altura","pontos":["quadril_d","joelho_d"],"normalizar_por":["ombro","quadril"]}},"histerese":0.05,"alternado":{"e":"joelho_e_alt > -0.2","d":"joelho_d_alt > -0.2","quase_e":"joelho_e_alt > -0.5","quase_d":"joelho_d_alt > -0.5"},"parcial_feedback":"Joelho mais alto","duracao_minima_ms":180,"fase_minima_ms":60,"erros":[],"kpis":["reps_validas","reps_parciais","cadencia","simetria"],"instrucoes":["Fique de frente para o celular, com o corpo inteiro na tela.","Corra no lugar levando cada joelho até a altura do quadril."]}'::jsonb, null),
  ('mountain_climber', 'Mountain climber', 'condicionamento', 'lateral', '{"id":"mountain_climber","nome":"Mountain climber","modalidade":"condicionamento","camera":"lateral","formato":"alternado","seg_por_rep":0.7,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"min","espaco":"3d"},"medidas":{"quadril_e":{"tipo":"angulo","pontos":["ombro_e","quadril_e","joelho_e"],"lado":"e","espaco":"3d"},"quadril_d":{"tipo":"angulo","pontos":["ombro_d","quadril_d","joelho_d"],"lado":"d","espaco":"3d"},"tronco":{"tipo":"inclinacao","pontos":["quadril","ombro"]},"alinhamento":{"tipo":"angulo","pontos":["ombro","quadril","tornozelo"],"lado":"max","espaco":"2d"}},"histerese":5,"alternado":{"e":"quadril_e < 105 e tronco > 40","d":"quadril_d < 105 e tronco > 40"},"duracao_minima_ms":200,"fase_minima_ms":80,"erros":[{"id":"quadril_alto","condicao":"vis(tornozelo) > 0.7 e alinhamento < 145 e tronco > 40","feedback":"Abaixe o quadril"}],"kpis":["reps_validas","cadencia","simetria","indice_tecnico"],"instrucoes":["Celular no chão, de lado para você.","Em posição de prancha alta, leve um joelho de cada vez em direção ao peito."]}'::jsonb, null),
  ('elevacao_bracos_y', 'Elevação de braços em Y', 'mobilidade', 'frontal', '{"id":"elevacao_bracos_y","nome":"Elevação de braços em Y","modalidade":"mobilidade","camera":"frontal","formato":"repeticoes","seg_por_rep":3.5,"pontos_obrigatorios":["ombro_e","ombro_d","cotovelo_e","cotovelo_d","quadril_e","quadril_d"],"medida_principal":{"tipo":"angulo","pontos":["quadril","ombro","cotovelo"],"lado":"media","espaco":"2d"},"medidas":{"cotovelo":{"tipo":"angulo","pontos":["ombro","cotovelo","punho"],"lado":"min","espaco":"2d"}},"histerese":5,"fases":[{"nome":"baixo","condicao":"medida < 35"},{"nome":"alto","condicao":"medida > 135"}],"repeticao":["baixo","alto","baixo"],"parcial_se":"max_medida > 100","parcial_feedback":"Suba mais os braços","amplitude":{"extremo":"max","minimo_aceito":135,"ideal":170},"duracao_minima_ms":800,"erros":[{"id":"cotovelo_dobrado","condicao":"cotovelo < 140","fase":"alto","feedback":"Estenda os cotovelos"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"max_medida < 150","feedback":"Suba mais os braços"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de frente para o celular, com os braços aparecendo inteiros no alto.","Suba os braços estendidos formando um Y e desça devagar."]}'::jsonb, null),
  ('alongamento_posterior', 'Alongamento de posterior em pé', 'alongamento', 'lateral', '{"id":"alongamento_posterior","nome":"Alongamento de posterior em pé","modalidade":"alongamento","camera":"lateral","formato":"isometria","pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"joelho":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"visivel","espaco":"2d"}},"histerese":5,"sustentacao":{"condicao":"medida < 120 e (joelho > 150 ou vis(tornozelo) < 0.5)","feedback_perda":"Joelhos estendidos, tronco para a frente"},"erros":[],"kpis":["tempo_valido_s","pct_tempo_valido"],"instrucoes":["Fique de lado para o celular.","Com os joelhos estendidos, incline o tronco para a frente e solte os braços.","O tempo corre enquanto você mantém a posição."]}'::jsonb, null),
  ('marcha_estacionaria', 'Marcha estacionária com braços', 'aquecimento', 'frontal', '{"id":"marcha_estacionaria","nome":"Marcha estacionária com braços","modalidade":"aquecimento","camera":"frontal","formato":"alternado","seg_por_rep":0.9,"pontos_obrigatorios":["ombro_e","ombro_d","quadril_e","quadril_d","joelho_e","joelho_d"],"medida_principal":{"tipo":"altura","pontos":["quadril","joelho"],"lado":"max","normalizar_por":["ombro","quadril"]},"medidas":{"joelho_e_alt":{"tipo":"altura","pontos":["quadril_e","joelho_e"],"normalizar_por":["ombro","quadril"]},"joelho_d_alt":{"tipo":"altura","pontos":["quadril_d","joelho_d"],"normalizar_por":["ombro","quadril"]}},"histerese":0.05,"alternado":{"e":"joelho_e_alt > -0.56","d":"joelho_d_alt > -0.56","quase_e":"joelho_e_alt > -0.7","quase_d":"joelho_d_alt > -0.7"},"parcial_feedback":"Suba mais o joelho","duracao_minima_ms":250,"fase_minima_ms":100,"erros":[],"kpis":["reps_validas","reps_parciais","cadencia","simetria"],"instrucoes":["Fique de frente para o celular, com o corpo inteiro na tela.","Marche no lugar subindo bem os joelhos e balançando os braços."]}'::jsonb, null),
  ('guerreiro_2', 'Guerreiro II', 'yoga', 'frontal', '{"id":"guerreiro_2","nome":"Guerreiro II","modalidade":"yoga","camera":"frontal","formato":"postura","pontos_obrigatorios":["ombro_e","ombro_d","cotovelo_e","cotovelo_d","quadril_e","quadril_d","joelho_e","joelho_d"],"medida_principal":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"min","espaco":"3d"},"medidas":{"ombro_min":{"tipo":"angulo","pontos":["quadril","ombro","cotovelo"],"lado":"min","espaco":"2d"},"ombro_max":{"tipo":"angulo","pontos":["quadril","ombro","cotovelo"],"lado":"max","espaco":"2d"}},"histerese":5,"sustentacao":{"condicao":"medida entre 80 e 135 e ombro_min > 60 e ombro_max < 125","feedback_perda":"Braços na altura dos ombros, joelho da frente dobrado","controle":{"ponto":"quadril","normalizar_por":["ombro","quadril"],"oscilacao_maxima":0.08}},"erros":[],"kpis":["tempo_valido_s","estabilidade","pct_tempo_valido"],"instrucoes":["Fique de frente para o celular, pernas bem afastadas.","Dobre um joelho a 90 graus e abra os braços na altura dos ombros.","Segure. Troque o lado na metade do tempo."]}'::jsonb, null),
  ('postura_arvore', 'Postura da árvore', 'yoga', 'frontal', '{"id":"postura_arvore","nome":"Postura da árvore","modalidade":"yoga","camera":"frontal","formato":"postura","pontos_obrigatorios":["ombro_e","ombro_d","quadril_e","quadril_d","tornozelo_e","tornozelo_d"],"medida_principal":{"tipo":"altura","pontos":["tornozelo_d","tornozelo_e"],"normalizar_por":["ombro","quadril"]},"histerese":0.05,"fase_minima_ms":150,"sustentacao":{"condicao":"abs(medida) > 0.18","feedback_perda":"Pé tocou o chão","lado":{"medida":"medida","positivo":"e","negativo":"d"},"controle":{"ponto":"quadril","normalizar_por":["ombro","quadril"],"oscilacao_maxima":0.08}},"erros":[],"kpis":["tempo_valido_s","tempo_valido_e_s","tempo_valido_d_s","estabilidade","simetria"],"instrucoes":["Fique de frente para o celular.","Apoie a planta de um pé na perna de apoio, acima do tornozelo.","Segure. Troque de perna na metade do tempo."]}'::jsonb, null),
  ('cachorro_olhando_baixo', 'Cachorro olhando para baixo', 'yoga', 'lateral', '{"id":"cachorro_olhando_baixo","nome":"Cachorro olhando para baixo","modalidade":"yoga","camera":"lateral","formato":"postura","pontos_obrigatorios":["ombro","quadril","joelho","punho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"joelho":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"visivel","espaco":"2d"},"cotovelo":{"tipo":"angulo","pontos":["ombro","cotovelo","punho"],"lado":"visivel","espaco":"2d"},"quadril_alto":{"tipo":"altura","pontos":["ombro","quadril"],"lado":"visivel","normalizar_por":["ombro","quadril"]}},"histerese":5,"sustentacao":{"condicao":"medida entre 50 e 115 e (joelho > 140 ou vis(tornozelo) < 0.5) e cotovelo > 145 e quadril_alto > 0.1","feedback_perda":"Quadril para o alto, joelhos e cotovelos estendidos"},"erros":[],"kpis":["tempo_valido_s","pct_tempo_valido"],"instrucoes":["Celular no chão, de lado para você.","Mãos e pés no chão, quadril para o alto, formando um V invertido.","Joelhos e cotovelos estendidos."]}'::jsonb, 'tapete'),
  ('apoio_uma_perna', 'Apoio em uma perna', 'equilibrio', 'frontal', '{"id":"apoio_uma_perna","nome":"Apoio em uma perna","modalidade":"equilibrio","camera":"frontal","formato":"equilibrio","pontos_obrigatorios":["ombro_e","ombro_d","quadril_e","quadril_d","tornozelo_e","tornozelo_d"],"medida_principal":{"tipo":"altura","pontos":["tornozelo_d","tornozelo_e"],"normalizar_por":["ombro","quadril"]},"histerese":0.04,"fase_minima_ms":150,"sustentacao":{"condicao":"abs(medida) > 0.12","feedback_perda":"Pé tocou o chão","lado":{"medida":"medida","positivo":"e","negativo":"d"},"controle":{"ponto":"quadril","normalizar_por":["ombro","quadril"],"oscilacao_maxima":0.08}},"erros":[],"kpis":["tempo_valido_s","tempo_valido_e_s","tempo_valido_d_s","oscilacao","estabilidade","simetria"],"variacao_facil":"apoio_uma_perna_com_toque","alternativas":{},"instrucoes":["Fique de frente para o celular, com o corpo inteiro na tela.","Tire um pé do chão e segure. Pode ser qualquer perna.","O tempo só corre enquanto o pé estiver no ar."]}'::jsonb, null),
  ('toque_alvos', 'Toque nos alvos', 'precisao', 'frontal', '{"id":"toque_alvos","nome":"Toque nos alvos","modalidade":"precisao","camera":"frontal","formato":"precisao","seg_por_rep":2.5,"pontos_obrigatorios":["ombro_e","ombro_d","punho_e","punho_d"],"medida_principal":{"tipo":"distancia","pontos":["punho_e","punho_d"],"normalizar_por":["ombro_e","ombro_d"]},"alvos":{"pontos":["punho_e","punho_d"],"tempo_ms":2500,"raio":0.55,"intervalo_ms":500},"erros":[],"kpis":["acertos","precisao","tempo_reacao"],"instrucoes":["Fique de frente para o celular, com espaço para abrir os braços.","Um círculo aparece na tela: toque nele com a mão em até 2 segundos."]}'::jsonb, null),
  ('respiracao_guiada', 'Respiração guiada', 'respiracao', 'frontal', '{"id":"respiracao_guiada","nome":"Respiração guiada","modalidade":"respiracao","camera":"frontal","formato":"respiracao","pontos_obrigatorios":["ombro_e","ombro_d"],"medida_principal":{"tipo":"movimento","pontos":["nariz","ombro"],"normalizar_por":["ombro_e","ombro_d"]},"histerese":0.1,"fase_minima_ms":500,"sustentacao":{"condicao":"medida < 0.45","feedback_perda":"Fique parado e respire"},"erros":[],"kpis":["tempo_valido_s","pct_tempo_valido"],"instrucoes":["Sente ou fique em pé, de frente para o celular.","Inspire pelo nariz por 4 segundos e solte o ar por 6.","A câmera só confere se você está parado."]}'::jsonb, null),
  ('agachamento_bastao', 'Agachamento com bastão acima da cabeça', 'mobilidade', 'frontal', '{"id":"agachamento_bastao","nome":"Agachamento com bastão acima da cabeça","modalidade":"mobilidade","camera":"frontal","formato":"repeticoes","seg_por_rep":4,"pontos_obrigatorios":["quadril_e","quadril_d","joelho_e","joelho_d"],"medida_principal":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"media","espaco":"3d"},"medidas":{"maos_cabeca":{"tipo":"altura","pontos":["nariz","punho"],"lado":"min","normalizar_por":["ombro_e","ombro_d"]}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 155"},{"nome":"fundo","condicao":"medida < 120"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 140","parcial_feedback":"Desça mais","amplitude":{"extremo":"min","minimo_aceito":120,"ideal":85},"duracao_minima_ms":600,"erros":[{"id":"bracos_caem","condicao":"vis(punhos) > 0.6 e maos_cabeca < -0.2","feedback":"Bastão acima da cabeça"},{"id":"valgo","condicao":"vis(tornozelos) > 0.7 e dist(joelhos) < 0.7 * dist(tornozelos)","fase":"fundo","feedback":"Joelhos para fora"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 100","feedback":"Desça mais"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de frente para o celular.","Segure o cabo de vassoura acima da cabeça, braços estendidos.","Agache sem deixar o bastão cair para a frente."]}'::jsonb, 'cabo_vassoura'),
  ('bom_dia_bastao', 'Bom-dia com bastão', 'forca', 'lateral', '{"id":"bom_dia_bastao","nome":"Bom-dia com bastão","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3.5,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"joelho":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"visivel","espaco":"2d"}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 155"},{"nome":"fundo","condicao":"medida < 125"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 145","parcial_feedback":"Incline mais o tronco","amplitude":{"extremo":"min","minimo_aceito":125,"ideal":90},"duracao_minima_ms":800,"erros":[{"id":"joelhos_dobrados","condicao":"vis(tornozelo) > 0.7 e joelho < 140","fase":"fundo","feedback":"Joelhos quase estendidos"},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 110","feedback":"Incline mais o tronco"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de lado para o celular, com o bastão apoiado nas costas.","Incline o tronco para a frente com os joelhos quase estendidos e volte."]}'::jsonb, 'cabo_vassoura')
on conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,
  definicao = excluded.definicao, equipamento = excluded.equipamento;

insert into public.units (id, level_id, ordem, titulo, descricao) values
  ('n1u1', 1, 1, 'Acordando o corpo', 'Os primeiros movimentos, sem pressa.'),
  ('n1u2', 1, 2, 'Pernas firmes', 'A base de tudo: agachar e sustentar.'),
  ('n1u3', 1, 3, 'Fôlego novo', 'Um pouco mais de ritmo a cada dia.'),
  ('n2u1', 2, 1, 'Agachar bem', 'Técnica antes de quantidade.'),
  ('n2u2', 2, 2, 'Tronco estável', 'Centro do corpo forte e alinhado.'),
  ('n2u3', 2, 3, 'Ritmo constante', 'Manter o passo do começo ao fim.'),
  ('n3u1', 3, 1, 'Um pé de cada vez', 'Equilíbrio em uma perna.'),
  ('n3u2', 3, 2, 'Centro forte', 'CORE para segurar qualquer movimento.'),
  ('n3u3', 3, 3, 'Controle total', 'Devagar e bem feito.'),
  ('n4u1', 4, 1, 'Passo marcado', 'Cadência e coordenação.'),
  ('n4u2', 4, 2, 'Coração acelerado', 'Condicionamento em blocos curtos.'),
  ('n4u3', 4, 3, 'Sem perder o compasso', 'Ritmo com técnica.'),
  ('n5u1', 5, 1, 'No tapete', 'Hora de ir para o chão.'),
  ('n5u2', 5, 2, 'Prancha e ponte', 'Força de tronco e glúteos.'),
  ('n5u3', 5, 3, 'Força de chão', 'Empurrar o próprio peso.'),
  ('n6u1', 6, 1, 'Explosão', 'Mais velocidade, mesma qualidade.'),
  ('n6u2', 6, 2, 'Empurrar e subir', 'Braços e pernas trabalhando juntos.'),
  ('n6u3', 6, 3, 'Motor ligado', 'Sessões longas de fôlego.'),
  ('n7u1', 7, 1, 'Com o bastão', 'O cabo de vassoura entra no treino.'),
  ('n7u2', 7, 2, 'Ombros livres', 'Amplitude acima da cabeça.'),
  ('n7u3', 7, 3, 'Quadril solto', 'Mobilidade de posterior e quadril.'),
  ('n8u1', 8, 1, 'Tudo junto', 'Todos os movimentos numa sessão.'),
  ('n8u2', 8, 2, 'No limite', 'Seu melhor em cada desafio.'),
  ('n8u3', 8, 3, 'Hive completa', 'A última unidade da trilha.')
on conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem;

insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, equipamento, opcional_em_8, extra_em_12, tipo, metodo, estrutura) values
  ('n1u1d01', 1, 'n1u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n1u1d02', 1, 'n1u1', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n1u1d03', 1, 'n1u1', 3, 'Força de pernas', 'forca', 192, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":60,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n1u1d04', 1, 'n1u1', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"},{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n1u1d05', 1, 'n1u1', 5, 'Condicionamento', 'condicionamento', 176, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n1u1d06', 1, 'n1u1', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n1u1d07', 1, 'n1u1', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n1u1d08', 1, 'n1u1', 8, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n1u1final', 1, 'n1u1', 9, 'Desafio da unidade', 'desafio_final', 104, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"for_time","series":1,"reps_alvo":10,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"ponte_gluteo","metodo":"for_time","series":1,"reps_alvo":10,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"for_time","series":1,"reps_alvo":40,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n1u2d01', 1, 'n1u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n1u2d02', 1, 'n1u2', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n1u2d03', 1, 'n1u2', 3, 'Força de pernas', 'forca', 284, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":60,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n1u2d04', 1, 'n1u2', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n1u2d05', 1, 'n1u2', 5, 'Condicionamento', 'condicionamento', 280, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n1u2d06', 1, 'n1u2', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n1u2d07', 1, 'n1u2', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n1u2d08', 1, 'n1u2', 8, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n1u2final', 1, 'n1u2', 9, 'Desafio da unidade', 'desafio_final', 70, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":4,"reps_alvo":[2,4,6,8],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n1u3d01', 1, 'n1u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n1u3d02', 1, 'n1u3', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n1u3d03', 1, 'n1u3', 3, 'Força de pernas', 'forca', 256, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"emom","series":2,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"emom","series":2,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n1u3d04', 1, 'n1u3', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"},{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n1u3d05', 1, 'n1u3', 5, 'Condicionamento', 'condicionamento', 176, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n1u3d06', 1, 'n1u3', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n1u3d07', 1, 'n1u3', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n1u3d08', 1, 'n1u3', 8, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n1u3final', 1, 'n1u3', 9, 'Desafio da unidade', 'desafio_final', 249, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"reps","series":3,"reps_alvo":14,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n2u1d01', 2, 'n2u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n2u1d02', 2, 'n2u1', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n2u1d03', 2, 'n2u1', 3, 'Força de pernas', 'forca', 284, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":60,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n2u1d04', 2, 'n2u1', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n2u1d05', 2, 'n2u1', 5, 'Condicionamento', 'condicionamento', 176, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n2u1d06', 2, 'n2u1', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n2u1d07', 2, 'n2u1', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n2u1d08', 2, 'n2u1', 8, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n2u1final', 2, 'n2u1', 9, 'Desafio da unidade', 'desafio_final', 108, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"for_time","series":1,"reps_alvo":8,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":1,"esforco_s":30,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"for_time","series":1,"reps_alvo":20,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n2u2d01', 2, 'n2u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n2u2d02', 2, 'n2u2', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n2u2d03', 2, 'n2u2', 3, 'Força de pernas', 'forca', 284, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":60,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":60,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n2u2d04', 2, 'n2u2', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"},{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n2u2d05', 2, 'n2u2', 5, 'Condicionamento', 'condicionamento', 280, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n2u2d06', 2, 'n2u2', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n2u2d07', 2, 'n2u2', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n2u2d08', 2, 'n2u2', 8, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n2u2final', 2, 'n2u2', 9, 'Desafio da unidade', 'desafio_final', 60, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":4,"reps_alvo":[2,4,6,8],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n2u3d01', 2, 'n2u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n2u3d02', 2, 'n2u3', 2, 'Mobilidade articular', 'mobilidade', 127, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":6,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":20,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n2u3d03', 2, 'n2u3', 3, 'Força de pernas', 'forca', 240, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"emom","series":4,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n2u3d04', 2, 'n2u3', 4, 'CORE', 'core', 220, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":20,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n2u3d05', 2, 'n2u3', 5, 'Condicionamento', 'condicionamento', 176, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":20,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n2u3d06', 2, 'n2u3', 6, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n2u3d07', 2, 'n2u3', 7, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n2u3d08', 2, 'n2u3', 8, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n2u3final', 2, 'n2u3', 9, 'Desafio da unidade', 'desafio_final', 241, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":3,"reps_alvo":6,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"reps","series":3,"reps_alvo":34,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n3u1d01', 3, 'n3u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n3u1d02', 3, 'n3u1', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n3u1d03', 3, 'n3u1', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u1d04', 3, 'n3u1', 4, 'Força de pernas', 'forca', 265, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u1d05', 3, 'n3u1', 5, 'Força de tronco e braços', 'forca', 231, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u1d06', 3, 'n3u1', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u1d07', 3, 'n3u1', 7, 'Condicionamento', 'condicionamento', 206, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n3u1d08', 3, 'n3u1', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n3u1d09', 3, 'n3u1', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u1d10', 3, 'n3u1', 10, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n3u1final', 3, 'n3u1', 11, 'Desafio da unidade', 'desafio_final', 127, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"for_time","series":1,"reps_alvo":12,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":1,"esforco_s":35,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"for_time","series":1,"reps_alvo":24,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n3u2d01', 3, 'n3u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n3u2d02', 3, 'n3u2', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n3u2d03', 3, 'n3u2', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u2d04', 3, 'n3u2', 4, 'Força de pernas', 'forca', 180, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u2d05', 3, 'n3u2', 5, 'Força de tronco e braços', 'forca', 231, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u2d06', 3, 'n3u2', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u2d07', 3, 'n3u2', 7, 'Condicionamento', 'condicionamento', 280, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":2,"esforco_s":40,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n3u2d08', 3, 'n3u2', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n3u2d09', 3, 'n3u2', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u2d10', 3, 'n3u2', 10, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n3u2final', 3, 'n3u2', 11, 'Desafio da unidade', 'desafio_final', 105, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":5,"reps_alvo":[2,4,6,8,10],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n3u3d01', 3, 'n3u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n3u3d02', 3, 'n3u3', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n3u3d03', 3, 'n3u3', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u3d04', 3, 'n3u3', 4, 'Força de pernas', 'forca', 256, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u3d05', 3, 'n3u3', 5, 'Força de tronco e braços', 'forca', 256, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u3d06', 3, 'n3u3', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n3u3d07', 3, 'n3u3', 7, 'Condicionamento', 'condicionamento', 206, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n3u3d08', 3, 'n3u3', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n3u3d09', 3, 'n3u3', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n3u3d10', 3, 'n3u3', 10, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n3u3final', 3, 'n3u3', 11, 'Desafio da unidade', 'desafio_final', 288, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"flexao_braco","metodo":"reps","series":3,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"reps","series":3,"reps_alvo":16,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n4u1d01', 4, 'n4u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n4u1d02', 4, 'n4u1', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n4u1d03', 4, 'n4u1', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u1d04', 4, 'n4u1', 4, 'Força de pernas', 'forca', 180, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u1d05', 4, 'n4u1', 5, 'Força de tronco e braços', 'forca', 231, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u1d06', 4, 'n4u1', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u1d07', 4, 'n4u1', 7, 'Condicionamento', 'condicionamento', 206, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n4u1d08', 4, 'n4u1', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n4u1d09', 4, 'n4u1', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u1d10', 4, 'n4u1', 10, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n4u1final', 4, 'n4u1', 11, 'Desafio da unidade', 'desafio_final', 107, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"for_time","series":1,"reps_alvo":10,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"for_time","series":1,"reps_alvo":40,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"for_time","series":1,"reps_alvo":40,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n4u2d01', 4, 'n4u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n4u2d02', 4, 'n4u2', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n4u2d03', 4, 'n4u2', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u2d04', 4, 'n4u2', 4, 'Força de pernas', 'forca', 265, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u2d05', 4, 'n4u2', 5, 'Força de tronco e braços', 'forca', 231, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":45,"score":"reps_por_serie","pse_alvo":6,"cadencia":"2-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u2d06', 4, 'n4u2', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u2d07', 4, 'n4u2', 7, 'Condicionamento', 'condicionamento', 280, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":2,"esforco_s":40,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n4u2d08', 4, 'n4u2', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n4u2d09', 4, 'n4u2', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u2d10', 4, 'n4u2', 10, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n4u2final', 4, 'n4u2', 11, 'Desafio da unidade', 'desafio_final', 90, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":5,"reps_alvo":[2,4,6,8,10],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n4u3d01', 4, 'n4u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n4u3d02', 4, 'n4u3', 2, 'Mobilidade articular', 'mobilidade', 151, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":25,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n4u3d03', 4, 'n4u3', 3, 'Equilíbrio', 'equilibrio', 130, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":25,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u3d04', 4, 'n4u3', 4, 'Força de pernas', 'forca', 256, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u3d05', 4, 'n4u3', 5, 'Força de tronco e braços', 'forca', 256, 'media', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u3d06', 4, 'n4u3', 6, 'CORE', 'core', 250, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n4u3d07', 4, 'n4u3', 7, 'Condicionamento', 'condicionamento', 206, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":25,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n4u3d08', 4, 'n4u3', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n4u3d09', 4, 'n4u3', 9, 'Yoga e alongamento', 'yoga', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n4u3d10', 4, 'n4u3', 10, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n4u3final', 4, 'n4u3', 11, 'Desafio da unidade', 'desafio_final', 291, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":25,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"reps","series":3,"reps_alvo":16,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n5u1d01', 5, 'n5u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n5u1d02', 5, 'n5u1', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n5u1d03', 5, 'n5u1', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u1d04', 5, 'n5u1', 4, 'Força de pernas', 'forca', 291, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u1d05', 5, 'n5u1', 5, 'Força de tronco e braços', 'forca', 255, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u1d06', 5, 'n5u1', 6, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u1d07', 5, 'n5u1', 7, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n5u1d08', 5, 'n5u1', 8, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n5u1d09', 5, 'n5u1', 9, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u1d10', 5, 'n5u1', 10, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n5u1final', 5, 'n5u1', 11, 'Desafio da unidade', 'desafio_final', 143, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"for_time","series":1,"reps_alvo":14,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"flexao_braco","metodo":"for_time","series":1,"reps_alvo":14,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"for_time","series":1,"reps_alvo":26,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n5u2d01', 5, 'n5u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n5u2d02', 5, 'n5u2', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n5u2d03', 5, 'n5u2', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u2d04', 5, 'n5u2', 4, 'Força de pernas', 'forca', 291, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u2d05', 5, 'n5u2', 5, 'Força de tronco e braços', 'forca', 255, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u2d06', 5, 'n5u2', 6, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u2d07', 5, 'n5u2', 7, 'Condicionamento', 'condicionamento', 260, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":2,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n5u2d08', 5, 'n5u2', 8, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n5u2d09', 5, 'n5u2', 9, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u2d10', 5, 'n5u2', 10, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n5u2final', 5, 'n5u2', 11, 'Desafio da unidade', 'desafio_final', 120, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":5,"reps_alvo":[4,6,8,10,12],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n5u3d01', 5, 'n5u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n5u3d02', 5, 'n5u3', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n5u3d03', 5, 'n5u3', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u3d04', 5, 'n5u3', 4, 'Força de pernas', 'forca', 240, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"emom","series":4,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u3d05', 5, 'n5u3', 5, 'Força de tronco e braços', 'forca', 256, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u3d06', 5, 'n5u3', 6, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n5u3d07', 5, 'n5u3', 7, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n5u3d08', 5, 'n5u3', 8, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n5u3d09', 5, 'n5u3', 9, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n5u3d10', 5, 'n5u3', 10, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n5u3final', 5, 'n5u3', 11, 'Desafio da unidade', 'desafio_final', 281, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"reps","series":3,"reps_alvo":40,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"reps","series":3,"reps_alvo":40,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n6u1d01', 6, 'n6u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n6u1d02', 6, 'n6u1', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n6u1d03', 6, 'n6u1', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u1d04', 6, 'n6u1', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n6u1d05', 6, 'n6u1', 5, 'Força de pernas', 'forca', 291, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u1d06', 6, 'n6u1', 6, 'Força de tronco e braços', 'forca', 255, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u1d07', 6, 'n6u1', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u1d08', 6, 'n6u1', 8, 'Condicionamento', 'condicionamento', 236, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n6u1d09', 6, 'n6u1', 9, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n6u1d10', 6, 'n6u1', 10, 'Mobilidade dinâmica', 'mobilidade', 161, 'baixa', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3},{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n6u1d11', 6, 'n6u1', 11, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u1d12', 6, 'n6u1', 12, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n6u1final', 6, 'n6u1', 13, 'Desafio da unidade', 'desafio_final', 141, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"for_time","series":1,"reps_alvo":14,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":1,"esforco_s":40,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"for_time","series":1,"reps_alvo":26,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n6u2d01', 6, 'n6u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n6u2d02', 6, 'n6u2', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n6u2d03', 6, 'n6u2', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u2d04', 6, 'n6u2', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n6u2d05', 6, 'n6u2', 5, 'Força de pernas', 'forca', 198, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":3,"reps_alvo":12,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u2d06', 6, 'n6u2', 6, 'Força de tronco e braços', 'forca', 255, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":45,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":45,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u2d07', 6, 'n6u2', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u2d08', 6, 'n6u2', 8, 'Condicionamento', 'condicionamento', 260, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":2,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n6u2d09', 6, 'n6u2', 9, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n6u2d10', 6, 'n6u2', 10, 'Mobilidade dinâmica', 'mobilidade', 161, 'baixa', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n6u2d11', 6, 'n6u2', 11, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u2d12', 6, 'n6u2', 12, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n6u2final', 6, 'n6u2', 13, 'Desafio da unidade', 'desafio_final', 140, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":5,"reps_alvo":[4,6,8,10,12],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n6u3d01', 6, 'n6u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n6u3d02', 6, 'n6u3', 2, 'Mobilidade articular', 'mobilidade', 161, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n6u3d03', 6, 'n6u3', 3, 'Equilíbrio', 'equilibrio', 150, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u3d04', 6, 'n6u3', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n6u3d05', 6, 'n6u3', 5, 'Força de pernas', 'forca', 256, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"agachamento_livre","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u3d06', 6, 'n6u3', 6, 'Força de tronco e braços', 'forca', 256, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u3d07', 6, 'n6u3', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n6u3d08', 6, 'n6u3', 8, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n6u3d09', 6, 'n6u3', 9, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n6u3d10', 6, 'n6u3', 10, 'Mobilidade dinâmica', 'mobilidade', 161, 'baixa', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3},{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n6u3d11', 6, 'n6u3', 11, 'Yoga e alongamento', 'yoga', 290, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n6u3d12', 6, 'n6u3', 12, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n6u3final', 6, 'n6u3', 13, 'Desafio da unidade', 'desafio_final', 276, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"reps","series":3,"reps_alvo":20,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n7u1d01', 7, 'n7u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n7u1d02', 7, 'n7u1', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n7u1d03', 7, 'n7u1', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u1d04', 7, 'n7u1', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n7u1d05', 7, 'n7u1', 5, 'Força de pernas', 'forca', 300, 'media', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"bom_dia_bastao","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u1d06', 7, 'n7u1', 6, 'Força de tronco e braços', 'forca', 234, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u1d07', 7, 'n7u1', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u1d08', 7, 'n7u1', 8, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n7u1d09', 7, 'n7u1', 9, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n7u1d10', 7, 'n7u1', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n7u1d11', 7, 'n7u1', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u1d12', 7, 'n7u1', 12, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n7u1final', 7, 'n7u1', 13, 'Desafio da unidade', 'desafio_final', 114, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"for_time","series":1,"reps_alvo":12,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"for_time","series":1,"reps_alvo":40,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"for_time","series":1,"reps_alvo":40,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n7u2d01', 7, 'n7u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n7u2d02', 7, 'n7u2', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n7u2d03', 7, 'n7u2', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u2d04', 7, 'n7u2', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n7u2d05', 7, 'n7u2', 5, 'Força de pernas', 'forca', 285, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u2d06', 7, 'n7u2', 6, 'Força de tronco e braços', 'forca', 234, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u2d07', 7, 'n7u2', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u2d08', 7, 'n7u2', 8, 'Condicionamento', 'condicionamento', 285, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":2,"esforco_s":45,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":45,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n7u2d09', 7, 'n7u2', 9, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n7u2d10', 7, 'n7u2', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n7u2d11', 7, 'n7u2', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u2d12', 7, 'n7u2', 12, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n7u2final', 7, 'n7u2', 13, 'Desafio da unidade', 'desafio_final', 180, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":5,"reps_alvo":[4,8,12,16,20],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n7u3d01', 7, 'n7u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n7u3d02', 7, 'n7u3', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n7u3d03', 7, 'n7u3', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u3d04', 7, 'n7u3', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n7u3d05', 7, 'n7u3', 5, 'Força de pernas', 'forca', 256, 'media', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"bom_dia_bastao","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u3d06', 7, 'n7u3', 6, 'Força de tronco e braços', 'forca', 256, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u3d07', 7, 'n7u3', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n7u3d08', 7, 'n7u3', 8, 'Condicionamento', 'condicionamento', 236, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n7u3d09', 7, 'n7u3', 9, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n7u3d10', 7, 'n7u3', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n7u3d11', 7, 'n7u3', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n7u3d12', 7, 'n7u3', 12, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n7u3final', 7, 'n7u3', 13, 'Desafio da unidade', 'desafio_final', 276, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"prancha","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":0,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"reps","series":3,"reps_alvo":20,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n8u1d01', 8, 'n8u1', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":5,"max":8}}]}'::jsonb),
  ('n8u1d02', 8, 'n8u1', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n8u1d03', 8, 'n8u1', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u1d04', 8, 'n8u1', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n8u1d05', 8, 'n8u1', 5, 'Força de pernas', 'forca', 285, 'media', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u1d06', 8, 'n8u1', 6, 'Força de tronco e braços', 'forca', 234, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u1d07', 8, 'n8u1', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u1d08', 8, 'n8u1', 8, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n8u1d09', 8, 'n8u1', 9, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n8u1d10', 8, 'n8u1', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n8u1d11', 8, 'n8u1', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u1d12', 8, 'n8u1', 12, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n8u1final', 8, 'n8u1', 13, 'Desafio da unidade', 'desafio_final', 161, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"for_time","series":1,"reps_alvo":16,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"flexao_braco","metodo":"for_time","series":1,"reps_alvo":16,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"for_time","series":1,"reps_alvo":30,"pausa_s":0,"score":"tempo_total","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n8u2d01', 8, 'n8u2', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":12,"max":18}}]}'::jsonb),
  ('n8u2d02', 8, 'n8u2', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n8u2d03', 8, 'n8u2', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":4,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u2d04', 8, 'n8u2', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n8u2d05', 8, 'n8u2', 5, 'Força de pernas', 'forca', 285, 'media', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"bom_dia_bastao","metodo":"reps","series":2,"reps_alvo":15,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u2d06', 8, 'n8u2', 6, 'Força de tronco e braços', 'forca', 234, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":30,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"},{"exercicio_id":"flexao_braco","metodo":"reps","series":2,"reps_alvo":12,"pausa_s":30,"score":"reps_por_serie","pse_alvo":7,"cadencia":"3-0-1-0","adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u2d07', 8, 'n8u2', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u2d08', 8, 'n8u2', 8, 'Condicionamento', 'condicionamento', 285, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":2,"esforco_s":45,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"polichinelo","metodo":"amrap","series":3,"esforco_s":45,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n8u2d09', 8, 'n8u2', 9, 'HIIT', 'hiit', 230, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"skipping","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"mountain_climber","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"polichinelo","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n8u2d10', 8, 'n8u2', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3},{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n8u2d11', 8, 'n8u2', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u2d12', 8, 'n8u2', 12, 'Volta à calma e respiração', 'respiracao', 240, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":240,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n8u2final', 8, 'n8u2', 13, 'Desafio da unidade', 'desafio_final', 180, 'media', null, false, false, 'final', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"reps","series":5,"reps_alvo":[4,8,12,16,20],"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}],"teto_s":240}'::jsonb),
  ('n8u3d01', 8, 'n8u3', 1, 'Aquecimento', 'aquecimento', 230, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":20,"max":30}},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":3,"faixa":{"min":30,"max":45}}]}'::jsonb),
  ('n8u3d02', 8, 'n8u3', 2, 'Mobilidade articular', 'mobilidade', 195, 'baixa', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"elevacao_bracos_y","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"}]}'::jsonb),
  ('n8u3d03', 8, 'n8u3', 3, 'Equilíbrio', 'equilibrio', 190, 'baixa', null, true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"},{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":10,"score":"tempo_valido","pse_alvo":4,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u3d04', 8, 'n8u3', 4, 'Precisão', 'precisao', 205, 'media', null, false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":40,"pausa_s":15,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":4}]}'::jsonb),
  ('n8u3d05', 8, 'n8u3', 5, 'Força de pernas', 'forca', 256, 'media', 'cabo_vassoura', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"bom_dia_bastao","metodo":"emom","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u3d06', 8, 'n8u3', 6, 'Força de tronco e braços', 'forca', 256, 'media', 'tapete', true, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"flexao_braco","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"},{"exercicio_id":"ponte_gluteo","metodo":"emom","series":2,"reps_alvo":10,"pausa_s":0,"score":"reps_por_serie","pse_alvo":7,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u3d07', 8, 'n8u3', 7, 'CORE', 'core', 280, 'media', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":20,"score":"tempo_valido","pse_alvo":6,"adm":"completa","acao":"isometrica"},{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":20,"score":"total_reps","pse_alvo":6,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('n8u3d08', 8, 'n8u3', 8, 'Condicionamento', 'condicionamento', 236, 'alta', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":0,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb),
  ('n8u3d09', 8, 'n8u3', 9, 'HIIT', 'hiit', 230, 'alta', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"polichinelo","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"agachamento_livre","metodo":"tabata","series":3,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8},{"exercicio_id":"skipping","metodo":"tabata","series":2,"esforco_s":20,"pausa_s":10,"score":"total_reps","adm":"completa","acao":"mista","pse_alvo":8}]}'::jsonb),
  ('n8u3d10', 8, 'n8u3', 10, 'Mobilidade dinâmica', 'mobilidade', 185, 'baixa', 'cabo_vassoura', false, true, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"reps","series":2,"reps_alvo":10,"pausa_s":15,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":3,"cadencia":"3-0-3-0"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","adm":"completa","acao":"isometrica","pse_alvo":3}]}'::jsonb),
  ('n8u3d11', 8, 'n8u3', 11, 'Yoga e alongamento', 'yoga', 280, 'baixa', 'tapete', false, false, 'desafio', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":10,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"},{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":40,"pausa_s":5,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('n8u3d12', 8, 'n8u3', 12, 'Volta à calma e respiração', 'respiracao', 250, 'baixa', null, false, false, 'desafio', null, '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":0,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":1,"esforco_s":60,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"},{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":1,"esforco_s":180,"pausa_s":0,"score":"tempo_valido","pse_alvo":2,"acao":"isometrica"}]}'::jsonb),
  ('n8u3final', 8, 'n8u3', 13, 'Desafio da unidade', 'desafio_final', 281, 'media', 'tapete', false, false, 'final', null, '{"versao":2,"organizacao":"alternada","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"reps","series":2,"reps_alvo":8,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"mountain_climber","metodo":"reps","series":3,"reps_alvo":40,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7},{"exercicio_id":"skipping","metodo":"reps","series":3,"reps_alvo":40,"pausa_s":0,"score":"reps_por_serie","adm":"completa","acao":"mista","pse_alvo":7}]}'::jsonb)
on conflict (id) do update set ordem = excluded.ordem, titulo = excluded.titulo, modalidade = excluded.modalidade,
  duracao_s = excluded.duracao_s, intensidade = excluded.intensidade, equipamento = excluded.equipamento, tipo = excluded.tipo,
  metodo = excluded.metodo, estrutura = excluded.estrutura;

insert into public.challenge_blocks (id, challenge_id, ordem, exercise_id, formato, series, parametros_por_dificuldade, descanso_s) values
  ('n1u1d01b1', 'n1u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u1d01b2', 'n1u1d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u1d02b1', 'n1u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n1u1d02b2', 'n1u1d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n1u1d03b1', 'n1u1d03', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 60),
  ('n1u1d04b1', 'n1u1d04', 1, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u1d04b2', 'n1u1d04', 2, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u1d05b1', 'n1u1d05', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u1d05b2', 'n1u1d05', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u1d06b1', 'n1u1d06', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u1d06b2', 'n1u1d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u1d06b3', 'n1u1d06', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n1u1d07b1', 'n1u1d07', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u1d07b2', 'n1u1d07', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u1d07b3', 'n1u1d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u1d08b1', 'n1u1d08', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n1u1finalb1', 'n1u1final', 1, 'agachamento_livre', 'repeticoes', 1, '{"padrao":{"segundos":30}}'::jsonb, 0),
  ('n1u1finalb2', 'n1u1final', 2, 'ponte_gluteo', 'repeticoes', 1, '{"padrao":{"segundos":30}}'::jsonb, 0),
  ('n1u1finalb3', 'n1u1final', 3, 'skipping', 'repeticoes', 1, '{"padrao":{"segundos":24}}'::jsonb, 0),
  ('n1u2d01b1', 'n1u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u2d01b2', 'n1u2d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u2d02b1', 'n1u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n1u2d02b2', 'n1u2d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n1u2d03b1', 'n1u2d03', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 60),
  ('n1u2d03b2', 'n1u2d03', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 60),
  ('n1u2d04b1', 'n1u2d04', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u2d04b2', 'n1u2d04', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u2d05b1', 'n1u2d05', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n1u2d05b2', 'n1u2d05', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n1u2d06b1', 'n1u2d06', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u2d06b2', 'n1u2d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u2d06b3', 'n1u2d06', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n1u2d07b1', 'n1u2d07', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u2d07b2', 'n1u2d07', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u2d07b3', 'n1u2d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u2d08b1', 'n1u2d08', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u2d08b2', 'n1u2d08', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n1u2finalb1', 'n1u2final', 1, 'afundo_alternado', 'repeticoes', 4, '{"padrao":{"segundos":70}}'::jsonb, 0),
  ('n1u3d01b1', 'n1u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u3d01b2', 'n1u3d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n1u3d02b1', 'n1u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n1u3d02b2', 'n1u3d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n1u3d03b1', 'n1u3d03', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n1u3d03b2', 'n1u3d03', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n1u3d04b1', 'n1u3d04', 1, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u3d04b2', 'n1u3d04', 2, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n1u3d05b1', 'n1u3d05', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u3d05b2', 'n1u3d05', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u3d06b1', 'n1u3d06', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u3d06b2', 'n1u3d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u3d06b3', 'n1u3d06', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n1u3d07b1', 'n1u3d07', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u3d07b2', 'n1u3d07', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u3d07b3', 'n1u3d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n1u3d08b1', 'n1u3d08', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n1u3finalb1', 'n1u3final', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":54}}'::jsonb, 0),
  ('n1u3finalb2', 'n1u3final', 2, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n1u3finalb3', 'n1u3final', 3, 'polichinelo', 'repeticoes', 3, '{"padrao":{"segundos":63}}'::jsonb, 0),
  ('n2u1d01b1', 'n2u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u1d01b2', 'n2u1d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u1d02b1', 'n2u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n2u1d02b2', 'n2u1d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n2u1d03b1', 'n2u1d03', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 60),
  ('n2u1d03b2', 'n2u1d03', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 60),
  ('n2u1d04b1', 'n2u1d04', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u1d04b2', 'n2u1d04', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u1d05b1', 'n2u1d05', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u1d05b2', 'n2u1d05', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u1d06b1', 'n2u1d06', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u1d06b2', 'n2u1d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u1d06b3', 'n2u1d06', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n2u1d07b1', 'n2u1d07', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u1d07b2', 'n2u1d07', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u1d07b3', 'n2u1d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u1d08b1', 'n2u1d08', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u1d08b2', 'n2u1d08', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n2u1finalb1', 'n2u1final', 1, 'afundo_alternado', 'repeticoes', 1, '{"padrao":{"segundos":28}}'::jsonb, 0),
  ('n2u1finalb2', 'n2u1final', 2, 'prancha', 'isometria', 1, '{"padrao":{"segundos":30}}'::jsonb, 0),
  ('n2u1finalb3', 'n2u1final', 3, 'polichinelo', 'repeticoes', 1, '{"padrao":{"segundos":30}}'::jsonb, 0),
  ('n2u2d01b1', 'n2u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u2d01b2', 'n2u2d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u2d02b1', 'n2u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n2u2d02b2', 'n2u2d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n2u2d03b1', 'n2u2d03', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 60),
  ('n2u2d03b2', 'n2u2d03', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 60),
  ('n2u2d04b1', 'n2u2d04', 1, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u2d04b2', 'n2u2d04', 2, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u2d05b1', 'n2u2d05', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n2u2d05b2', 'n2u2d05', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n2u2d06b1', 'n2u2d06', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u2d06b2', 'n2u2d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u2d06b3', 'n2u2d06', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n2u2d07b1', 'n2u2d07', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u2d07b2', 'n2u2d07', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u2d07b3', 'n2u2d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u2d08b1', 'n2u2d08', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n2u2finalb1', 'n2u2final', 1, 'agachamento_livre', 'repeticoes', 4, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u3d01b1', 'n2u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u3d01b2', 'n2u3d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n2u3d02b1', 'n2u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":42}}'::jsonb, 15),
  ('n2u3d02b2', 'n2u3d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":40}}'::jsonb, 15),
  ('n2u3d03b1', 'n2u3d03', 1, 'agachamento_livre', 'repeticoes', 4, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n2u3d04b1', 'n2u3d04', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u3d04b2', 'n2u3d04', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 20),
  ('n2u3d05b1', 'n2u3d05', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u3d05b2', 'n2u3d05', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u3d06b1', 'n2u3d06', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u3d06b2', 'n2u3d06', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u3d06b3', 'n2u3d06', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n2u3d07b1', 'n2u3d07', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u3d07b2', 'n2u3d07', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u3d07b3', 'n2u3d07', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n2u3d08b1', 'n2u3d08', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n2u3d08b2', 'n2u3d08', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n2u3finalb1', 'n2u3final', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":54}}'::jsonb, 0),
  ('n2u3finalb2', 'n2u3final', 2, 'ponte_gluteo', 'repeticoes', 3, '{"padrao":{"segundos":54}}'::jsonb, 0),
  ('n2u3finalb3', 'n2u3final', 3, 'skipping', 'repeticoes', 3, '{"padrao":{"segundos":62}}'::jsonb, 0),
  ('n3u1d01b1', 'n3u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u1d01b2', 'n3u1d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u1d02b1', 'n3u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n3u1d02b2', 'n3u1d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n3u1d03b1', 'n3u1d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":100}}'::jsonb, 10),
  ('n3u1d04b1', 'n3u1d04', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n3u1d04b2', 'n3u1d04', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 45),
  ('n3u1d05b1', 'n3u1d05', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n3u1d05b2', 'n3u1d05', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n3u1d06b1', 'n3u1d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u1d06b2', 'n3u1d06', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u1d07b1', 'n3u1d07', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n3u1d07b2', 'n3u1d07', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n3u1d08b1', 'n3u1d08', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u1d08b2', 'n3u1d08', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u1d08b3', 'n3u1d08', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n3u1d09b1', 'n3u1d09', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u1d09b2', 'n3u1d09', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u1d09b3', 'n3u1d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u1d10b1', 'n3u1d10', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n3u1finalb1', 'n3u1final', 1, 'agachamento_livre', 'repeticoes', 1, '{"padrao":{"segundos":36}}'::jsonb, 0),
  ('n3u1finalb2', 'n3u1final', 2, 'prancha', 'isometria', 1, '{"padrao":{"segundos":35}}'::jsonb, 0),
  ('n3u1finalb3', 'n3u1final', 3, 'polichinelo', 'repeticoes', 1, '{"padrao":{"segundos":36}}'::jsonb, 0),
  ('n3u2d01b1', 'n3u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u2d01b2', 'n3u2d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u2d02b1', 'n3u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n3u2d02b2', 'n3u2d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n3u2d03b1', 'n3u2d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n3u2d03b2', 'n3u2d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n3u2d04b1', 'n3u2d04', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":90}}'::jsonb, 45),
  ('n3u2d05b1', 'n3u2d05', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n3u2d05b2', 'n3u2d05', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n3u2d06b1', 'n3u2d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u2d06b2', 'n3u2d06', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u2d07b1', 'n3u2d07', 1, 'mountain_climber', 'amrap', 2, '{"padrao":{"segundos":80}}'::jsonb, 20),
  ('n3u2d07b2', 'n3u2d07', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('n3u2d08b1', 'n3u2d08', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u2d08b2', 'n3u2d08', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u2d08b3', 'n3u2d08', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n3u2d09b1', 'n3u2d09', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u2d09b2', 'n3u2d09', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u2d09b3', 'n3u2d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u2d10b1', 'n3u2d10', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n3u2d10b2', 'n3u2d10', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n3u2finalb1', 'n3u2final', 1, 'afundo_alternado', 'repeticoes', 5, '{"padrao":{"segundos":105}}'::jsonb, 0),
  ('n3u3d01b1', 'n3u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u3d01b2', 'n3u3d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n3u3d02b1', 'n3u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n3u3d02b2', 'n3u3d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n3u3d03b1', 'n3u3d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n3u3d03b2', 'n3u3d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n3u3d04b1', 'n3u3d04', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n3u3d04b2', 'n3u3d04', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n3u3d05b1', 'n3u3d05', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n3u3d05b2', 'n3u3d05', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n3u3d06b1', 'n3u3d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u3d06b2', 'n3u3d06', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n3u3d07b1', 'n3u3d07', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n3u3d07b2', 'n3u3d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n3u3d08b1', 'n3u3d08', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u3d08b2', 'n3u3d08', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u3d08b3', 'n3u3d08', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n3u3d09b1', 'n3u3d09', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u3d09b2', 'n3u3d09', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u3d09b3', 'n3u3d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n3u3d10b1', 'n3u3d10', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n3u3finalb1', 'n3u3final', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n3u3finalb2', 'n3u3final', 2, 'flexao_braco', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n3u3finalb3', 'n3u3final', 3, 'polichinelo', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n4u1d01b1', 'n4u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u1d01b2', 'n4u1d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u1d02b1', 'n4u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n4u1d02b2', 'n4u1d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n4u1d03b1', 'n4u1d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n4u1d03b2', 'n4u1d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n4u1d04b1', 'n4u1d04', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":90}}'::jsonb, 45),
  ('n4u1d05b1', 'n4u1d05', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n4u1d05b2', 'n4u1d05', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n4u1d06b1', 'n4u1d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u1d06b2', 'n4u1d06', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u1d07b1', 'n4u1d07', 1, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n4u1d07b2', 'n4u1d07', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n4u1d08b1', 'n4u1d08', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u1d08b2', 'n4u1d08', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u1d08b3', 'n4u1d08', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n4u1d09b1', 'n4u1d09', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u1d09b2', 'n4u1d09', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u1d09b3', 'n4u1d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u1d10b1', 'n4u1d10', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n4u1d10b2', 'n4u1d10', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n4u1finalb1', 'n4u1final', 1, 'afundo_alternado', 'repeticoes', 1, '{"padrao":{"segundos":35}}'::jsonb, 0),
  ('n4u1finalb2', 'n4u1final', 2, 'mountain_climber', 'repeticoes', 1, '{"padrao":{"segundos":28}}'::jsonb, 0),
  ('n4u1finalb3', 'n4u1final', 3, 'skipping', 'repeticoes', 1, '{"padrao":{"segundos":24}}'::jsonb, 0),
  ('n4u2d01b1', 'n4u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u2d01b2', 'n4u2d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u2d02b1', 'n4u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n4u2d02b2', 'n4u2d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n4u2d03b1', 'n4u2d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n4u2d03b2', 'n4u2d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":50}}'::jsonb, 10),
  ('n4u2d04b1', 'n4u2d04', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 45),
  ('n4u2d04b2', 'n4u2d04', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n4u2d05b1', 'n4u2d05', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n4u2d05b2', 'n4u2d05', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":48}}'::jsonb, 45),
  ('n4u2d06b1', 'n4u2d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u2d06b2', 'n4u2d06', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u2d07b1', 'n4u2d07', 1, 'polichinelo', 'amrap', 2, '{"padrao":{"segundos":80}}'::jsonb, 20),
  ('n4u2d07b2', 'n4u2d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('n4u2d08b1', 'n4u2d08', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u2d08b2', 'n4u2d08', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u2d08b3', 'n4u2d08', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n4u2d09b1', 'n4u2d09', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u2d09b2', 'n4u2d09', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u2d09b3', 'n4u2d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u2d10b1', 'n4u2d10', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n4u2finalb1', 'n4u2final', 1, 'agachamento_livre', 'repeticoes', 5, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n4u3d01b1', 'n4u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u3d01b2', 'n4u3d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n4u3d02b1', 'n4u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n4u3d02b2', 'n4u3d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":50}}'::jsonb, 15),
  ('n4u3d03b1', 'n4u3d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":100}}'::jsonb, 10),
  ('n4u3d04b1', 'n4u3d04', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n4u3d04b2', 'n4u3d04', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n4u3d05b1', 'n4u3d05', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n4u3d05b2', 'n4u3d05', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n4u3d06b1', 'n4u3d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u3d06b2', 'n4u3d06', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 20),
  ('n4u3d07b1', 'n4u3d07', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n4u3d07b2', 'n4u3d07', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n4u3d08b1', 'n4u3d08', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u3d08b2', 'n4u3d08', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u3d08b3', 'n4u3d08', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n4u3d09b1', 'n4u3d09', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u3d09b2', 'n4u3d09', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u3d09b3', 'n4u3d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n4u3d10b1', 'n4u3d10', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n4u3d10b2', 'n4u3d10', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n4u3finalb1', 'n4u3final', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n4u3finalb2', 'n4u3final', 2, 'prancha', 'isometria', 3, '{"padrao":{"segundos":75}}'::jsonb, 0),
  ('n4u3finalb3', 'n4u3final', 3, 'polichinelo', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n5u1d01b1', 'n5u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u1d01b2', 'n5u1d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u1d02b1', 'n5u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n5u1d02b2', 'n5u1d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n5u1d03b1', 'n5u1d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u1d03b2', 'n5u1d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u1d04b1', 'n5u1d04', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":84}}'::jsonb, 45),
  ('n5u1d04b2', 'n5u1d04', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 45),
  ('n5u1d05b1', 'n5u1d05', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n5u1d05b2', 'n5u1d05', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n5u1d06b1', 'n5u1d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u1d06b2', 'n5u1d06', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u1d07b1', 'n5u1d07', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n5u1d07b2', 'n5u1d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n5u1d08b1', 'n5u1d08', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u1d08b2', 'n5u1d08', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u1d08b3', 'n5u1d08', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n5u1d09b1', 'n5u1d09', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u1d09b2', 'n5u1d09', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u1d09b3', 'n5u1d09', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u1d10b1', 'n5u1d10', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n5u1finalb1', 'n5u1final', 1, 'agachamento_livre', 'repeticoes', 1, '{"padrao":{"segundos":42}}'::jsonb, 0),
  ('n5u1finalb2', 'n5u1final', 2, 'flexao_braco', 'repeticoes', 1, '{"padrao":{"segundos":42}}'::jsonb, 0),
  ('n5u1finalb3', 'n5u1final', 3, 'polichinelo', 'repeticoes', 1, '{"padrao":{"segundos":39}}'::jsonb, 0),
  ('n5u2d01b1', 'n5u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u2d01b2', 'n5u2d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u2d02b1', 'n5u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n5u2d02b2', 'n5u2d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n5u2d03b1', 'n5u2d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":120}}'::jsonb, 10),
  ('n5u2d04b1', 'n5u2d04', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 45),
  ('n5u2d04b2', 'n5u2d04', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":84}}'::jsonb, 45),
  ('n5u2d05b1', 'n5u2d05', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n5u2d05b2', 'n5u2d05', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n5u2d06b1', 'n5u2d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u2d06b2', 'n5u2d06', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u2d07b1', 'n5u2d07', 1, 'skipping', 'amrap', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n5u2d07b2', 'n5u2d07', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('n5u2d08b1', 'n5u2d08', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u2d08b2', 'n5u2d08', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u2d08b3', 'n5u2d08', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n5u2d09b1', 'n5u2d09', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u2d09b2', 'n5u2d09', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u2d09b3', 'n5u2d09', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u2d10b1', 'n5u2d10', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n5u2d10b2', 'n5u2d10', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n5u2finalb1', 'n5u2final', 1, 'agachamento_livre', 'repeticoes', 5, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n5u3d01b1', 'n5u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u3d01b2', 'n5u3d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n5u3d02b1', 'n5u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n5u3d02b2', 'n5u3d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n5u3d03b1', 'n5u3d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u3d03b2', 'n5u3d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u3d04b1', 'n5u3d04', 1, 'agachamento_livre', 'repeticoes', 4, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n5u3d05b1', 'n5u3d05', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n5u3d05b2', 'n5u3d05', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n5u3d06b1', 'n5u3d06', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u3d06b2', 'n5u3d06', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n5u3d07b1', 'n5u3d07', 1, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n5u3d07b2', 'n5u3d07', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n5u3d08b1', 'n5u3d08', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u3d08b2', 'n5u3d08', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n5u3d08b3', 'n5u3d08', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n5u3d09b1', 'n5u3d09', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u3d09b2', 'n5u3d09', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u3d09b3', 'n5u3d09', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n5u3d10b1', 'n5u3d10', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n5u3finalb1', 'n5u3final', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 0),
  ('n5u3finalb2', 'n5u3final', 2, 'mountain_climber', 'repeticoes', 3, '{"padrao":{"segundos":84}}'::jsonb, 0),
  ('n5u3finalb3', 'n5u3final', 3, 'skipping', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0),
  ('n6u1d01b1', 'n6u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u1d01b2', 'n6u1d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u1d02b1', 'n6u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u1d02b2', 'n6u1d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u1d03b1', 'n6u1d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":120}}'::jsonb, 10),
  ('n6u1d04b1', 'n6u1d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n6u1d05b1', 'n6u1d05', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 45),
  ('n6u1d05b2', 'n6u1d05', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":84}}'::jsonb, 45),
  ('n6u1d06b1', 'n6u1d06', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n6u1d06b2', 'n6u1d06', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n6u1d07b1', 'n6u1d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u1d07b2', 'n6u1d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u1d08b1', 'n6u1d08', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n6u1d08b2', 'n6u1d08', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n6u1d09b1', 'n6u1d09', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u1d09b2', 'n6u1d09', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u1d09b3', 'n6u1d09', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n6u1d10b1', 'n6u1d10', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u1d10b2', 'n6u1d10', 2, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u1d11b1', 'n6u1d11', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u1d11b2', 'n6u1d11', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u1d11b3', 'n6u1d11', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u1d12b1', 'n6u1d12', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n6u1d12b2', 'n6u1d12', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n6u1finalb1', 'n6u1final', 1, 'agachamento_livre', 'repeticoes', 1, '{"padrao":{"segundos":42}}'::jsonb, 0),
  ('n6u1finalb2', 'n6u1final', 2, 'prancha', 'isometria', 1, '{"padrao":{"segundos":40}}'::jsonb, 0),
  ('n6u1finalb3', 'n6u1final', 3, 'polichinelo', 'repeticoes', 1, '{"padrao":{"segundos":39}}'::jsonb, 0),
  ('n6u2d01b1', 'n6u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u2d01b2', 'n6u2d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u2d02b1', 'n6u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u2d02b2', 'n6u2d02', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u2d03b1', 'n6u2d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u2d03b2', 'n6u2d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u2d04b1', 'n6u2d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n6u2d05b1', 'n6u2d05', 1, 'agachamento_livre', 'repeticoes', 3, '{"padrao":{"segundos":108}}'::jsonb, 45),
  ('n6u2d06b1', 'n6u2d06', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n6u2d06b2', 'n6u2d06', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 45),
  ('n6u2d07b1', 'n6u2d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u2d07b2', 'n6u2d07', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u2d08b1', 'n6u2d08', 1, 'mountain_climber', 'amrap', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n6u2d08b2', 'n6u2d08', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('n6u2d09b1', 'n6u2d09', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u2d09b2', 'n6u2d09', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u2d09b3', 'n6u2d09', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n6u2d10b1', 'n6u2d10', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u2d10b2', 'n6u2d10', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u2d11b1', 'n6u2d11', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u2d11b2', 'n6u2d11', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u2d11b3', 'n6u2d11', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u2d12b1', 'n6u2d12', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n6u2finalb1', 'n6u2final', 1, 'afundo_alternado', 'repeticoes', 5, '{"padrao":{"segundos":140}}'::jsonb, 0),
  ('n6u3d01b1', 'n6u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u3d01b2', 'n6u3d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n6u3d02b1', 'n6u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u3d02b2', 'n6u3d02', 2, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u3d03b1', 'n6u3d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u3d03b2', 'n6u3d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u3d04b1', 'n6u3d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n6u3d05b1', 'n6u3d05', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n6u3d05b2', 'n6u3d05', 2, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n6u3d06b1', 'n6u3d06', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n6u3d06b2', 'n6u3d06', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n6u3d07b1', 'n6u3d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u3d07b2', 'n6u3d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n6u3d08b1', 'n6u3d08', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n6u3d08b2', 'n6u3d08', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n6u3d09b1', 'n6u3d09', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u3d09b2', 'n6u3d09', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n6u3d09b3', 'n6u3d09', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n6u3d10b1', 'n6u3d10', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n6u3d10b2', 'n6u3d10', 2, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 15),
  ('n6u3d11b1', 'n6u3d11', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u3d11b2', 'n6u3d11', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u3d11b3', 'n6u3d11', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n6u3d12b1', 'n6u3d12', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n6u3d12b2', 'n6u3d12', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n6u3finalb1', 'n6u3final', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n6u3finalb2', 'n6u3final', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n6u3finalb3', 'n6u3final', 3, 'polichinelo', 'repeticoes', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n7u1d01b1', 'n7u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u1d01b2', 'n7u1d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u1d02b1', 'n7u1d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n7u1d02b2', 'n7u1d02', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u1d03b1', 'n7u1d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n7u1d03b2', 'n7u1d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n7u1d04b1', 'n7u1d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n7u1d05b1', 'n7u1d05', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":105}}'::jsonb, 30),
  ('n7u1d05b2', 'n7u1d05', 2, 'bom_dia_bastao', 'repeticoes', 2, '{"padrao":{"segundos":105}}'::jsonb, 30),
  ('n7u1d06b1', 'n7u1d06', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n7u1d06b2', 'n7u1d06', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n7u1d07b1', 'n7u1d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u1d07b2', 'n7u1d07', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u1d08b1', 'n7u1d08', 1, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n7u1d08b2', 'n7u1d08', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n7u1d09b1', 'n7u1d09', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u1d09b2', 'n7u1d09', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u1d09b3', 'n7u1d09', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n7u1d10b1', 'n7u1d10', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n7u1d10b2', 'n7u1d10', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u1d11b1', 'n7u1d11', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u1d11b2', 'n7u1d11', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u1d11b3', 'n7u1d11', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u1d12b1', 'n7u1d12', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n7u1finalb1', 'n7u1final', 1, 'afundo_alternado', 'repeticoes', 1, '{"padrao":{"segundos":42}}'::jsonb, 0),
  ('n7u1finalb2', 'n7u1final', 2, 'mountain_climber', 'repeticoes', 1, '{"padrao":{"segundos":28}}'::jsonb, 0),
  ('n7u1finalb3', 'n7u1final', 3, 'skipping', 'repeticoes', 1, '{"padrao":{"segundos":24}}'::jsonb, 0),
  ('n7u2d01b1', 'n7u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u2d01b2', 'n7u2d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u2d02b1', 'n7u2d02', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u2d02b2', 'n7u2d02', 2, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n7u2d03b1', 'n7u2d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n7u2d03b2', 'n7u2d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n7u2d04b1', 'n7u2d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n7u2d05b1', 'n7u2d05', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":90}}'::jsonb, 30),
  ('n7u2d05b2', 'n7u2d05', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":105}}'::jsonb, 30),
  ('n7u2d06b1', 'n7u2d06', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n7u2d06b2', 'n7u2d06', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n7u2d07b1', 'n7u2d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u2d07b2', 'n7u2d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u2d08b1', 'n7u2d08', 1, 'polichinelo', 'amrap', 2, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('n7u2d08b2', 'n7u2d08', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":135}}'::jsonb, 15),
  ('n7u2d09b1', 'n7u2d09', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u2d09b2', 'n7u2d09', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u2d09b3', 'n7u2d09', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n7u2d10b1', 'n7u2d10', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u2d10b2', 'n7u2d10', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n7u2d11b1', 'n7u2d11', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u2d11b2', 'n7u2d11', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u2d11b3', 'n7u2d11', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u2d12b1', 'n7u2d12', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n7u2d12b2', 'n7u2d12', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n7u2finalb1', 'n7u2final', 1, 'agachamento_livre', 'repeticoes', 5, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n7u3d01b1', 'n7u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u3d01b2', 'n7u3d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n7u3d02b1', 'n7u3d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n7u3d02b2', 'n7u3d02', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u3d03b1', 'n7u3d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":160}}'::jsonb, 10),
  ('n7u3d04b1', 'n7u3d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n7u3d05b1', 'n7u3d05', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n7u3d05b2', 'n7u3d05', 2, 'bom_dia_bastao', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n7u3d06b1', 'n7u3d06', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n7u3d06b2', 'n7u3d06', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n7u3d07b1', 'n7u3d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u3d07b2', 'n7u3d07', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n7u3d08b1', 'n7u3d08', 1, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n7u3d08b2', 'n7u3d08', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n7u3d09b1', 'n7u3d09', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u3d09b2', 'n7u3d09', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n7u3d09b3', 'n7u3d09', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n7u3d10b1', 'n7u3d10', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n7u3d10b2', 'n7u3d10', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n7u3d11b1', 'n7u3d11', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u3d11b2', 'n7u3d11', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u3d11b3', 'n7u3d11', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n7u3d12b1', 'n7u3d12', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n7u3finalb1', 'n7u3final', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n7u3finalb2', 'n7u3final', 2, 'prancha', 'isometria', 2, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n7u3finalb3', 'n7u3final', 3, 'polichinelo', 'repeticoes', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n8u1d01b1', 'n8u1d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u1d01b2', 'n8u1d01', 2, 'elevacao_bracos_y', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u1d02b1', 'n8u1d02', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u1d02b2', 'n8u1d02', 2, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n8u1d03b1', 'n8u1d03', 1, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n8u1d03b2', 'n8u1d03', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n8u1d04b1', 'n8u1d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n8u1d05b1', 'n8u1d05', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":90}}'::jsonb, 30),
  ('n8u1d05b2', 'n8u1d05', 2, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":105}}'::jsonb, 30),
  ('n8u1d06b1', 'n8u1d06', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n8u1d06b2', 'n8u1d06', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n8u1d07b1', 'n8u1d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u1d07b2', 'n8u1d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u1d08b1', 'n8u1d08', 1, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n8u1d08b2', 'n8u1d08', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n8u1d09b1', 'n8u1d09', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u1d09b2', 'n8u1d09', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u1d09b3', 'n8u1d09', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n8u1d10b1', 'n8u1d10', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u1d10b2', 'n8u1d10', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n8u1d11b1', 'n8u1d11', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u1d11b2', 'n8u1d11', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u1d11b3', 'n8u1d11', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u1d12b1', 'n8u1d12', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n8u1d12b2', 'n8u1d12', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n8u1finalb1', 'n8u1final', 1, 'agachamento_livre', 'repeticoes', 1, '{"padrao":{"segundos":48}}'::jsonb, 0),
  ('n8u1finalb2', 'n8u1final', 2, 'flexao_braco', 'repeticoes', 1, '{"padrao":{"segundos":48}}'::jsonb, 0),
  ('n8u1finalb3', 'n8u1final', 3, 'polichinelo', 'repeticoes', 1, '{"padrao":{"segundos":45}}'::jsonb, 0),
  ('n8u2d01b1', 'n8u2d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u2d01b2', 'n8u2d01', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u2d02b1', 'n8u2d02', 1, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n8u2d02b2', 'n8u2d02', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u2d03b1', 'n8u2d03', 1, 'apoio_uma_perna', 'equilibrio', 4, '{"padrao":{"segundos":160}}'::jsonb, 10),
  ('n8u2d04b1', 'n8u2d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n8u2d05b1', 'n8u2d05', 1, 'agachamento_livre', 'repeticoes', 2, '{"padrao":{"segundos":90}}'::jsonb, 30),
  ('n8u2d05b2', 'n8u2d05', 2, 'bom_dia_bastao', 'repeticoes', 2, '{"padrao":{"segundos":105}}'::jsonb, 30),
  ('n8u2d06b1', 'n8u2d06', 1, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n8u2d06b2', 'n8u2d06', 2, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":72}}'::jsonb, 30),
  ('n8u2d07b1', 'n8u2d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u2d07b2', 'n8u2d07', 2, 'ponte_gluteo', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u2d08b1', 'n8u2d08', 1, 'skipping', 'amrap', 2, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('n8u2d08b2', 'n8u2d08', 2, 'polichinelo', 'amrap', 3, '{"padrao":{"segundos":135}}'::jsonb, 15),
  ('n8u2d09b1', 'n8u2d09', 1, 'skipping', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u2d09b2', 'n8u2d09', 2, 'mountain_climber', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u2d09b3', 'n8u2d09', 3, 'polichinelo', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n8u2d10b1', 'n8u2d10', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n8u2d10b2', 'n8u2d10', 2, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u2d11b1', 'n8u2d11', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u2d11b2', 'n8u2d11', 2, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u2d11b3', 'n8u2d11', 3, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u2d12b1', 'n8u2d12', 1, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":240}}'::jsonb, 0),
  ('n8u2finalb1', 'n8u2final', 1, 'agachamento_livre', 'repeticoes', 5, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n8u3d01b1', 'n8u3d01', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u3d01b2', 'n8u3d01', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 10),
  ('n8u3d02b1', 'n8u3d02', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u3d02b2', 'n8u3d02', 2, 'elevacao_bracos_y', 'repeticoes', 2, '{"padrao":{"segundos":70}}'::jsonb, 15),
  ('n8u3d03b1', 'n8u3d03', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n8u3d03b2', 'n8u3d03', 2, 'apoio_uma_perna', 'equilibrio', 2, '{"padrao":{"segundos":80}}'::jsonb, 10),
  ('n8u3d04b1', 'n8u3d04', 1, 'toque_alvos', 'amrap', 4, '{"padrao":{"segundos":160}}'::jsonb, 15),
  ('n8u3d05b1', 'n8u3d05', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n8u3d05b2', 'n8u3d05', 2, 'bom_dia_bastao', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n8u3d06b1', 'n8u3d06', 1, 'flexao_braco', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n8u3d06b2', 'n8u3d06', 2, 'ponte_gluteo', 'repeticoes', 2, '{"padrao":{"segundos":120}}'::jsonb, 0),
  ('n8u3d07b1', 'n8u3d07', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u3d07b2', 'n8u3d07', 2, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 20),
  ('n8u3d08b1', 'n8u3d08', 1, 'mountain_climber', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n8u3d08b2', 'n8u3d08', 2, 'skipping', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 0),
  ('n8u3d09b1', 'n8u3d09', 1, 'polichinelo', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u3d09b2', 'n8u3d09', 2, 'agachamento_livre', 'intervalado', 3, '{"padrao":{"segundos":60}}'::jsonb, 10),
  ('n8u3d09b3', 'n8u3d09', 3, 'skipping', 'intervalado', 2, '{"padrao":{"segundos":40}}'::jsonb, 10),
  ('n8u3d10b1', 'n8u3d10', 1, 'agachamento_bastao', 'repeticoes', 2, '{"padrao":{"segundos":80}}'::jsonb, 15),
  ('n8u3d10b2', 'n8u3d10', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":60}}'::jsonb, 15),
  ('n8u3d11b1', 'n8u3d11', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u3d11b2', 'n8u3d11', 2, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u3d11b3', 'n8u3d11', 3, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":80}}'::jsonb, 5),
  ('n8u3d12b1', 'n8u3d12', 1, 'alongamento_posterior', 'isometria', 1, '{"padrao":{"segundos":60}}'::jsonb, 0),
  ('n8u3d12b2', 'n8u3d12', 2, 'respiracao_guiada', 'respiracao', 1, '{"padrao":{"segundos":180}}'::jsonb, 0),
  ('n8u3finalb1', 'n8u3final', 1, 'afundo_alternado', 'repeticoes', 2, '{"padrao":{"segundos":56}}'::jsonb, 0),
  ('n8u3finalb2', 'n8u3final', 2, 'mountain_climber', 'repeticoes', 3, '{"padrao":{"segundos":84}}'::jsonb, 0),
  ('n8u3finalb3', 'n8u3final', 3, 'skipping', 'repeticoes', 3, '{"padrao":{"segundos":72}}'::jsonb, 0)
on conflict (id) do update set exercise_id = excluded.exercise_id, formato = excluded.formato, series = excluded.series,
  parametros_por_dificuldade = excluded.parametros_por_dificuldade, descanso_s = excluded.descanso_s;

-- Blocos que sobraram de versões antigas do conteúdo.
delete from public.challenge_blocks b using public.challenges c
where b.challenge_id = c.id and c.estrutura is not null and b.ordem > jsonb_array_length(c.estrutura -> 'blocos')
  and not exists (select 1 from public.attempt_blocks ab where ab.challenge_block_id = b.id);

commit;
