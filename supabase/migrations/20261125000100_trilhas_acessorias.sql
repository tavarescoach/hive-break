-- Hive Break · Trilhas acessórias (Hive Office, Hive Coluna em Dia, Hive Heat,
-- Hive Desacelerar), pedido do Luan em 25/11/2026. Ver docs/TRILHAS_ACESSORIAS.md.
--
-- Cada trilha acessória é um nível (categoria 'acessoria') com uma unidade só,
-- no mesmo padrão em que a trilha principal guarda nível → unidade → desafios:
-- os desafios abaixo SÃO as "hives" da trilha acessória, cada uma com um
-- exercício só. Isso reaproveita de graça o motor da câmera (/desafio/[id]) e
-- as hives ao vivo (criar_hive), em vez de duplicar essa máquina.
--
-- Diferença da trilha principal: a seção de uma trilha acessória já nasce
-- liberada para todo mundo (sem baú, sem avanço de nível_atual do perfil) —
-- só a ordem das hives dentro da unidade continua travando a próxima até
-- concluir a anterior (mesma regra de trilha_estados). A Hive Heat continua
-- travada pela triagem de intensidade alta, como qualquer desafio 'alta'.
--
-- "Versão sem impacto" da Hive Heat: 3 hives alternativas (mesmo método,
-- exercício sem salto) num nível extra e oculto (105), escondido da lista de
-- trilhas acessórias; o app troca o id da hive apontada pelo botão "Let's
-- hive" conforme o interruptor (ver src/dominio/trilhaAcessoria.ts).

alter table public.levels add column categoria text not null default 'principal'
  check (categoria in ('principal', 'acessoria'));

-- Os níveis, unidades, desafios (hives) e blocos ficam em
-- supabase/seed_trilha_acessoria.sql: são conteúdo, não esquema, e dependem
-- dos exercícios que supabase/seed_trilha.sql semeia (roda depois daqui).

-- trilha_estados: igual à versão de 20261122000100_visitante.sql (regra da
-- declaração de saúde restrita), só acrescentando que uma trilha acessória já
-- nasce liberada (sem user_level_progress — ela não tem baú nem avanço de
-- nível_atual do perfil).
create or replace function public.trilha_estados(p_user uuid)
returns table (challenge_id text, level_id smallint, unit_id text, ordem smallint, seq integer, estado text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with base as (
    select c.id, c.level_id, c.unit_id, c.ordem,
           row_number() over (partition by c.level_id order by u.ordem, c.ordem)::int as seq,
           (p.concluido_em is not null) as feito,
           case
             when pf.triagem_restricao then c.modalidade = 'respiracao' or (c.modalidade = 'mobilidade' and c.intensidade = 'baixa')
             else pf.liberado_alta_intensidade or c.intensidade = 'baixa'
           end as permitido,
           case when l.categoria = 'acessoria' then true else coalesce(lp.liberado, false) end as secao_liberada
    from public.challenges c
    join public.units u on u.id = c.unit_id
    join public.levels l on l.id = c.level_id
    cross join (select liberado_alta_intensidade, triagem_restricao from public.profiles where id = p_user) pf
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

-- ler_trilha: sem mudança nenhuma de comportamento — só deixa explícito que
-- é a trilha principal (categoria = 'principal'), já que as tabelas agora
-- também guardam as trilhas acessórias. Quem lê a trilha principal continua
-- vendo exatamente os mesmos níveis, unidades e desafios de antes.
create or replace function public.ler_trilha() returns jsonb
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
               left join public.user_level_progress lp on lp.user_id = v_user and lp.level_id = l.id
               where l.categoria = 'principal'),
    'unidades', (select jsonb_agg(jsonb_build_object(
                   'id', u.id, 'level_id', u.level_id, 'ordem', u.ordem, 'titulo', u.titulo, 'descricao', u.descricao)
                   order by u.level_id, u.ordem)
                 from public.units u
                 join public.levels l on l.id = u.level_id and l.categoria = 'principal'),
    'desafios', (select jsonb_agg(jsonb_build_object(
                   'id', c.id, 'unit_id', c.unit_id, 'level_id', c.level_id, 'ordem', c.ordem, 'titulo', c.titulo,
                   'modalidade', c.modalidade, 'duracao_s', c.duracao_s, 'intensidade', c.intensidade,
                   'equipamento', c.equipamento, 'tipo', c.tipo, 'xp', public.xp_do_desafio(c.tipo), 'estado', e.estado)
                   order by c.level_id, e.seq)
                 from public.challenges c
                 join public.levels l on l.id = c.level_id and l.categoria = 'principal'
                 join public.trilha_estados(v_user) e on e.challenge_id = c.id),
    'baus_abertos', (select coalesce(jsonb_agg(jsonb_build_object('unit_id', unit_id, 'posicao', posicao)), '[]'::jsonb)
                     from public.user_chests where user_id = v_user)
  );
end;
$$;

-- ler_trilhas_acessorias: as trilhas acessórias (Hive Office, Hive Coluna em
-- Dia, Hive Heat, Hive Desacelerar) e suas hives, no mesmo formato de
-- desafio que a trilha principal — só filtrando para categoria 'acessoria'.
-- O app já conhece o resto (nome, cor, frase, regras...) por
-- src/dominio/trilhaAcessoria.ts; esta função só traz o que depende do
-- usuário: estado de cada hive (concluído, disponível, bloqueado, travado).
create function public.ler_trilhas_acessorias() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  -- Mesmo formato do item de 'desafios' em ler_trilha(), para o app (e o
  -- fallback de carregarDesafio) tratarem os dois iguais.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'unit_id', c.unit_id, 'level_id', c.level_id, 'ordem', c.ordem, 'titulo', c.titulo,
             'modalidade', c.modalidade, 'duracao_s', c.duracao_s, 'intensidade', c.intensidade,
             'equipamento', c.equipamento, 'tipo', c.tipo, 'xp', public.xp_do_desafio(c.tipo), 'estado', e.estado)
             order by c.level_id, e.seq)
    from public.challenges c
    join public.levels l on l.id = c.level_id and l.categoria = 'acessoria'
    join public.trilha_estados(v_user) e on e.challenge_id = c.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ler_trilhas_acessorias() to authenticated;
