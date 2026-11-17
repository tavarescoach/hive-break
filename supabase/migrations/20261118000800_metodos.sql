-- Hive Break · Métodos dos desafios (docs/METODOS.md, 18/11/2026)
--
-- Cada desafio passa a ter um método: intervalado, Tabata, séries e
-- repetições, circuito, EMOM, escada ou contra o relógio, com os parâmetros
-- (séries, reps, tempos de trabalho e descanso). O app monta a sequência de
-- fases a partir daqui. A duração do desafio (duracao_s) é a planejada,
-- somando trabalho e descanso, e fica em até 5 minutos.

alter table public.challenges add column metodo jsonb
  check (metodo is null or (jsonb_typeof(metodo) = 'object' and metodo ->> 'tipo' in
    ('intervalado', 'tabata', 'series', 'circuito', 'emom', 'escada', 'contra_relogio')));

comment on column public.challenges.metodo is 'Método do desafio e seus parâmetros (src/dominio/metodos.ts).';
