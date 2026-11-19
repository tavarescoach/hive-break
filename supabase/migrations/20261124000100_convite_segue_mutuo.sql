-- Hive Break · Convite ativado faz os dois se seguirem (docs/PERFIL.md, seção 4.1)
--
-- "Convite ativado = os dois se seguem automaticamente" já era a regra
-- decidida, mas só criava a amizade antiga (friendships). Agora cria também
-- as duas linhas em seguidores, pra entrarem no feed e nas listas de
-- seguindo/seguidores — e continua reversível: ativar_convite só roda 1x por
-- convite, então deixar de seguir depois não volta a seguir sozinho.

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

  insert into public.seguidores (seguidor_id, seguido_id, status)
  values (i.inviter_id, i.invitee_id, 'ativo'), (i.invitee_id, i.inviter_id, 'ativo')
  on conflict (seguidor_id, seguido_id) do nothing;

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
