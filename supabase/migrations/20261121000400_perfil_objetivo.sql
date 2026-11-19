-- Hive Break · Objetivo com peso e meta da semana (docs/PERFIL.md, seções 2.3 e 2.4)
--
-- Peso: a tabela `pesagens` guarda o histórico (1 registro por dia); o peso
-- atual é sempre o último. `profiles.peso_kg` continua existindo (é o peso de
-- cadastro, usado no gasto calórico e no IMC em /perfil/config) e também
-- serve de ponto de partida ("peso inicial") de quem ainda não registrou
-- nenhuma pesagem nova.
--
-- Privacidade do peso (seção 2.3): só o dono lê o valor absoluto. Para os
-- outros, a função peso_card() devolve só a variação (ou nada, no padrão
-- "só eu"), nunca os quilos — e nunca o absoluto para quem não está logado,
-- mesmo com "mostrar tudo".

alter table public.profiles
  add column peso_meta_kg numeric(5, 1) check (peso_meta_kg between 30 and 250),
  add column visibilidade_peso text not null default 'eu' check (visibilidade_peso in ('eu', 'variacao', 'tudo'));

create table public.pesagens (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  peso_kg numeric(5, 1) not null check (peso_kg between 30 and 250),
  dia date not null,
  registrado_em timestamptz not null default now(),
  unique (usuario_id, dia)
);
create index pesagens_usuario_idx on public.pesagens (usuario_id, dia desc);

alter table public.pesagens enable row level security;
revoke all on public.pesagens from anon, authenticated;
grant select on public.pesagens to authenticated;
create policy "pesagens: dono le" on public.pesagens for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Ponto de partida de quem já tinha peso de cadastro: 1 pesagem no dia do
-- cadastro (ou de hoje, se "criado_em" for no futuro por algum motivo de teste).
insert into public.pesagens (usuario_id, peso_kg, dia, registrado_em)
select id, peso_kg, least(criado_em::date, current_date), criado_em
from public.profiles
where peso_kg is not null
on conflict (usuario_id, dia) do nothing;

-- Registra o peso de hoje (no fuso da pessoa). No máximo 1 por dia: tocar de
-- novo no mesmo dia corrige o valor, não soma uma linha nova.
create function public.registrar_peso(p_peso_kg numeric) returns public.pesagens
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.exigir_cadastro();
  v_fuso text;
  v_dia date;
  r public.pesagens;
begin
  select fuso_horario into v_fuso from public.profiles where id = v_user;
  v_dia := (now() at time zone v_fuso)::date;
  insert into public.pesagens (usuario_id, peso_kg, dia)
  values (v_user, p_peso_kg, v_dia)
  on conflict (usuario_id, dia) do update set peso_kg = excluded.peso_kg, registrado_em = now()
  returning * into r;
  return r;
end;
$$;
grant execute on function public.registrar_peso(numeric) to authenticated;

-- O dono troca a meta e a visibilidade do peso em /perfil/config.
grant update (peso_meta_kg, visibilidade_peso) on public.profiles to authenticated;

-- Card de objetivo: peso atual, meta e variação, conforme quem pergunta.
-- "eu" (padrão): nada para os outros. "variacao": só a variação, sem kg.
-- "tudo": kg e meta, mas nunca para quem não está logado (seção 2.3).
create function public.peso_card(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  p public.profiles;
  v_inicial public.pesagens;
  v_atual numeric;
  v_variacao numeric;
begin
  select * into p from public.profiles where id = p_user;
  if p.id is null then
    return null;
  end if;

  select * into v_inicial from public.pesagens where usuario_id = p_user order by dia asc limit 1;
  select peso_kg into v_atual from public.pesagens where usuario_id = p_user order by dia desc limit 1;
  if v_inicial.id is not null and v_atual is not null then
    v_variacao := round(v_atual - v_inicial.peso_kg, 1);
  end if;

  if v_viewer = p_user then
    return jsonb_build_object(
      'papel', 'dono', 'visivel', true,
      'atual', v_atual, 'meta', p.peso_meta_kg, 'inicial', v_inicial.peso_kg, 'desde', v_inicial.dia,
      'variacao_kg', v_variacao, 'visibilidade_peso', p.visibilidade_peso
    );
  end if;

  if p.visibilidade_peso = 'eu' or v_variacao is null then
    return jsonb_build_object('papel', 'outro', 'visivel', false);
  end if;

  if p.visibilidade_peso = 'tudo' and v_viewer is not null then
    return jsonb_build_object('papel', 'outro', 'visivel', true, 'atual', v_atual, 'meta', p.peso_meta_kg, 'variacao_kg', v_variacao);
  end if;

  -- "variacao", ou "tudo" pedido por quem não está logado: nunca o absoluto.
  return jsonb_build_object('papel', 'outro', 'visivel', true, 'variacao_kg', v_variacao);
end;
$$;
grant execute on function public.peso_card(uuid) to anon, authenticated;

-- A meta e o progresso da semana valem para qualquer perfil, inclusive o
-- público (seção 11, item 5: decidido que sim). A semana começa na segunda,
-- igual à liga; os dias já concluídos usam o fuso de quem está sendo visto.
create function public.meta_semana(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles;
  v_inicio date;
  v_inicio_ts timestamptz;
  v_dias jsonb;
  v_feitas integer;
  v_streak integer;
begin
  select * into p from public.profiles where id = p_user and onboarding_concluido_em is not null;
  if p.id is null then
    return null;
  end if;
  v_inicio := date_trunc('week', (now() at time zone p.fuso_horario)::date)::date;
  -- Converte a meia-noite de segunda, no fuso da pessoa, para o instante certo em UTC.
  v_inicio_ts := v_inicio::timestamp at time zone p.fuso_horario;

  select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'hives', coalesce(c.n, 0)) order by d), '[]'::jsonb)
  into v_dias
  from generate_series(v_inicio, v_inicio + 6, interval '1 day') as d
  left join (
    select (concluido_em at time zone p.fuso_horario)::date as dia, count(*) as n
    from public.challenge_attempts
    where user_id = p_user and status = 'concluido' and concluido_em >= v_inicio_ts and concluido_em < v_inicio_ts + interval '7 days'
    group by 1
  ) c on c.dia = d::date;

  select coalesce(sum((x ->> 'hives')::int), 0) into v_feitas from jsonb_array_elements(v_dias) x;
  select atual into v_streak from public.streaks where user_id = p_user;

  return jsonb_build_object(
    'meta_hives_dia', p.meta_desafios_dia, 'meta_dias_semana', p.dias_semana,
    'dias', v_dias, 'feitas_na_semana', v_feitas, 'streak', coalesce(v_streak, 0)
  );
end;
$$;
grant execute on function public.meta_semana(uuid) to anon, authenticated;

-- Título do objetivo e a meta da semana aparecem para todo mundo (seção 6):
-- entram em perfis_publicos junto com o username e o resto, só na view final
-- (perfil_social.sql). "create or replace view" não deixa tirar coluna, e a
-- migração do Visitante (depois desta) volta a view para as 5 colunas
-- originais — se essas 3 entrassem aqui, a dela quebraria o encadeamento.
