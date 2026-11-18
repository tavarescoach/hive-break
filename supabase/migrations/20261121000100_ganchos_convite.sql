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
