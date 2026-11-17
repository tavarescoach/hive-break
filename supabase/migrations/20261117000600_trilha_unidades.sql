-- Hive Break · Trilha em unidades (pedido do Luan em 17/11/2026)
--
-- Estrutura nova: Nível (seção) -> Unidade temática -> Desafios.
-- Cada unidade tem de 8 a 12 desafios e termina no "Desafio da unidade".
-- A cada 4 desafios há um baú de XP.
--
-- Enquanto a câmera não entra nos desafios, a conclusão é pelo modo
-- provisório (timer + "Concluí"). XP, ofensiva e liberação continuam sendo
-- calculados aqui, no servidor.

create table public.units (
  id text primary key,
  level_id smallint not null references public.levels (id) on delete cascade,
  ordem smallint not null,
  titulo text not null,
  descricao text,
  unique (level_id, ordem)
);

alter table public.challenges
  add column unit_id text not null references public.units (id) on delete cascade,
  add column tipo text not null default 'desafio' check (tipo in ('desafio', 'final')),
  drop constraint challenges_level_id_ordem_key,
  add constraint challenges_unit_ordem_key unique (unit_id, ordem);

alter table public.user_challenge_progress add column concluido_em timestamptz;

-- Baús de XP já abertos (um a cada 4 desafios da unidade).
create table public.user_chests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id text not null references public.units (id) on delete cascade,
  posicao smallint not null check (posicao > 0 and posicao % 4 = 0),
  aberto_em timestamptz not null default now(),
  primary key (user_id, unit_id, posicao)
);

alter table public.units enable row level security;
alter table public.user_chests enable row level security;
revoke all on public.units, public.user_chests from anon, authenticated;
grant select on public.units to anon, authenticated;
grant select on public.user_chests to authenticated;
grant all on public.units, public.user_chests to service_role;
create policy "conteudo: todos leem" on public.units for select to anon, authenticated using (true);
create policy "baus: dono le" on public.user_chests for select to authenticated using (user_id = (select auth.uid()));

-- XP de cada tipo de item da trilha.
create function public.xp_do_desafio(p_tipo text) returns integer
language sql immutable
set search_path = public, pg_temp
as $$ select case p_tipo when 'final' then 20 else 10 end $$;

-- Estado de cada desafio para um usuário:
--   concluido  = já fez
--   travado    = intensidade média ou alta e a pessoa não está liberada (triagem)
--   disponivel = seção liberada e nada pendente antes dele na seção
--   bloqueado  = ainda há desafio pendente antes, ou a seção não foi liberada
-- Desafios travados não seguram a fila: quem está limitado a baixa
-- intensidade segue pelos desafios que pode fazer.
create function public.trilha_estados(p_user uuid)
returns table (challenge_id text, level_id smallint, unit_id text, ordem smallint, seq integer, estado text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with base as (
    select c.id, c.level_id, c.unit_id, c.ordem,
           row_number() over (partition by c.level_id order by u.ordem, c.ordem)::int as seq,
           (p.concluido_em is not null) as feito,
           (pf.liberado_alta_intensidade or c.intensidade = 'baixa') as permitido,
           coalesce(lp.liberado, false) as secao_liberada
    from public.challenges c
    join public.units u on u.id = c.unit_id
    cross join (select liberado_alta_intensidade from public.profiles where id = p_user) pf
    left join public.user_challenge_progress p on p.user_id = p_user and p.challenge_id = c.id
    left join public.user_level_progress lp on lp.user_id = p_user and lp.level_id = c.level_id
  ),
  marcado as (
    select *,
           coalesce(bool_or(permitido and not feito) over (
             partition by level_id order by seq rows between unbounded preceding and 1 preceding
           ), false) as pendente_antes
    from base
  )
  select id, level_id, unit_id, ordem, seq,
         case
           when feito then 'concluido'
           when not permitido then 'travado'
           when secao_liberada and not pendente_antes then 'disponivel'
           else 'bloqueado'
         end
  from marcado;
$$;

-- Tudo o que a tela Trilha precisa, numa chamada só.
create function public.ler_trilha() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  s public.streaks;
  v_hoje date;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user;
  select * into s from public.streaks where user_id = v_user;
  v_hoje := (now() at time zone p.fuso_horario)::date;

  return jsonb_build_object(
    'nivel_atual', p.nivel_atual,
    'liberado_alta_intensidade', p.liberado_alta_intensidade,
    -- Ofensiva só vale se o último dia ativo foi hoje ou ontem.
    'ofensiva', case when s.ultimo_dia_ativo >= v_hoje - 1 then s.atual else 0 end,
    'fez_hoje', coalesce(s.ultimo_dia_ativo = v_hoje, false),
    'xp_hoje', (select coalesce(sum(valor), 0) from public.xp_events
                where user_id = v_user and (criado_em at time zone p.fuso_horario)::date = v_hoje),
    'meta_xp', coalesce(p.meta_desafios_dia, 1) * 10,
    'niveis', (select jsonb_agg(jsonb_build_object(
                 'id', l.id, 'ordem', l.ordem, 'tema', l.tema, 'equipamentos', l.equipamentos_necessarios,
                 'liberado', coalesce(lp.liberado, false), 'concluido', lp.concluido_em is not null) order by l.ordem)
               from public.levels l
               left join public.user_level_progress lp on lp.user_id = v_user and lp.level_id = l.id),
    'unidades', (select jsonb_agg(jsonb_build_object(
                   'id', u.id, 'level_id', u.level_id, 'ordem', u.ordem, 'titulo', u.titulo, 'descricao', u.descricao)
                   order by u.level_id, u.ordem)
                 from public.units u),
    'desafios', (select jsonb_agg(jsonb_build_object(
                   'id', c.id, 'unit_id', c.unit_id, 'level_id', c.level_id, 'ordem', c.ordem, 'titulo', c.titulo,
                   'modalidade', c.modalidade, 'duracao_s', c.duracao_s, 'intensidade', c.intensidade,
                   'equipamento', c.equipamento, 'tipo', c.tipo, 'xp', public.xp_do_desafio(c.tipo), 'estado', e.estado)
                   order by c.level_id, e.seq)
                 from public.challenges c join public.trilha_estados(v_user) e on e.challenge_id = c.id),
    'baus_abertos', (select coalesce(jsonb_agg(jsonb_build_object('unit_id', unit_id, 'posicao', posicao)), '[]'::jsonb)
                     from public.user_chests where user_id = v_user)
  );
end;
$$;

-- Modo provisório: a pessoa fez o desafio com o timer e tocou em "Concluí".
-- Dá o XP cheio (10, ou 20 no desafio da unidade, +5 no primeiro do dia),
-- conta o dia na ofensiva e libera o próximo. Sem nota, estrelas nem liga.
-- Refazer o mesmo desafio no mesmo dia não dá XP de novo.
create function public.concluir_desafio_provisorio(p_challenge_id text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  c public.challenges;
  v_estado text;
  v_hoje date;
  v_repetido boolean;
  v_primeiro boolean;
  v_xp integer := 0;
  v_ja_tinha_feito boolean;
  v_unidade_concluida boolean := false;
  v_nivel_concluido boolean := false;
  v_proximo smallint;
  v_ofensiva integer;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = v_user;
  if p.onboarding_concluido_em is null then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  select * into c from public.challenges where id = p_challenge_id;
  if c.id is null then
    raise exception 'desafio_inexistente' using errcode = '22023';
  end if;
  select estado into v_estado from public.trilha_estados(v_user) where challenge_id = c.id;
  if v_estado in ('bloqueado', 'travado') then
    raise exception 'desafio_bloqueado' using errcode = '22023';
  end if;
  v_ja_tinha_feito := v_estado = 'concluido';

  v_hoje := (now() at time zone p.fuso_horario)::date;
  select exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and challenge_id = c.id and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_repetido;
  select not exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_primeiro;

  if not v_repetido then
    v_xp := public.xp_do_desafio(c.tipo) + case when v_primeiro then 5 else 0 end;
  end if;

  with nova as (
    insert into public.challenge_attempts
      (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp, valido_para_liga)
    values (v_user, c.id, p.dificuldade_atual, 'manual', 'concluido', now(), v_xp, false)
    returning id
  )
  insert into public.xp_events (user_id, tipo, valor, attempt_id)
  select v_user, t.tipo, t.valor, nova.id
  from nova, (values ('desafio', public.xp_do_desafio(c.tipo)), ('primeiro_do_dia', 5)) as t (tipo, valor)
  where not v_repetido and (t.tipo = 'desafio' or v_primeiro);

  insert into public.user_challenge_progress (user_id, challenge_id, liberado, tentativas, concluido_em)
  values (v_user, c.id, true, 1, now())
  on conflict (user_id, challenge_id) do update
    set tentativas = public.user_challenge_progress.tentativas + 1,
        concluido_em = coalesce(public.user_challenge_progress.concluido_em, now());

  -- Ofensiva: versão simples (dias seguidos). Protetor, recuperação, marcos e
  -- a virada do dia por cron entram na Fase 4.
  insert into public.streak_days (user_id, dia, tipo) values (v_user, v_hoje, 'feito')
  on conflict (user_id, dia) do nothing;
  update public.streaks
  set atual = case
        when ultimo_dia_ativo = v_hoje then atual
        when ultimo_dia_ativo = v_hoje - 1 then atual + 1
        else 1
      end,
      ultimo_dia_ativo = v_hoje
  where user_id = v_user;
  update public.streaks set recorde = greatest(recorde, atual) where user_id = v_user
  returning atual into v_ofensiva;

  if not v_ja_tinha_feito then
    select not exists (
      select 1 from public.trilha_estados(v_user) where unit_id = c.unit_id and estado in ('disponivel', 'bloqueado')
    ) into v_unidade_concluida;
    select not exists (
      select 1 from public.trilha_estados(v_user) where level_id = c.level_id and estado in ('disponivel', 'bloqueado')
    ) into v_nivel_concluido;
  end if;

  if v_nivel_concluido then
    update public.user_level_progress set concluido_em = now()
    where user_id = v_user and level_id = c.level_id and concluido_em is null;
    if found then
      insert into public.xp_events (user_id, tipo, valor) values (v_user, 'nivel_concluido', 30);
      v_xp := v_xp + 30;
      select id into v_proximo from public.levels where ordem = (select ordem + 1 from public.levels where id = c.level_id);
      if v_proximo is not null then
        insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, v_proximo, true)
        on conflict (user_id, level_id) do update set liberado = true;
        update public.profiles set nivel_atual = v_proximo where id = v_user and nivel_atual = c.level_id;
      end if;
    else
      v_nivel_concluido := false;
    end if;
  end if;

  return jsonb_build_object(
    'xp', v_xp, 'primeiro_do_dia', v_primeiro and not v_repetido, 'repetido', v_repetido,
    'ofensiva', v_ofensiva, 'unidade_concluida', v_unidade_concluida,
    'nivel_concluido', v_nivel_concluido, 'proximo_nivel', v_proximo
  );
end;
$$;

-- Baú de XP: abre uma vez, quando tudo até ele na seção já foi feito.
create function public.abrir_bau(p_unit_id text, p_posicao integer) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_level smallint;
  v_seq integer;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  select e.level_id, e.seq into v_level, v_seq
  from public.trilha_estados(v_user) e
  join public.challenges c on c.id = e.challenge_id
  where e.unit_id = p_unit_id and e.ordem = p_posicao and c.tipo = 'desafio' and p_posicao % 4 = 0;
  if v_seq is null then
    raise exception 'bau_inexistente' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.trilha_estados(v_user)
    where level_id = v_level and seq <= v_seq and estado in ('disponivel', 'bloqueado')
  ) then
    raise exception 'bau_bloqueado' using errcode = '22023';
  end if;
  begin
    insert into public.user_chests (user_id, unit_id, posicao) values (v_user, p_unit_id, p_posicao);
  exception when unique_violation then
    raise exception 'bau_ja_aberto' using errcode = '22023';
  end;
  insert into public.xp_events (user_id, tipo, valor) values (v_user, 'bau', 10);
  return jsonb_build_object('xp', 10);
end;
$$;

-- "Pular para cá": libera a seção escolhida sem fazer as anteriores (decisão
-- do Luan). Quem não tem liberação médica continua limitado a baixa intensidade.
create function public.pular_para_secao(p_level_id integer) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.levels where id = p_level_id) then
    raise exception 'secao_inexistente' using errcode = '22023';
  end if;
  if (select onboarding_concluido_em from public.profiles where id = v_user) is null then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  insert into public.user_level_progress (user_id, level_id, liberado) values (v_user, p_level_id, true)
  on conflict (user_id, level_id) do update set liberado = true;
  update public.profiles set nivel_atual = p_level_id where id = v_user;
end;
$$;

-- Privilégios: retira tudo e concede função por função (ver migração 0005).
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.minhas_ligas() to authenticated;
grant execute on function public.registrar_triagem(jsonb) to authenticated;
grant execute on function public.declarar_liberacao_medica() to authenticated;
grant execute on function public.definir_compromisso(integer) to authenticated;
grant execute on function public.registrar_convite(text) to authenticated;
grant execute on function public.concluir_onboarding() to authenticated;
grant execute on function public.convite_publico(text) to anon, authenticated;
grant execute on function public.ler_trilha() to authenticated;
grant execute on function public.concluir_desafio_provisorio(text) to authenticated;
grant execute on function public.abrir_bau(text, integer) to authenticated;
grant execute on function public.pular_para_secao(integer) to authenticated;
grant execute on all functions in schema public to service_role;
