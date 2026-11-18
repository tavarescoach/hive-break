-- Hive Break · Resgate: "fulano está há 3 dias sem break" (docs/RESGATE.md, seção 8)
--
-- Quando um amigo chama outro de volta. Duas tabelas: resgates (quem chamou
-- quem, com quê) e resgate_eventos (métricas da seção 9: pop-up mostrado,
-- dispensado, enviado, link aberto, voltou).

create table public.resgates (
  id bigint generated always as identity primary key,
  de_usuario_id uuid not null references public.profiles (id) on delete cascade,
  para_usuario_id uuid not null references public.profiles (id) on delete cascade,
  familia text not null check (familia in ('D', 'B', 'C')),
  gancho_id text not null,
  texto_final text not null check (char_length(texto_final) between 1 and 300),
  canal text not null check (canal in ('app', 'whatsapp', 'hive')),
  hive_id uuid references public.hives (id) on delete set null,
  enviado_em timestamptz not null default now(),
  voltou_em timestamptz,
  recompensa_dada boolean not null default false,
  check (de_usuario_id <> para_usuario_id)
);
create index resgates_para_idx on public.resgates (para_usuario_id, enviado_em desc);
create index resgates_de_idx on public.resgates (de_usuario_id, enviado_em desc);

create table public.resgate_eventos (
  id bigint generated always as identity primary key,
  resgate_id bigint references public.resgates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('rescue_prompt_shown', 'rescue_dismissed', 'rescue_sent', 'rescue_link_opened', 'rescue_returned')),
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index resgate_eventos_user_idx on public.resgate_eventos (user_id, tipo, criado_em desc);
create index resgate_eventos_resgate_idx on public.resgate_eventos (resgate_id);

alter table public.resgates enable row level security;
alter table public.resgate_eventos enable row level security;
revoke all on public.resgates, public.resgate_eventos from anon, authenticated;

-- Só os dois envolvidos leem (nunca aparece no feed, nunca para gestor: seção 7).
grant select on public.resgates to authenticated;
create policy "resgates: os dois leem" on public.resgates for select to authenticated
  using ((select auth.uid()) in (de_usuario_id, para_usuario_id));

grant select on public.resgate_eventos to authenticated;
create policy "eventos de resgate: dono le" on public.resgate_eventos for select to authenticated
  using (user_id = (select auth.uid()));

grant all on public.resgates, public.resgate_eventos to service_role;
