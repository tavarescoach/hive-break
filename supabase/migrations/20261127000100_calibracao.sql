-- Hive Break · Calibração (Etapa C do docs/PLANO_ETAPAS_UX.md)
--
-- Só 3 dos exercícios foram testados com gente real (decisão 55 do
-- docs/DECISOES.md). Aqui fica cada série de calibração: a pessoa treina com a
-- câmera e o professor conta ao mesmo tempo (botão "+1" ou segurando o botão
-- enquanto a posição está certa). O relatório compara as duas contagens.
--
-- Nenhuma imagem é gravada: só números e a série temporal da medida principal
-- do exercício (o ângulo ou a distância que o motor usa para contar), para
-- reajustar os limiares depois. Quem treina é identificado só por um rótulo
-- curto escolhido pelo professor (ex.: "A1", "aluna J."), nunca por nome completo.
--
-- Acesso: só quem está em ADMINS (lembretes_config), o mesmo critério de /admin/lembretes.
create table public.calibracao_series (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  admin_id uuid not null,
  exercicio_id text not null check (exercicio_id ~ '^[a-z0-9_]{2,60}$'),
  -- "reps": o professor toca +1; "tempo": o professor segura o botão enquanto a posição vale.
  tipo text not null check (tipo in ('reps', 'tempo')),
  pessoa text not null check (char_length(pessoa) between 1 and 24),
  app_reps integer check (app_reps between 0 and 1000),
  prof_reps integer check (prof_reps between 0 and 1000),
  app_tempo_s numeric(6, 1) check (app_tempo_s between 0 and 3600),
  prof_tempo_s numeric(6, 1) check (prof_tempo_s between 0 and 3600),
  duracao_s numeric(6, 1) not null check (duracao_s between 0 and 3600),
  fps_medio numeric(5, 1) check (fps_medio between 0 and 240),
  posicao_celular text check (char_length(posicao_celular) <= 40),
  -- [[t_ms, valor], ...] a ~10 Hz; no máximo ~10 min de série.
  serie_temporal jsonb not null default '[]' check (jsonb_typeof(serie_temporal) = 'array' and pg_column_size(serie_temporal) <= 200000),
  observacao text check (char_length(observacao) <= 280)
);
create index calibracao_series_exercicio_idx on public.calibracao_series (exercicio_id, criado_em desc);
alter table public.calibracao_series enable row level security;
revoke all on public.calibracao_series from anon, authenticated;
grant all on public.calibracao_series to service_role;

create function public.calibracao_registrar(p jsonb) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not public.lembretes_sou_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  insert into public.calibracao_series
    (admin_id, exercicio_id, tipo, pessoa, app_reps, prof_reps, app_tempo_s, prof_tempo_s,
     duracao_s, fps_medio, posicao_celular, serie_temporal, observacao)
  values
    (auth.uid(), p ->> 'exercicio_id', p ->> 'tipo', btrim(p ->> 'pessoa'),
     (p ->> 'app_reps')::int, (p ->> 'prof_reps')::int,
     (p ->> 'app_tempo_s')::numeric, (p ->> 'prof_tempo_s')::numeric,
     (p ->> 'duracao_s')::numeric, (p ->> 'fps_medio')::numeric,
     nullif(btrim(p ->> 'posicao_celular'), ''),
     coalesce(p -> 'serie_temporal', '[]'::jsonb),
     nullif(btrim(p ->> 'observacao'), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Séries já gravadas, sem a série temporal (pesada): o relatório é calculado no app.
create function public.calibracao_listar() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.lembretes_sou_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'criado_em', s.criado_em, 'exercicio_id', s.exercicio_id, 'tipo', s.tipo, 'pessoa', s.pessoa,
      'app_reps', s.app_reps, 'prof_reps', s.prof_reps, 'app_tempo_s', s.app_tempo_s, 'prof_tempo_s', s.prof_tempo_s,
      'duracao_s', s.duracao_s, 'fps_medio', s.fps_medio, 'posicao_celular', s.posicao_celular, 'observacao', s.observacao
    ) order by s.id desc)
    from public.calibracao_series s
  ), '[]'::jsonb);
end;
$$;

-- Apagar uma série gravada por engano (ex.: o aluno saiu do quadro no meio).
create function public.calibracao_apagar(p_id bigint) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.lembretes_sou_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  delete from public.calibracao_series where id = p_id;
end;
$$;

revoke execute on function public.calibracao_registrar(jsonb), public.calibracao_listar(), public.calibracao_apagar(bigint)
from public, anon;
grant execute on function public.calibracao_registrar(jsonb), public.calibracao_listar(), public.calibracao_apagar(bigint)
to authenticated, service_role;
