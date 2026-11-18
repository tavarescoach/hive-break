-- Hive Break · HUD de treino: estilo de progresso (docs/HUD_TREINO.md, seção 4)
--
-- "barra": número do hero centralizado com a barra embaixo dele (padrão).
-- "moldura": a borda da tela vira a barra de progresso.

alter table public.profiles add column estilo_progresso text not null default 'barra'
  check (estilo_progresso in ('barra', 'moldura'));
grant update (estilo_progresso) on public.profiles to authenticated;
