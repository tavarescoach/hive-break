// Gera supabase/seed_trilha.sql: os 19 exercícios do catálogo (seção 7), as 24
// unidades (3 por nível) e os desafios de cada unidade, seguindo a ordem
// fisiológica da seção 6.2. Rode com: npm run seed:trilha
//
// O conteúdo é um RASCUNHO para revisão do Luan: nomes das unidades, escolha
// dos exercícios e durações. Séries, repetições e escala por dificuldade
// entram na Fase 3.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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

export function gerarSeedTrilha(): string {
  const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));
  const linhas: string[] = [
    "-- Hive Break · Seed da trilha: exercícios, unidades, desafios e blocos.",
    "-- GERADO por scripts/gerar-seed-trilha.ts: não edite à mão. Pode ser rodado",
    "-- mais de uma vez (atualiza o que já existe).",
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
  const desafios: string[] = [];
  const blocos: string[] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach(([titulo, descricao], iu) => {
      const unidade = `n${nivel}u${iu + 1}`;
      unidades.push(`  (${txt(unidade)}, ${nivel}, ${iu + 1}, ${txt(titulo)}, ${txt(descricao)})`);
      const itens = [...posicoesDoNivel(nivel).map((p) => ({ p, tipo: "desafio" })), { p: FINAL, tipo: "final" }];
      itens.forEach(({ p, tipo }, i) => {
        const ordem = i + 1;
        const id = tipo === "final" ? `${unidade}final` : `${unidade}d${String(ordem).padStart(2, "0")}`;
        const opcoes = p.opcoes(nivel);
        const escolhidos = opcoes[(iu + nivel) % opcoes.length].map((e) => porId.get(e)!);
        const equipamento = escolhidos.some((e) => e.equipamento === "cabo_vassoura")
          ? "cabo_vassoura"
          : escolhidos.some((e) => e.equipamento === "tapete" || (e.chao && nivel >= 5))
            ? "tapete"
            : null;
        desafios.push(
          `  (${txt(id)}, ${nivel}, ${txt(unidade)}, ${ordem}, ${txt(p.titulo)}, ${txt(p.modalidade)}, ${p.duracao}, ${txt(p.intensidade)}, ${txt(equipamento)}, ${!!p.opcionalEm8}, ${!!p.extraEm12}, ${txt(tipo)})`,
        );
        // O tempo do desafio é dividido igualmente entre os exercícios, em múltiplos de 5 s.
        const segundos = Math.floor(p.duracao / escolhidos.length / 5) * 5;
        escolhidos.forEach((e, ib) => {
          const formato = p.modalidade === "hiit" ? "intervalado" : p.modalidade === "condicionamento" ? "amrap" : e.formato;
          const ultimo = ib === escolhidos.length - 1;
          const duracao = ultimo ? p.duracao - segundos * (escolhidos.length - 1) : segundos;
          blocos.push(
            `  (${txt(`${id}b${ib + 1}`)}, ${txt(id)}, ${ib + 1}, ${txt(e.id)}, ${txt(formato)}, 1, ${txt(JSON.stringify({ padrao: { segundos: duracao } }))}::jsonb, 0)`,
          );
        });
      });
    });
  }

  linhas.push(
    "insert into public.units (id, level_id, ordem, titulo, descricao) values",
    unidades.join(",\n") + "\non conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem;",
    "",
    "insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, equipamento, opcional_em_8, extra_em_12, tipo) values",
    desafios.join(",\n") +
      "\non conflict (id) do update set ordem = excluded.ordem, titulo = excluded.titulo, modalidade = excluded.modalidade,\n  duracao_s = excluded.duracao_s, intensidade = excluded.intensidade, equipamento = excluded.equipamento, tipo = excluded.tipo;",
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
