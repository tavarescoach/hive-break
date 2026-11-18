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
