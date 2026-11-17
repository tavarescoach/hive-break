-- Hive Break · Desafios em blocos com variáveis metodológicas (18/11/2026)
--
-- Cada desafio passa a ser uma lista de blocos (um por exercício), cada um com
-- método (AMRAP, isometria, repetições, EMOM, Tabata, contra o relógio),
-- séries, esforço ou reps-alvo, pausa, score, PSE alvo, cadência, ADM e ação.
-- O formato está em src/dominio/metodos.ts (Estrutura, versão 2). A coluna
-- `metodo` (formato anterior) fica vazia e deixa de ser usada.

alter table public.challenges add column estrutura jsonb
  check (estrutura is null or (jsonb_typeof(estrutura) = 'object'
    and estrutura ->> 'versao' = '2'
    and jsonb_typeof(estrutura -> 'blocos') = 'array'));

comment on column public.challenges.estrutura is 'Blocos do desafio com as variáveis metodológicas (src/dominio/metodos.ts).';

-- Segundos da contagem do pop-up "PREPARE-SE" antes de cada exercício (5 a 10).
alter table public.profiles add column contagem_preparo_s smallint not null default 10
  check (contagem_preparo_s between 5 and 10);
grant update (contagem_preparo_s) on public.profiles to authenticated;

-- Percepção subjetiva de esforço (PSE, 1 a 10) informada no fim do desafio.
-- Vai para a tentativa mais recente do desafio, feita nas últimas 3 horas.
create function public.registrar_esforco(p_challenge_id text, p_valor integer) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_valor is null or p_valor < 1 or p_valor > 10 then
    raise exception 'esforco_invalido' using errcode = '22023';
  end if;
  update public.challenge_attempts set esforco_percebido = p_valor
  where id = (
    select id from public.challenge_attempts
    where user_id = v_user and challenge_id = p_challenge_id and status = 'concluido'
      and concluido_em > now() - interval '3 hours'
    order by concluido_em desc
    limit 1
  );
  return found;
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
grant execute on function public.finalizar_desafio(text, text, jsonb) to authenticated;
grant execute on function public.concluir_desafio_provisorio(text) to authenticated;
grant execute on function public.registrar_dor(text, text, text) to authenticated;
grant execute on function public.registrar_esforco(text, integer) to authenticated;
grant execute on function public.abrir_bau(text, integer) to authenticated;
grant execute on function public.pular_para_secao(integer) to authenticated;
grant execute on all functions in schema public to service_role;
