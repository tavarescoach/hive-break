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
