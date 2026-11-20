-- Hive Break · Score 0-100 e estrelas abandonados (Etapa 1A do
-- docs/PLANO_ETAPAS_UX.md; decisão registrada em docs/DECISOES.md).
--
-- Nunca foram implementados (decisão 65 em docs/DECISOES.md). O recorde já é,
-- na prática, o melhor número cru por exercício e variante (reps válidas ou
-- segundos válidos: ver lerRecordes em src/lib/carregar-desafio.ts). Estas
-- colunas ficam só comentadas como obsoletas, sem apagar: convite_publico
-- (migração 20261122000100_visitante.sql) e migrar_visitante ainda as leem.
comment on column public.challenge_attempts.score is
  'Obsoleta (nunca implementada): o score 0-100 foi abandonado. Recorde = melhor número cru (reps válidas ou segundos válidos), ver docs/DECISOES.md, seção "Etapa 1A".';
comment on column public.challenge_attempts.estrelas is
  'Obsoleta (nunca implementada): as estrelas foram abandonadas junto com o score 0-100, ver docs/DECISOES.md, seção "Etapa 1A".';
comment on column public.attempt_blocks.score_bloco is
  'Obsoleta (nunca implementada): ver docs/DECISOES.md, seção "Etapa 1A".';
comment on column public.user_challenge_progress.melhor_score is
  'Obsoleta (nunca implementada): ver docs/DECISOES.md, seção "Etapa 1A".';
comment on column public.user_challenge_progress.melhores_estrelas is
  'Obsoleta (nunca implementada): ver docs/DECISOES.md, seção "Etapa 1A".';
