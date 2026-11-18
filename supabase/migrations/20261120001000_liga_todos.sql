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
