// Gera supabase/seed_trilha.sql: os 19 exercícios do catálogo (seção 7), as 24
// unidades (3 por nível) e os desafios de cada unidade, seguindo a ordem
// fisiológica da seção 6.2, cada um com o seu método (docs/METODOS.md). Rode com: npm run seed:trilha
//
// O conteúdo é um RASCUNHO para revisão do Luan: nomes das unidades, escolha
// dos exercícios e durações. Séries, repetições e escala por dificuldade
// entram na Fase 3.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DURACAO_MAXIMA_S, montarLinhaDoTempo, segundosPorExercicio, validarMetodo,
  type ExercicioMetodo, type Item, type Metodo,
} from "../src/dominio/metodos";

const raiz = path.resolve(__dirname, "..");

interface Exercicio {
  id: string;
  nome: string;
  modalidade: string;
  camera: "frontal" | "lateral";
  equipamento: "tapete" | "cabo_vassoura" | null;
  formato: string;
  /** Exercício de chão: pede tapete a partir do nível 5 (seção 7). */
  chao?: boolean;
}

export const EXERCICIOS: Exercicio[] = [
  { id: "agachamento_livre", nome: "Agachamento livre", modalidade: "forca", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "afundo_alternado", nome: "Afundo alternado", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes" },
  { id: "flexao_braco", nome: "Flexão de braço", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "ponte_gluteo", nome: "Ponte de glúteo", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "prancha", nome: "Prancha", modalidade: "core", camera: "lateral", equipamento: null, formato: "isometria", chao: true },
  { id: "polichinelo", nome: "Polichinelo", modalidade: "cardio", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "skipping", nome: "Skipping (elevação de joelhos)", modalidade: "cardio", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "mountain_climber", nome: "Mountain climber", modalidade: "condicionamento", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "elevacao_bracos_y", nome: "Elevação de braços em Y", modalidade: "mobilidade", camera: "frontal", equipamento: null, formato: "mobilidade" },
  { id: "alongamento_posterior", nome: "Alongamento de posterior em pé", modalidade: "alongamento", camera: "lateral", equipamento: null, formato: "isometria" },
  { id: "marcha_estacionaria", nome: "Marcha estacionária com braços", modalidade: "aquecimento", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "guerreiro_2", nome: "Guerreiro II", modalidade: "yoga", camera: "frontal", equipamento: null, formato: "postura" },
  { id: "postura_arvore", nome: "Postura da árvore", modalidade: "yoga", camera: "frontal", equipamento: null, formato: "postura" },
  { id: "cachorro_olhando_baixo", nome: "Cachorro olhando para baixo", modalidade: "yoga", camera: "lateral", equipamento: "tapete", formato: "postura", chao: true },
  { id: "apoio_uma_perna", nome: "Apoio em uma perna", modalidade: "equilibrio", camera: "frontal", equipamento: null, formato: "equilibrio" },
  { id: "toque_alvos", nome: "Toque nos alvos", modalidade: "precisao", camera: "frontal", equipamento: null, formato: "precisao" },
  { id: "respiracao_guiada", nome: "Respiração guiada", modalidade: "respiracao", camera: "frontal", equipamento: null, formato: "respiracao" },
  { id: "agachamento_bastao", nome: "Agachamento com bastão acima da cabeça", modalidade: "mobilidade", camera: "frontal", equipamento: "cabo_vassoura", formato: "mobilidade" },
  { id: "bom_dia_bastao", nome: "Bom-dia com bastão", modalidade: "forca", camera: "lateral", equipamento: "cabo_vassoura", formato: "repeticoes" },
];

/** 3 unidades temáticas por nível. */
export const UNIDADES: Record<number, [string, string][]> = {
  1: [["Acordando o corpo", "Os primeiros movimentos, sem pressa."], ["Pernas firmes", "A base de tudo: agachar e sustentar."], ["Fôlego novo", "Um pouco mais de ritmo a cada dia."]],
  2: [["Agachar bem", "Técnica antes de quantidade."], ["Tronco estável", "Centro do corpo forte e alinhado."], ["Ritmo constante", "Manter o passo do começo ao fim."]],
  3: [["Um pé de cada vez", "Equilíbrio em uma perna."], ["Centro forte", "CORE para segurar qualquer movimento."], ["Controle total", "Devagar e bem feito."]],
  4: [["Passo marcado", "Cadência e coordenação."], ["Coração acelerado", "Condicionamento em blocos curtos."], ["Sem perder o compasso", "Ritmo com técnica."]],
  5: [["No tapete", "Hora de ir para o chão."], ["Prancha e ponte", "Força de tronco e glúteos."], ["Força de chão", "Empurrar o próprio peso."]],
  6: [["Explosão", "Mais velocidade, mesma qualidade."], ["Empurrar e subir", "Braços e pernas trabalhando juntos."], ["Motor ligado", "Sessões longas de fôlego."]],
  7: [["Com o bastão", "O cabo de vassoura entra no treino."], ["Ombros livres", "Amplitude acima da cabeça."], ["Quadril solto", "Mobilidade de posterior e quadril."]],
  8: [["Tudo junto", "Todos os movimentos numa sessão."], ["No limite", "Seu melhor em cada desafio."], ["Colmeia completa", "A última unidade da trilha."]],
};

interface Posicao {
  titulo: string;
  modalidade: string;
  duracao: number;
  intensidade: "baixa" | "media" | "alta";
  /** Fora dos níveis de 8 desafios (marcado com * na seção 6.2). */
  opcionalEm8?: boolean;
  /** Só nos níveis de 12 desafios (marcado com † na seção 6.2). */
  extraEm12?: boolean;
  /** Opções de exercícios; a escolha gira por unidade. */
  opcoes: (nivel: number) => string[][];
}

/** Ordem fisiológica da seção 6.2. */
const MODELO: Posicao[] = [
  { titulo: "Aquecimento", modalidade: "aquecimento", duracao: 210, intensidade: "baixa", opcoes: () => [["marcha_estacionaria", "polichinelo"], ["marcha_estacionaria", "skipping"], ["marcha_estacionaria", "elevacao_bracos_y"]] },
  { titulo: "Mobilidade articular", modalidade: "mobilidade", duracao: 270, intensidade: "baixa", opcoes: (n) => (n >= 7 ? [["agachamento_bastao", "elevacao_bracos_y"], ["elevacao_bracos_y", "agachamento_bastao"]] : [["elevacao_bracos_y", "alongamento_posterior"], ["elevacao_bracos_y", "guerreiro_2"]]) },
  { titulo: "Equilíbrio", modalidade: "equilibrio", duracao: 210, intensidade: "baixa", opcionalEm8: true, opcoes: () => [["apoio_uma_perna"], ["postura_arvore", "apoio_uma_perna"], ["apoio_uma_perna", "postura_arvore"]] },
  { titulo: "Precisão", modalidade: "precisao", duracao: 210, intensidade: "media", extraEm12: true, opcoes: () => [["toque_alvos"]] },
  { titulo: "Força de pernas", modalidade: "forca", duracao: 300, intensidade: "media", opcoes: (n) => (n >= 7 ? [["agachamento_livre", "bom_dia_bastao"], ["afundo_alternado", "bom_dia_bastao"], ["agachamento_livre", "afundo_alternado"]] : [["agachamento_livre", "afundo_alternado"], ["agachamento_livre"], ["afundo_alternado", "agachamento_livre"]]) },
  { titulo: "Força de tronco e braços", modalidade: "forca", duracao: 300, intensidade: "media", opcionalEm8: true, opcoes: () => [["flexao_braco", "ponte_gluteo"], ["ponte_gluteo", "flexao_braco"]] },
  { titulo: "CORE", modalidade: "core", duracao: 270, intensidade: "media", opcoes: (n) => (n >= 3 ? [["prancha", "mountain_climber"], ["prancha", "ponte_gluteo"]] : [["prancha", "ponte_gluteo"], ["ponte_gluteo", "prancha"]]) },
  { titulo: "Condicionamento", modalidade: "condicionamento", duracao: 300, intensidade: "alta", opcoes: (n) => (n >= 3 ? [["skipping", "polichinelo"], ["mountain_climber", "skipping"], ["polichinelo", "mountain_climber"]] : [["skipping", "polichinelo"], ["polichinelo", "skipping"]]) },
  { titulo: "HIIT", modalidade: "hiit", duracao: 270, intensidade: "alta", opcoes: (n) => (n >= 3 ? [["polichinelo", "agachamento_livre", "skipping"], ["skipping", "mountain_climber", "polichinelo"]] : [["polichinelo", "agachamento_livre", "skipping"], ["skipping", "agachamento_livre", "polichinelo"]]) },
  { titulo: "Mobilidade dinâmica", modalidade: "mobilidade", duracao: 270, intensidade: "baixa", extraEm12: true, opcoes: (n) => (n >= 7 ? [["agachamento_bastao", "guerreiro_2"], ["guerreiro_2", "agachamento_bastao"]] : [["guerreiro_2", "elevacao_bracos_y"], ["elevacao_bracos_y", "guerreiro_2"]]) },
  { titulo: "Yoga e alongamento", modalidade: "yoga", duracao: 300, intensidade: "baixa", opcoes: (n) => (n >= 5 ? [["cachorro_olhando_baixo", "guerreiro_2", "alongamento_posterior"], ["guerreiro_2", "postura_arvore", "cachorro_olhando_baixo"]] : [["guerreiro_2", "postura_arvore", "alongamento_posterior"], ["postura_arvore", "guerreiro_2", "alongamento_posterior"]]) },
  { titulo: "Volta à calma e respiração", modalidade: "respiracao", duracao: 270, intensidade: "baixa", opcoes: () => [["alongamento_posterior", "respiracao_guiada"], ["respiracao_guiada"]] },
];

const FINAL: Posicao = {
  titulo: "Desafio da unidade",
  modalidade: "desafio_final",
  duracao: 300,
  intensidade: "media",
  opcoes: (n) => (n >= 3 ? [["agachamento_livre", "prancha", "polichinelo"], ["afundo_alternado", "mountain_climber", "skipping"], ["agachamento_livre", "flexao_braco", "polichinelo"]] : [["agachamento_livre", "prancha", "polichinelo"], ["agachamento_livre", "ponte_gluteo", "skipping"], ["afundo_alternado", "prancha", "polichinelo"]]),
};

/** Desafios por unidade em cada nível (seção 6.1): 8, 8, 10, 10, 10, 12, 12, 12. */
const DESAFIOS_POR_NIVEL: Record<number, number> = { 1: 8, 2: 8, 3: 10, 4: 10, 5: 10, 6: 12, 7: 12, 8: 12 };

const txt = (valor: string | null) => (valor === null ? "null" : `'${valor.replace(/'/g, "''")}'`);

function posicoesDoNivel(nivel: number): Posicao[] {
  const total = DESAFIOS_POR_NIVEL[nivel];
  return MODELO.filter((p) => (total === 8 ? !p.opcionalEm8 && !p.extraEm12 : total === 10 ? !p.extraEm12 : true));
}

const SUSTENTACAO = new Set(["isometria", "postura", "equilibrio", "respiracao"]);

function paraMetodo(e: Exercicio): ExercicioMetodo {
  const def = JSON.parse(readFileSync(path.join(raiz, "src", "exercicios", `${e.id}.json`), "utf8")) as { seg_por_rep?: number };
  return { nome: e.nome, sustentacao: SUSTENTACAO.has(e.formato), segPorRep: def.seg_por_rep ?? 3 };
}

/** Repetições que levam cerca de `segundos` no ritmo de referência (par, para os alternados). */
const repsPara = (segundos: number, ex: ExercicioMetodo) => Math.min(60, Math.max(4, Math.round(segundos / ex.segPorRep / 2) * 2));

/** Item de circuito: segundos para sustentação, repetições para o resto. */
const item = (ex: ExercicioMetodo, segundos: number): Item => (ex.sustentacao ? { segundos } : { reps: repsPara(segundos, ex) });

/**
 * Método de cada posição da unidade (docs/METODOS.md, seção 3). A progressão
 * entre níveis segue volume → densidade: mais reps ou segundos, menos descanso.
 */
function escolherMetodo(p: Posicao, nivel: number, unidade: number, ex: ExercicioMetodo[]): Metodo {
  const pr = Math.min(3, Math.floor((nivel - 1) / 2));
  const todosSust = ex.every((e) => e.sustentacao);
  const algumSust = ex.some((e) => e.sustentacao);
  const n = ex.length;
  switch (p.modalidade) {
    case "aquecimento":
      return {
        tipo: "intervalado", trabalho_s: 30, descanso_s: 10, series: 3 * n,
        meta: algumSust ? { tipo: "amrap" } : {
          tipo: "faixa",
          por_exercicio: ex.map((e) => ({ min: Math.round((30 / e.segPorRep) * 0.6), max: Math.round((30 / e.segPorRep) * 0.9) })),
        },
      };
    case "mobilidade":
      return { tipo: "circuito", rodadas: 2, descanso_s: 15, itens: ex.map((e) => (e.sustentacao ? { segundos: [20, 25, 30, 30][pr] } : { reps: [6, 8, 8, 10][pr] })) };
    case "equilibrio":
      return todosSust
        ? { tipo: "intervalado", trabalho_s: [20, 25, 30, 40][pr], descanso_s: 10, series: 4, meta: { tipo: "sustentar" } }
        : { tipo: "circuito", rodadas: 2, descanso_s: 10, itens: ex.map((e) => item(e, 25)) };
    case "precisao":
      return { tipo: "intervalado", trabalho_s: [30, 30, 40, 40][pr], descanso_s: 15, series: 4, meta: { tipo: "amrap" } };
    case "forca": {
      if (algumSust) return { tipo: "circuito", rodadas: 3, descanso_s: 30, itens: ex.map((e) => item(e, 30)) };
      const tronco = p.titulo.includes("tronco");
      // Terceira unidade de cada seção: EMOM, para variar o estímulo de força.
      if (unidade === 2) return { tipo: "emom", minutos: 4, reps: Math.min(...ex.map((e) => repsPara([20, 25, 30, 30][pr], e))) };
      return {
        tipo: "series",
        series: n === 1 ? 3 : 2,
        reps: (tronco ? [6, 8, 10, 12] : [8, 10, 12, 15])[pr],
        descanso_s: [60, 45, 45, 30][pr],
      };
    }
    case "core":
      if (todosSust) return { tipo: "intervalado", trabalho_s: [20, 30, 40, 45][pr], descanso_s: 20, series: 3, meta: { tipo: "sustentar" } };
      if (algumSust) return { tipo: "circuito", rodadas: 3, descanso_s: 20, itens: ex.map((e) => item(e, [20, 30, 40, 45][pr])) };
      return { tipo: "emom", minutos: 4, reps: Math.min(...ex.map((e) => repsPara([20, 25, 30, 35][pr], e))) };
    case "condicionamento":
      return unidade % 2 === 0
        ? { tipo: "circuito", rodadas: 3, descanso_s: 20, itens: ex.map((e) => (e.sustentacao ? { segundos: 25 } : { segundos: [20, 25, 30, 30][pr] })) }
        : { tipo: "intervalado", trabalho_s: [30, 40, 40, 45][pr], descanso_s: [20, 20, 15, 15][pr], series: 6, meta: { tipo: "amrap" } };
    case "hiit":
      return { tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 };
    case "yoga":
      return todosSust
        ? { tipo: "intervalado", trabalho_s: [30, 30, 40, 45][pr], descanso_s: 10, series: 2 * n, meta: { tipo: "sustentar" } }
        : { tipo: "circuito", rodadas: 2, descanso_s: 10, itens: ex.map((e) => item(e, 30)) };
    case "respiracao": {
      const resp = ex.findIndex((e) => e.nome.startsWith("Respiração"));
      return { tipo: "circuito", rodadas: 1, descanso_s: 0, itens: ex.map((e, i) => ({ segundos: i === resp ? (n === 1 ? 240 : 180) : 60 })) };
    }
    case "desafio_final": {
      if (unidade === 0) return { tipo: "contra_relogio", teto_s: 240, itens: ex.map((e) => item(e, [30, 35, 40, 45][pr])) };
      const alvo = ex.findIndex((e) => !e.sustentacao);
      if (unidade === 1 && n === 1 && alvo === 0) {
        const fator = ex[0].segPorRep < 1.5 ? 2 : 1;
        return { tipo: "escada", teto_s: 240, degraus: [[2, 4, 6, 8], [2, 4, 6, 8, 10], [4, 6, 8, 10, 12], [4, 8, 12, 16, 20]][pr].map((d) => d * fator) };
      }
      return { tipo: "circuito", rodadas: 3, descanso_s: 20, itens: ex.map((e) => item(e, [20, 25, 30, 30][pr])) };
    }
  }
  throw new Error(`Posição sem método: ${p.modalidade}`);
}

/** Reduz o volume até o desafio caber em 5 minutos, contando os descansos. */
function encaixar(m: Metodo, ex: ExercicioMetodo[]): Metodo {
  let atual = m;
  for (let i = 0; i < 40 && montarLinhaDoTempo(atual, ex).duracaoEstimadaS > DURACAO_MAXIMA_S; i++) {
    const a = structuredClone(atual);
    switch (a.tipo) {
      case "intervalado":
        if (a.series > 2) a.series--;
        else a.trabalho_s = Math.max(10, a.trabalho_s - 5);
        break;
      case "series":
        if (a.reps > 6) a.reps -= 2;
        else if (a.series > 1) a.series--;
        else a.descanso_s = Math.max(15, a.descanso_s - 15);
        break;
      case "circuito":
        if (a.rodadas > 1) a.rodadas--;
        else a.itens = a.itens.map((it) => ("reps" in it ? { reps: Math.max(4, it.reps - 2) } : { segundos: Math.max(10, it.segundos - 10) }));
        break;
      case "emom":
        a.minutos--;
        break;
      default:
        throw new Error(`Não consegui encaixar ${a.tipo} em 5 min`);
    }
    atual = a;
  }
  return atual;
}

export interface DesafioGerado {
  id: string;
  nivel: number;
  unidade: string;
  ordem: number;
  posicao: Posicao;
  tipo: "desafio" | "final";
  exercicios: Exercicio[];
  metodo: Metodo;
  duracaoS: number;
  segundosPorExercicio: number[];
  equipamento: string | null;
}

/** Todo o conteúdo da trilha, já com métodos validados e dentro dos 5 minutos. */
export function conteudoTrilha(): DesafioGerado[] {
  const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));
  const lista: DesafioGerado[] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach((_, iu) => {
      const unidade = `n${nivel}u${iu + 1}`;
      const itens = [...posicoesDoNivel(nivel).map((p) => ({ p, tipo: "desafio" as const })), { p: FINAL, tipo: "final" as const }];
      itens.forEach(({ p, tipo }, i) => {
        const ordem = i + 1;
        const id = tipo === "final" ? `${unidade}final` : `${unidade}d${String(ordem).padStart(2, "0")}`;
        const opcoes = p.opcoes(nivel);
        let escolhidos = opcoes[(iu + nivel) % opcoes.length].map((e) => porId.get(e)!);
        // Desafio da segunda unidade: escada com o primeiro exercício de repetição.
        if (tipo === "final" && iu === 1) escolhidos = [escolhidos.find((e) => !SUSTENTACAO.has(e.formato))!];
        const ex = escolhidos.map(paraMetodo);
        const metodo = encaixar(escolherMetodo(p, nivel, iu, ex), ex);
        const problemas = validarMetodo(metodo, ex);
        if (problemas.length) throw new Error(`${id}: ${problemas.join("; ")}`);
        const linha = montarLinhaDoTempo(metodo, ex);
        const equipamento = escolhidos.some((e) => e.equipamento === "cabo_vassoura")
          ? "cabo_vassoura"
          : escolhidos.some((e) => e.equipamento === "tapete" || (e.chao && nivel >= 5))
            ? "tapete"
            : null;
        lista.push({
          id, nivel, unidade, ordem, posicao: p, tipo, exercicios: escolhidos, metodo,
          duracaoS: Math.max(30, linha.duracaoEstimadaS), segundosPorExercicio: segundosPorExercicio(linha, ex), equipamento,
        });
      });
    });
  }
  return lista;
}

export function gerarSeedTrilha(): string {
  const linhas: string[] = [
    "-- Hive Break · Seed da trilha: exercícios, unidades, desafios e blocos.",
    "-- GERADO por scripts/gerar-seed-trilha.ts: não edite à mão. Pode ser rodado",
    "-- mais de uma vez (atualiza o que já existe). Precisa da migração 0008 (coluna metodo).",
    "",
    "insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values",
  ];
  linhas.push(
    EXERCICIOS.map((e) => {
      // A definição de cada exercício vem do arquivo JSON que o motor usa.
      const definicao = JSON.stringify(JSON.parse(readFileSync(path.join(raiz, "src", "exercicios", `${e.id}.json`), "utf8")));
      return `  (${txt(e.id)}, ${txt(e.nome)}, ${txt(e.modalidade)}, ${txt(e.camera)}, ${txt(definicao)}::jsonb, ${txt(e.equipamento)})`;
    }).join(",\n") +
      "\non conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,\n  definicao = excluded.definicao, equipamento = excluded.equipamento;",
    "",
  );

  const unidades: string[] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach(([titulo, descricao], iu) => {
      unidades.push(`  (${txt(`n${nivel}u${iu + 1}`)}, ${nivel}, ${iu + 1}, ${txt(titulo)}, ${txt(descricao)})`);
    });
  }
  const desafios: string[] = [];
  const blocos: string[] = [];
  for (const d of conteudoTrilha()) {
    const p = d.posicao;
    desafios.push(
      `  (${txt(d.id)}, ${d.nivel}, ${txt(d.unidade)}, ${d.ordem}, ${txt(p.titulo)}, ${txt(p.modalidade)}, ${d.duracaoS}, ${txt(p.intensidade)}, ${txt(d.equipamento)}, ${!!p.opcionalEm8}, ${!!p.extraEm12}, ${txt(d.tipo)}, ${txt(JSON.stringify(d.metodo))}::jsonb)`,
    );
    d.exercicios.forEach((e, ib) => {
      const formato = d.metodo.tipo === "tabata" || d.metodo.tipo === "intervalado" ? "intervalado" : e.formato;
      blocos.push(
        `  (${txt(`${d.id}b${ib + 1}`)}, ${txt(d.id)}, ${ib + 1}, ${txt(e.id)}, ${txt(formato)}, 1, ${txt(JSON.stringify({ padrao: { segundos: d.segundosPorExercicio[ib] } }))}::jsonb, 0)`,
      );
    });
  }

  linhas.push(
    "insert into public.units (id, level_id, ordem, titulo, descricao) values",
    unidades.join(",\n") + "\non conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem;",
    "",
    "insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, equipamento, opcional_em_8, extra_em_12, tipo, metodo) values",
    desafios.join(",\n") +
      "\non conflict (id) do update set ordem = excluded.ordem, titulo = excluded.titulo, modalidade = excluded.modalidade,\n  duracao_s = excluded.duracao_s, intensidade = excluded.intensidade, equipamento = excluded.equipamento, tipo = excluded.tipo,\n  metodo = excluded.metodo;",
    "",
    "insert into public.challenge_blocks (id, challenge_id, ordem, exercise_id, formato, series, parametros_por_dificuldade, descanso_s) values",
    blocos.join(",\n") +
      "\non conflict (id) do update set exercise_id = excluded.exercise_id, formato = excluded.formato,\n  parametros_por_dificuldade = excluded.parametros_por_dificuldade;",
    "",
  );
  return linhas.join("\n");
}

if (require.main === module) {
  writeFileSync(path.join(raiz, "supabase", "seed_trilha.sql"), gerarSeedTrilha());
  console.log("supabase/seed_trilha.sql atualizado");
}
