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
