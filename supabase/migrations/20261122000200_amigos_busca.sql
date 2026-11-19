-- Hive Break · Busca de amigos, seguir e bloquear (docs/PERFIL.md, seção 4)
--
-- "Seguir" é de mão única e sem aprovação por enquanto (seção 11, item 4):
-- toda linha nasce com status 'ativo'. A coluna existe pronta para quando a
-- aprovação entrar (perfil "só amigos"). "Amigo" (docs/PERFIL.md) passa a
-- valer por seguir mútuo OU por já ter uma amizade da seção 11.3 (convite
-- ativado ou código) — nada do que já existe se perde.

create extension if not exists pg_trgm;

alter table public.profiles add column aparecer_na_busca boolean not null default true;
grant update (aparecer_na_busca) on public.profiles to authenticated;

create index profiles_apelido_trgm_idx on public.profiles using gin (apelido gin_trgm_ops);
create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);

create table public.seguidores (
  seguidor_id uuid not null references public.profiles (id) on delete cascade,
  seguido_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo', 'pendente')),
  criado_em timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);
create index seguidores_seguido_idx on public.seguidores (seguido_id);

create table public.bloqueios (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  bloqueado_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, bloqueado_id),
  check (usuario_id <> bloqueado_id)
);
create index bloqueios_bloqueado_idx on public.bloqueios (bloqueado_id);

-- Contador leve para o limite de chamadas por minuto da busca. Sem RLS
-- exposta ao cliente: só a função buscar_usuarios grava e lê.
create table public.busca_log (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index busca_log_usuario_idx on public.busca_log (usuario_id, criado_em desc);

alter table public.seguidores enable row level security;
alter table public.bloqueios enable row level security;
alter table public.busca_log enable row level security;
revoke all on public.seguidores, public.bloqueios, public.busca_log from anon, authenticated;

grant select on public.seguidores to authenticated;
create policy "seguidores: os dois leem" on public.seguidores for select to authenticated
  using ((select auth.uid()) in (seguidor_id, seguido_id));

-- Só o bloqueador vê o próprio bloqueio (quem foi bloqueado não precisa saber).
grant select on public.bloqueios to authenticated;
create policy "bloqueios: dono le" on public.bloqueios for select to authenticated
  using (usuario_id = (select auth.uid()));

-- São amigos: seguem um ao outro, OU já têm uma amizade da seção 11.3
-- (convite ativado ou por código). Função para reusar nas próximas etapas
-- ("Vocês dois", vitrine de amigos em comum).
create function public.sao_amigos(p_a uuid, p_b uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select (
    exists (select 1 from public.seguidores where seguidor_id = p_a and seguido_id = p_b and status = 'ativo')
    and exists (select 1 from public.seguidores where seguidor_id = p_b and seguido_id = p_a and status = 'ativo')
  ) or exists (
    select 1 from public.friendships where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b)
  )
$$;

create function public.bloqueado_entre(p_a uuid, p_b uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bloqueios where (usuario_id = p_a and bloqueado_id = p_b) or (usuario_id = p_b and bloqueado_id = p_a)
  )
$$;

create function public.seguir_usuario(p_alvo uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  if p_alvo = v_user then
    raise exception 'nao_pode_seguir_a_si' using errcode = '22023';
  end if;
  if public.bloqueado_entre(v_user, p_alvo) then
    raise exception 'bloqueado' using errcode = '22023';
  end if;
  insert into public.seguidores (seguidor_id, seguido_id, status) values (v_user, p_alvo, 'ativo')
  on conflict (seguidor_id, seguido_id) do nothing;
  return 'ativo';
end;
$$;

create function public.deixar_de_seguir(p_alvo uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  delete from public.seguidores where seguidor_id = v_user and seguido_id = p_alvo;
end;
$$;

-- Bloquear desfaz o seguir nos dois sentidos (a pessoa some das suas listas e você das dela).
create function public.bloquear_usuario(p_alvo uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  if p_alvo = v_user then
    raise exception 'nao_pode_bloquear_a_si' using errcode = '22023';
  end if;
  insert into public.bloqueios (usuario_id, bloqueado_id) values (v_user, p_alvo) on conflict do nothing;
  delete from public.seguidores where (seguidor_id = v_user and seguido_id = p_alvo) or (seguidor_id = p_alvo and seguido_id = v_user);
end;
$$;

create function public.desbloquear_usuario(p_alvo uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  delete from public.bloqueios where usuario_id = v_user and bloqueado_id = p_alvo;
end;
$$;

-- Como o viewer está em relação a alguém: usado na busca, no perfil e nas listas.
create function public.relacao_com(p_user uuid, p_alvo uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'seguindo', exists (select 1 from public.seguidores where seguidor_id = p_user and seguido_id = p_alvo),
    'segue_voce', exists (select 1 from public.seguidores where seguidor_id = p_alvo and seguido_id = p_user),
    'bloqueei', exists (select 1 from public.bloqueios where usuario_id = p_user and bloqueado_id = p_alvo)
  )
$$;
grant execute on function public.relacao_com(uuid, uuid) to authenticated;

-- Busca por nome (apelido) ou @username, com pg_trgm. Exclui bloqueios (nos
-- dois sentidos) e quem desligou "aparecer na busca". Limite de 20
-- resultados e de chamadas por minuto (antifraude simples).
create function public.buscar_usuarios(p_q text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  v_q text := btrim(coalesce(p_q, ''));
  v_chamadas int;
begin
  if length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  select count(*) into v_chamadas from public.busca_log where usuario_id = v_user and criado_em > now() - interval '1 minute';
  if v_chamadas >= 30 then
    raise exception 'busca_muito_frequente' using errcode = '22023';
  end if;
  insert into public.busca_log (usuario_id) values (v_user);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'apelido', pr.apelido, 'username', pr.username, 'avatar_url', pr.avatar_url,
      'divisao_atual', pr.divisao_atual, 'objetivo', pr.objetivo,
      'ofensiva', coalesce(st.atual, 0),
      'amigos_em_comum', (
        select count(*) from public.seguidores s2
        where s2.seguido_id = pr.id and s2.status = 'ativo'
          and exists (select 1 from public.seguidores s3 where s3.seguidor_id = v_user and s3.seguido_id = s2.seguidor_id)
      ),
      'seguindo', exists (select 1 from public.seguidores where seguidor_id = v_user and seguido_id = pr.id),
      'segue_voce', exists (select 1 from public.seguidores where seguidor_id = pr.id and seguido_id = v_user)
    ) order by similarity(coalesce(pr.apelido, '') || ' ' || coalesce(pr.username, ''), v_q) desc)
    from public.profiles pr
    left join public.streaks st on st.user_id = pr.id
    where pr.id <> v_user
      and pr.onboarding_concluido_em is not null
      and pr.aparecer_na_busca
      and not public.bloqueado_entre(v_user, pr.id)
      and (pr.apelido ilike '%' || v_q || '%' or pr.username ilike '%' || v_q || '%'
           or similarity(coalesce(pr.apelido, '') || ' ' || coalesce(pr.username, ''), v_q) > 0.2)
    limit 20
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.buscar_usuarios(text) to authenticated;

-- Sugestões antes de digitar (seção 4.2): quem te segue e você não segue de
-- volta, e quem você convidou. "Amigos de amigos" e "mesma empresa" ficam
-- para quando existirem os dados que as sustentam (grafo maior / modo B2B).
create function public.sugestoes_busca() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := public.exigir_cadastro();
begin
  return coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'id', pr.id, 'apelido', pr.apelido, 'username', pr.username, 'avatar_url', pr.avatar_url,
        'divisao_atual', pr.divisao_atual, 'objetivo', pr.objetivo, 'ofensiva', coalesce(st.atual, 0),
        'amigos_em_comum', 0, 'seguindo', false, 'segue_voce', true
      ) as x, s.criado_em as ordem
      from public.seguidores s
      join public.profiles pr on pr.id = s.seguidor_id
      left join public.streaks st on st.user_id = pr.id
      where s.seguido_id = v_user and s.status = 'ativo' and pr.aparecer_na_busca
        and not exists (select 1 from public.seguidores where seguidor_id = v_user and seguido_id = pr.id)
        and not public.bloqueado_entre(v_user, pr.id)

      union all

      select jsonb_build_object(
        'id', pr.id, 'apelido', pr.apelido, 'username', pr.username, 'avatar_url', pr.avatar_url,
        'divisao_atual', pr.divisao_atual, 'objetivo', pr.objetivo, 'ofensiva', coalesce(st.atual, 0),
        'amigos_em_comum', 0,
        'seguindo', exists (select 1 from public.seguidores where seguidor_id = v_user and seguido_id = pr.id),
        'segue_voce', exists (select 1 from public.seguidores where seguidor_id = pr.id and seguido_id = v_user)
      ) as x, i.cadastrado_em as ordem
      from public.invites i
      join public.profiles pr on pr.id = i.invitee_id
      left join public.streaks st on st.user_id = pr.id
      where i.inviter_id = v_user and pr.aparecer_na_busca and not public.bloqueado_entre(v_user, pr.id)

      order by ordem desc
      limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.sugestoes_busca() to authenticated;

grant execute on function public.bloqueado_entre(uuid, uuid) to authenticated;
grant execute on function public.seguir_usuario(uuid) to authenticated;
grant execute on function public.deixar_de_seguir(uuid) to authenticated;
grant execute on function public.bloquear_usuario(uuid) to authenticated;
grant execute on function public.desbloquear_usuario(uuid) to authenticated;
