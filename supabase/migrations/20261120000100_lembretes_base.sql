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
