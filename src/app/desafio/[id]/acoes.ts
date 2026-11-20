"use server";

import { revalidatePath } from "next/cache";
import { dispararLembretes } from "@/lib/lembretes";
import { exigirJogador } from "@/lib/sessao";

import type { BlocoEnviado } from "@/dominio/agregar";

export type { BlocoEnviado };

export interface ResultadoDesafio {
  ok: boolean;
  erro?: string;
  xp?: number;
  modo?: "camera" | "manual";
  sem_movimento?: boolean;
  primeiro_do_dia?: boolean;
  refeito?: boolean;
  refazer_sem_xp?: boolean;
  ofensiva?: number;
  unidade_concluida?: boolean;
  unidade_sessao?: boolean;
  nivel_concluido?: boolean;
  proximo_nivel?: number | null;
  /** Alguém te chamou de volta e você concluiu em até 48h (docs/RESGATE.md, seção 6). */
  resgate_voltou?: { amigo: string } | null;
}

const REGIOES = ["joelho", "ombro", "lombar", "punho", "quadril", "tornozelo", "pescoco", "outra"];

/**
 * Fecha o desafio. O servidor confere se ele está liberado, valida os números
 * e calcula XP, ofensiva e o que foi liberado.
 */
export async function finalizarDesafio(id: string, modo: "camera" | "manual", blocos: BlocoEnviado[]): Promise<ResultadoDesafio> {
  const sessao = await exigirJogador();
  // Pontos da liga antes do desafio: base para avisar amigos ultrapassados (S4).
  const antes = sessao.perfil.visitante ? { data: null, error: null } : await sessao.supabase.rpc("lembretes_meus_pontos_liga");
  const { data, error } = await sessao.supabase.rpc("finalizar_desafio", {
    p_challenge_id: id,
    p_modo: modo,
    p_blocos: modo === "camera" ? blocos : [],
  });
  if (error) {
    return {
      ok: false,
      erro: error.message.includes("desafio_bloqueado")
        ? "Este desafio ainda está bloqueado. Volte à trilha e faça os anteriores."
        : /could not find the function|PGRST202|não existe/i.test(error.message)
          ? "O banco de dados ainda não foi atualizado para esta versão. Falta rodar a migração 20261117000700_finalizar_desafio.sql no Supabase."
          : "Não consegui registrar. Confira a internet e tente de novo.",
    };
  }
  revalidatePath("/trilha");
  await sessao.supabase.rpc("registrar_evento", { p_nome: "desafio_concluido", p_props: { challenge_id: id, modo } });
  // Visitante não recebe lembretes até confirmar o e-mail (VISITANTE.md, seção 3).
  if (sessao.perfil.visitante) return { ok: true, ...(data as Omit<ResultadoDesafio, "ok">) };
  // Dia 1, marco de ofensiva, volta após 14 dias e ultrapassagem na liga.
  dispararLembretes(async () => {
    const { data: eventos } = await sessao.supabase.rpc("lembretes_apos_desafio", {
      p_pontos_antes: antes.error ? null : (antes.data as number | null),
    });
    return eventos;
  });

  // Resgate (docs/RESGATE.md, seção 6): fecha resgates abertos há até 48h, dá a
  // recompensa para quem chamou e avisa quem chamou que a pessoa voltou.
  const { data: voltas } = await sessao.supabase.rpc("resgate_concluir");
  const quemChamou = (voltas as { de_usuario_id: string; amigo: string }[] | null) ?? [];
  if (quemChamou.length > 0) {
    const meuNome = sessao.perfil.apelido ?? "Seu amigo";
    dispararLembretes(() => quemChamou.map((v) => ({ user_id: v.de_usuario_id, gatilho: "RESGATE_VOLTOU", dados: { amigo: meuNome } })));
  }

  return { ok: true, ...(data as Omit<ResultadoDesafio, "ok">), resgate_voltou: quemChamou[0] ? { amigo: quemChamou[0].amigo } : null };
}

/** Botão "Senti dor": registra a região e encerra o desafio (seção 12.4). */
export async function registrarDor(id: string, exercicio: string, regiao: string): Promise<{ ok: boolean }> {
  if (!REGIOES.includes(regiao)) return { ok: false };
  const sessao = await exigirJogador();
  const { error } = await sessao.supabase.rpc("registrar_dor", { p_challenge_id: id, p_exercise_id: exercicio, p_regiao: regiao });
  return { ok: !error };
}

/** Percepção de esforço (PSE, 1 a 10) respondida no fim do desafio. */
export async function registrarEsforco(id: string, valor: number): Promise<{ ok: boolean }> {
  if (!Number.isInteger(valor) || valor < 1 || valor > 10) return { ok: false };
  const sessao = await exigirJogador();
  const { data, error } = await sessao.supabase.rpc("registrar_esforco", { p_challenge_id: id, p_valor: valor });
  return { ok: !error && data === true };
}
