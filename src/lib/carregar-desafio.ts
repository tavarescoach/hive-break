import "server-only";

import type { BlocoDesafio } from "@/app/desafio/[id]/Desafio";
import type { RecordesAnteriores } from "@/dominio/card";
import type { Estrutura, MetodoAntigo } from "@/dominio/metodos";
import type { DadosTrilha } from "@/dominio/trilha";
import type { Sessao } from "./sessao";

export interface DesafioCarregado {
  /** Estado na trilha da pessoa: concluido, disponivel, bloqueado ou travado. */
  estado: string;
  props: {
    id: string;
    titulo: string;
    modalidade: string;
    contexto: string;
    xp: number;
    equipamento: string | null;
    jaFeito: boolean;
    blocos: BlocoDesafio[];
    estrutura: Estrutura | null;
    metodoAntigo: MetodoAntigo | null;
    preparoS: number;
    /** Identificação no card de compartilhamento. */
    usuario: string;
    instagram: string | null;
    recordes: RecordesAnteriores | null;
    /** Código de convite de quem está compartilhando (gera o link com o gancho). */
    codigoConvite: string;
  };
}

/**
 * Lê tudo o que a tela do desafio precisa. Usado pela página do desafio e pela
 * hive (que deixa fazer um desafio ainda bloqueado na trilha).
 */
export async function carregarDesafio(sessao: Sessao, id: string): Promise<DesafioCarregado | null> {
  const [trilha, blocos, exercicios, desafioBanco] = await Promise.all([
    sessao.supabase.rpc("ler_trilha"),
    sessao.supabase.from("challenge_blocks").select("id,ordem,exercise_id,parametros_por_dificuldade").eq("challenge_id", id).order("ordem"),
    sessao.supabase.from("exercises").select("id,nome,camera"),
    // Antes da migração 0009 a coluna estrutura não existe: o app converte o método antigo.
    sessao.supabase.from("challenges").select("*").eq("id", id).maybeSingle(),
  ]);
  const dados = trilha.data as DadosTrilha | null;
  const desafio = dados?.desafios.find((d) => d.id === id);
  if (!dados || !desafio) return null;

  const nomes = new Map((exercicios.data ?? []).map((e) => [e.id as string, e as { nome: string; camera: string }]));
  const lista: BlocoDesafio[] = (blocos.data ?? []).map((b) => ({
    ordem: Number(b.ordem),
    exercicioId: String(b.exercise_id),
    exercicio: nomes.get(b.exercise_id as string)?.nome ?? String(b.exercise_id),
    lateral: nomes.get(b.exercise_id as string)?.camera === "lateral",
    segundos: Number((b.parametros_por_dificuldade as { padrao?: { segundos?: number } }).padrao?.segundos ?? 60),
  }));
  const recordes = await lerRecordes(sessao, id, (blocos.data ?? []).map((b) => String(b.id)));
  const unidade = dados.unidades.find((u) => u.id === desafio.unit_id);
  const nivel = dados.niveis.find((n) => n.id === desafio.level_id);

  return {
    estado: desafio.estado,
    props: {
      id: desafio.id,
      titulo: desafio.titulo,
      modalidade: desafio.modalidade,
      contexto: `Seção ${nivel?.ordem ?? ""} · Unidade ${unidade?.ordem ?? ""} · ${unidade?.titulo ?? ""}`,
      xp: desafio.xp,
      equipamento: desafio.equipamento,
      jaFeito: desafio.estado === "concluido",
      blocos: lista,
      estrutura: (desafioBanco.data?.estrutura as Estrutura | null | undefined) ?? null,
      metodoAntigo: (desafioBanco.data?.metodo as MetodoAntigo | null | undefined) ?? null,
      preparoS: sessao.perfil.contagem_preparo_s ?? 10,
      usuario: sessao.perfil.apelido ?? "Hive Break",
      // Campo ainda não existe no perfil: quando existir, aparece no card sozinho.
      instagram: (sessao.perfil as { instagram?: string | null }).instagram ?? null,
      recordes,
      codigoConvite: sessao.perfil.codigo_convite,
    },
  };
}

/**
 * Melhor marca anterior do usuário em cada bloco deste desafio, só das
 * tentativas com câmera (as sem câmera não guardam séries). RLS: só o dono lê.
 * Erro de leitura vira null e o recorde some do card.
 */
async function lerRecordes(sessao: Sessao, desafioId: string, idsBlocos: string[]): Promise<RecordesAnteriores | null> {
  const tentativas = await sessao.supabase
    .from("challenge_attempts")
    .select("id")
    .eq("user_id", sessao.usuarioId)
    .eq("challenge_id", desafioId)
    .eq("status", "concluido")
    .eq("modo", "camera")
    .order("concluido_em", { ascending: false })
    .limit(200);
  if (tentativas.error) return null;
  const ids = (tentativas.data ?? []).map((t) => String(t.id));
  if (ids.length === 0) return {};
  const marcas = await sessao.supabase.from("attempt_blocks").select("challenge_block_id,reps_validas,tempo_valido_s").in("attempt_id", ids);
  if (marcas.error) return null;
  const recordes: RecordesAnteriores = {};
  for (const m of marcas.data ?? []) {
    const i = idsBlocos.indexOf(String(m.challenge_block_id));
    if (i < 0) continue;
    const atual = recordes[i] ?? { reps: 0, segundos: 0 };
    recordes[i] = {
      reps: Math.max(atual.reps, Number(m.reps_validas) || 0),
      segundos: Math.max(atual.segundos, Math.round(Number(m.tempo_valido_s) || 0)),
    };
  }
  return recordes;
}
