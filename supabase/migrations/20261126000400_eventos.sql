-- Hive Break · Eventos do primeiro acesso (Etapa 1A do docs/PLANO_ETAPAS_UX.md)
--
-- Tabela nova, separada de eventos_visitante (migração 20261122000100_visitante.sql):
-- aquela tem uma lista fechada de tipos do funil de CONVERSÃO do visitante,
-- gravados só pelo servidor, sempre com um perfil já existente. Os eventos
-- daqui acontecem no navegador, antes de qualquer perfil existir (ftue_aberto
-- é a landing, sem login nenhum), então a função fica aberta para anon e
-- authenticated. Ver docs/DECISOES.md, seção "Etapa 1A".
create table public.eventos (
  id bigint generated always as identity primary key,
  -- Sem chave estrangeira: vale tanto para quem ainda não tem perfil (anon) quanto para o dono.
  usuario_id uuid,
  nome text not null check (nome in (
    'ftue_aberto', 'comecar_tocado', 'declaracao_aceita', 'camera_permitida', 'camera_negada',
    'preparo_iniciado', 'primeira_rep', 'desafio_concluido'
  )),
  props jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index eventos_nome_idx on public.eventos (nome, criado_em desc);
create index eventos_usuario_idx on public.eventos (usuario_id, criado_em desc);
alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;
grant all on public.eventos to service_role;

create function public.registrar_evento(p_nome text, p_props jsonb default '{}') returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.eventos (usuario_id, nome, props) values (auth.uid(), p_nome, coalesce(p_props, '{}'));
$$;
grant execute on function public.registrar_evento(text, jsonb) to anon, authenticated;
