-- Hive Break · Funções do servidor da Fase 1 (cadastro, onboarding e convite)
-- Todas rodam como "security definer": validam e gravam os campos que o
-- cliente não pode alterar diretamente.

create function public.gerar_codigo_convite() returns text
language plpgsql volatile
set search_path = public, pg_temp
as $$
declare
  -- Sem I, O, 0 e 1, para não confundir quem digita.
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
begin
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where codigo_convite = codigo);
  end loop;
  return codigo;
end;
$$;

-- Conta nova no Auth cria o perfil, a ofensiva e as preferências de aviso.
create function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, nome, avatar_url, codigo_convite)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    public.gerar_codigo_convite()
  );
  insert into public.streaks (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.criar_perfil_novo_usuario();

-- Dificuldade inicial quando não há nivelamento (seção 3.1, passo 9).
-- Quem não está liberado para alta intensidade fica limitado a 3 (seção 6.5).
create function public.dificuldade_inicial(p_nivel_atividade text, p_liberado boolean) returns smallint
language sql immutable
set search_path = public, pg_temp
as $$
  select least(
    case p_nivel_atividade when 'ativo' then 5 when 'pouco_ativo' then 3 else 2 end,
    case when p_liberado then 10 else 3 end
  )::smallint;
$$;

-- Triagem PAR-Q+ simplificada: 7 respostas sim/não (chaves q1 a q7).
-- Qualquer "sim" limita a pessoa a baixa intensidade até ela declarar liberação.
create function public.registrar_triagem(p_respostas jsonb) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_algum_sim boolean := false;
  v_chave text;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_respostas)) <> 7 then
    raise exception 'triagem_invalida' using errcode = '22023';
  end if;
  foreach v_chave in array array['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] loop
    if jsonb_typeof(p_respostas -> v_chave) is distinct from 'boolean' then
      raise exception 'triagem_invalida' using errcode = '22023';
    end if;
    v_algum_sim := v_algum_sim or (p_respostas ->> v_chave)::boolean;
  end loop;

  insert into public.health_screenings (user_id, respostas, algum_sim)
  values (v_user, p_respostas, v_algum_sim);

  update public.profiles
  set liberado_alta_intensidade = not v_algum_sim,
      liberacao_declarada_em = null,
      dificuldade_atual = case when v_algum_sim then least(dificuldade_atual, 3) else dificuldade_atual end
  where id = v_user;

  return not v_algum_sim;
end;
$$;

-- Autodeclaração: "Meu médico me liberou para exercício intenso".
create function public.declarar_liberacao_medica() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.health_screenings where user_id = v_user) then
    raise exception 'triagem_pendente' using errcode = '22023';
  end if;
  update public.profiles
  set liberado_alta_intensidade = true, liberacao_declarada_em = now()
  where id = v_user;
end;
$$;

-- Compromisso inicial de ofensiva: 7, 14 ou 30 dias (seção 10.2).
create function public.definir_compromisso(p_dias integer) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_dias not in (7, 14, 30) then
    raise exception 'compromisso_invalido' using errcode = '22023';
  end if;
  update public.streaks set meta_compromisso = p_dias where user_id = v_user;
end;
$$;

-- Registra quem convidou. Só vale para conta nova (até 7 dias, onboarding não
-- concluído), uma única vez, e nunca para o próprio código.
create function public.registrar_convite(p_codigo text) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_quem_convidou uuid;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select id into v_quem_convidou from public.profiles where codigo_convite = upper(btrim(p_codigo));
  if v_quem_convidou is null or v_quem_convidou = v_user then
    return false;
  end if;

  update public.profiles
  set convidado_por = v_quem_convidou
  where id = v_user
    and convidado_por is null
    and onboarding_concluido_em is null
    and criado_em > now() - interval '7 days';
  if not found then
    return false;
  end if;

  insert into public.invites (inviter_id, invitee_id) values (v_quem_convidou, v_user)
  on conflict (invitee_id) do nothing;
  return true;
end;
$$;

-- Dados de quem convidou para a landing /c/[codigo]: só o que é público.
create function public.convite_publico(p_codigo text)
returns table (apelido text, avatar_url text, ofensiva integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(p.apelido, split_part(p.nome, ' ', 1), 'Alguém'), p.avatar_url, coalesce(s.atual, 0)
  from public.profiles p
  left join public.streaks s on s.user_id = p.id
  where p.codigo_convite = upper(btrim(p_codigo));
$$;

-- Fecha o onboarding: confere se tudo foi preenchido, define a dificuldade
-- inicial e libera o Nível 1. Devolve { ok, faltando: [...] }.
create function public.concluir_onboarding() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  v_faltando text[] := '{}';
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user;

  if (select count(distinct tipo) from public.consents where user_id = v_user) < 3 then
    v_faltando := array_append(v_faltando, 'termos');
  end if;
  if p.apelido is null or p.data_nascimento is null or p.sexo is null or p.altura_cm is null
     or p.peso_kg is null or p.objetivo is null or p.nivel_atividade is null or p.dias_semana is null
     or p.equipamentos is null then
    v_faltando := array_append(v_faltando, 'perfil');
  end if;
  if not exists (select 1 from public.health_screenings where user_id = v_user) then
    v_faltando := array_append(v_faltando, 'triagem');
  end if;
  if p.meta_desafios_dia is null
     or (select meta_compromisso from public.streaks where user_id = v_user) is null then
    v_faltando := array_append(v_faltando, 'meta');
  end if;
  if p.musica_estilo is null then
    v_faltando := array_append(v_faltando, 'musica');
  end if;

  if array_length(v_faltando, 1) > 0 then
    return jsonb_build_object('ok', false, 'faltando', to_jsonb(v_faltando));
  end if;

  if p.onboarding_concluido_em is null then
    update public.profiles
    set onboarding_concluido_em = now(),
        dificuldade_atual = public.dificuldade_inicial(p.nivel_atividade, p.liberado_alta_intensidade)
    where id = v_user;
    insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, 1, true)
    on conflict (user_id, level_id) do update set liberado = true;
  end if;
  return jsonb_build_object('ok', true, 'faltando', '[]'::jsonb);
end;
$$;

-- No Postgres toda função nasce executável por qualquer papel. Aqui se retira
-- tudo e se concede função por função. Toda migração nova que criar funções
-- precisa repetir este bloco.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.minhas_ligas() to authenticated;
grant execute on function public.registrar_triagem(jsonb) to authenticated;
grant execute on function public.declarar_liberacao_medica() to authenticated;
grant execute on function public.definir_compromisso(integer) to authenticated;
grant execute on function public.registrar_convite(text) to authenticated;
grant execute on function public.concluir_onboarding() to authenticated;
grant execute on function public.convite_publico(text) to anon, authenticated;
grant execute on all functions in schema public to service_role;
