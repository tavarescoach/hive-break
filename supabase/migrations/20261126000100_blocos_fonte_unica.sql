-- Hive Break · Fonte única de blocos: challenges.estrutura (Etapa 1A do
-- docs/PLANO_ETAPAS_UX.md)
--
-- Até aqui, um desafio tinha os blocos em DOIS lugares: a tabela
-- challenge_blocks (ordem, exercise_id, parametros_por_dificuldade) e a
-- coluna challenges.estrutura (migração 20261118000900_blocos.sql), gerados
-- juntos pelo mesmo script (scripts/gerar-seed-trilha.ts) mas sem nada que
-- impedisse os dois de ficarem fora de sincronia. A partir de agora,
-- challenges.estrutura é a ÚNICA fonte: finalizar_desafio só lê dela.
--
-- challenge_blocks fica como está (sem apagar, sem novos usos) até poder ser
-- removida; é só uma tabela congelada, útil enquanto algum código antigo
-- (ex.: carregar-desafio.ts, que lê a lista de exercícios da tela) ainda não
-- foi convertido — isso fica para uma etapa futura (a Etapa 3, com
-- montarHive, substitui essa leitura por completo).
comment on table public.challenge_blocks is
  'Obsoleta: congelada desde a migração 20261126000100. finalizar_desafio lê os blocos de challenges.estrutura. Não recebe mais linhas novas fora do que o script de seed ainda gera em paralelo para a tela do desafio (carregar-desafio.ts). Remover quando essa leitura também migrar para estrutura.';

-- attempt_blocks.challenge_block_id era not null com FK para challenge_blocks:
-- um desafio só-com-estrutura (sem linha nenhuma em challenge_blocks) não
-- conseguiria gravar a tentativa. A chave de verdade agora é `ordem` (a
-- posição do bloco em estrutura.blocos, 1-indexada, igual à antiga
-- challenge_blocks.ordem); challenge_block_id fica opcional, preenchido só
-- quando ainda existir a linha correspondente (compatibilidade com leituras
-- antigas, ex.: lerRecordes em carregar-desafio.ts, que passa a usar `ordem`).
alter table public.attempt_blocks add column ordem smallint;
update public.attempt_blocks ab set ordem = cb.ordem
from public.challenge_blocks cb where cb.id = ab.challenge_block_id;
alter table public.attempt_blocks alter column ordem set not null;
alter table public.attempt_blocks alter column challenge_block_id drop not null;
alter table public.attempt_blocks drop constraint attempt_blocks_attempt_id_challenge_block_id_serie_key;
alter table public.attempt_blocks add constraint attempt_blocks_attempt_id_ordem_serie_key unique (attempt_id, ordem, serie);
comment on column public.attempt_blocks.challenge_block_id is
  'Obsoleta: use `ordem`. Fica nula quando o desafio não tem (mais) linha correspondente em challenge_blocks.';

create or replace function public.finalizar_desafio(p_challenge_id text, p_modo text, p_blocos jsonb) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
  c public.challenges;
  v_estado text;
  v_modo text := p_modo;
  v_hoje date;
  v_refeito boolean;
  v_refazer_pago boolean;
  v_primeiro boolean;
  v_base integer;
  v_xp_desafio integer;
  v_xp_primeiro integer := 0;
  v_xp integer;
  v_attempt uuid;
  v_blocos jsonb;
  v_total_blocos integer;
  v_blocos_ativos integer := 0;
  v_sem_movimento boolean := false;
  v_unidade_concluida boolean := false;
  v_unidade_sessao boolean := false;
  v_nivel_concluido boolean := false;
  v_proximo smallint;
  v_ofensiva integer;
  b jsonb;
  v_bloco jsonb;
  v_ordem integer;
  v_segundos integer;
  v_reps integer;
  v_tempo numeric;
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_modo not in ('camera', 'manual') then
    raise exception 'modo_invalido' using errcode = '22023';
  end if;
  select * into p from public.profiles where id = v_user;
  -- Visitante (docs/VISITANTE.md) joga antes do cadastro, depois da declaração de saúde.
  if p.onboarding_concluido_em is null and not (p.visitante and p.triagem_respondida_em is not null) then
    raise exception 'cadastro_incompleto' using errcode = '22023';
  end if;
  select * into c from public.challenges where id = p_challenge_id;
  if c.id is null then
    raise exception 'desafio_inexistente' using errcode = '22023';
  end if;
  if c.estrutura is null then
    raise exception 'desafio_sem_estrutura' using errcode = '22023';
  end if;
  select estado into v_estado from public.trilha_estados(v_user) where challenge_id = c.id;
  -- Bloqueado na trilha, mas a pessoa está numa hive deste desafio: pode fazer.
  -- Visitante: também pode o desafio do convite.
  if v_estado = 'travado' or (v_estado = 'bloqueado' and not public.em_hive_do_desafio(v_user, c.id)
                              and c.id is distinct from public.desafio_do_convite(v_user)) then
    raise exception 'desafio_bloqueado' using errcode = '22023';
  end if;
  v_refeito := v_estado = 'concluido';

  -- Confere os números enviados pelo aparelho e recusa valores impossíveis (seção 9.5).
  -- Fonte única: challenges.estrutura, não challenge_blocks (ver comentário no topo do arquivo).
  v_blocos := c.estrutura -> 'blocos';
  v_total_blocos := jsonb_array_length(v_blocos);
  if jsonb_typeof(coalesce(p_blocos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_blocos, '[]'::jsonb)) > v_total_blocos
     or pg_column_size(p_blocos) > 20000 then
    raise exception 'kpis_invalidos' using errcode = '22023';
  end if;
  if v_modo = 'camera' then
    for b in select * from jsonb_array_elements(p_blocos) loop
      v_ordem := (b ->> 'ordem')::int;
      if v_ordem is null or v_ordem < 1 or v_ordem > v_total_blocos or jsonb_typeof(b -> 'kpis') is distinct from 'object' then
        raise exception 'kpis_invalidos' using errcode = '22023';
      end if;
      v_bloco := v_blocos -> (v_ordem - 1);
      v_segundos := coalesce((v_bloco ->> 'esforco_s')::int, c.duracao_s);
      v_reps := coalesce((b ->> 'reps_validas')::int, 0);
      v_tempo := coalesce((b ->> 'tempo_valido_s')::numeric, 0);
      -- Limite humano: no máximo 4 repetições por segundo; tempo válido não passa do tempo do bloco.
      if v_reps < 0 or v_reps > v_segundos * 4 or v_tempo < 0 or v_tempo > v_segundos + 5
         or coalesce((b ->> 'reps_parciais')::int, 0) not between 0 and v_segundos * 4
         or coalesce((b ->> 'fora_quadro_pct')::numeric, 0) not between 0 and 100 then
        raise exception 'kpis_invalidos' using errcode = '22023';
      end if;
      if v_reps > 0 or v_tempo >= 3 then
        v_blocos_ativos := v_blocos_ativos + 1;
      end if;
    end loop;
    -- A câmera não viu movimento em pelo menos metade dos exercícios: vale como modo manual.
    if v_blocos_ativos * 2 < v_total_blocos then
      v_modo := 'manual';
      v_sem_movimento := true;
    end if;
  end if;

  v_hoje := (now() at time zone p.fuso_horario)::date;
  select exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and challenge_id = c.id and status = 'concluido' and refeito and xp > 0
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_refazer_pago;
  select not exists (
    select 1 from public.challenge_attempts
    where user_id = v_user and status = 'concluido'
      and (concluido_em at time zone p.fuso_horario)::date = v_hoje
  ) into v_primeiro;

  v_base := public.xp_do_desafio(c.tipo);
  v_xp_desafio := case
    when v_refeito and v_refazer_pago then 0
    else greatest(1, round(v_base * (case when v_modo = 'manual' then 0.5 else 1 end) * (case when v_refeito then 1.0 / 3 else 1 end)))::int
  end;
  if v_primeiro then
    v_xp_primeiro := case when v_modo = 'manual' then 3 else 5 end;
  end if;
  v_xp := v_xp_desafio + v_xp_primeiro;

  insert into public.challenge_attempts
    (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp, valido_para_liga, refeito)
  values (v_user, c.id, p.dificuldade_atual, v_modo, 'concluido', now(), v_xp_desafio, false, v_refeito)
  returning id into v_attempt;

  if p_modo = 'camera' then
    insert into public.attempt_blocks
      (attempt_id, ordem, challenge_block_id, exercise_id, serie, reps_validas, reps_parciais, tempo_valido_s, kpis, fora_quadro_pct)
    select v_attempt, (e ->> 'ordem')::int,
           (select cb.id from public.challenge_blocks cb where cb.challenge_id = c.id and cb.ordem = (e ->> 'ordem')::int),
           v_blocos -> ((e ->> 'ordem')::int - 1) ->> 'exercicio_id', 1,
           coalesce((e ->> 'reps_validas')::int, 0), coalesce((e ->> 'reps_parciais')::int, 0),
           coalesce((e ->> 'tempo_valido_s')::numeric, 0), e -> 'kpis', coalesce((e ->> 'fora_quadro_pct')::numeric, 0)
    from jsonb_array_elements(p_blocos) e
    on conflict (attempt_id, ordem, serie) do nothing;
  end if;

  if v_xp_desafio > 0 then
    insert into public.xp_events (user_id, tipo, valor, attempt_id)
    values (v_user, case when v_refeito then 'refazer' else 'desafio' end, v_xp_desafio, v_attempt);
  end if;
  if v_xp_primeiro > 0 then
    insert into public.xp_events (user_id, tipo, valor, attempt_id) values (v_user, 'primeiro_do_dia', v_xp_primeiro, v_attempt);
  end if;

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

  if not v_refeito then
    select not exists (
      select 1 from public.trilha_estados(v_user) where unit_id = c.unit_id and estado in ('disponivel', 'bloqueado')
    ) into v_unidade_concluida;
    select not exists (
      select 1 from public.trilha_estados(v_user) where level_id = c.level_id and estado in ('disponivel', 'bloqueado')
    ) into v_nivel_concluido;
  end if;

  -- Unidade inteira numa única sessão: do primeiro ao último desafio em até 3 horas.
  if v_unidade_concluida then
    select max(ucp.concluido_em) - min(ucp.concluido_em) <= interval '3 hours' into v_unidade_sessao
    from public.user_challenge_progress ucp
    join public.challenges ch on ch.id = ucp.challenge_id
    where ucp.user_id = v_user and ch.unit_id = c.unit_id and ucp.concluido_em is not null;
    if v_unidade_sessao then
      insert into public.xp_events (user_id, tipo, valor, attempt_id) values (v_user, 'unidade_sessao', 50, v_attempt);
      v_xp := v_xp + 50;
    end if;
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
    'xp', v_xp, 'modo', v_modo, 'sem_movimento', v_sem_movimento,
    'primeiro_do_dia', v_primeiro, 'refeito', v_refeito, 'refazer_sem_xp', v_refeito and v_refazer_pago,
    'ofensiva', v_ofensiva, 'unidade_concluida', v_unidade_concluida, 'unidade_sessao', coalesce(v_unidade_sessao, false),
    'nivel_concluido', v_nivel_concluido, 'proximo_nivel', v_proximo
  );
end;
$$;
