/**
 * Regras do perfil (seção 5): opções, validação e dados calculados.
 * Código puro, usado tanto nas telas quanto nas ações do servidor. O banco
 * repete as mesmas faixas em CHECKs, então nada inválido é gravado.
 */

export interface Opcao<T extends string | number = string> {
  valor: T;
  rotulo: string;
  ajuda?: string;
}

export const SEXOS: Opcao[] = [
  { valor: "feminino", rotulo: "Feminino" },
  { valor: "masculino", rotulo: "Masculino" },
  { valor: "nao_informado", rotulo: "Prefiro não dizer" },
];

export const OBJETIVOS: Opcao[] = [
  { valor: "emagrecer", rotulo: "Emagrecer" },
  { valor: "forca", rotulo: "Ganhar força" },
  { valor: "mobilidade", rotulo: "Melhorar a mobilidade" },
  { valor: "condicionamento", rotulo: "Ganhar fôlego" },
  { valor: "saude_geral", rotulo: "Cuidar da saúde em geral" },
];

export const NIVEIS_ATIVIDADE: Opcao[] = [
  { valor: "sedentario", rotulo: "Estou parado", ajuda: "Quase não faço exercício" },
  { valor: "pouco_ativo", rotulo: "Pouco ativo", ajuda: "1 a 2 vezes por semana" },
  { valor: "ativo", rotulo: "Ativo", ajuda: "3 vezes por semana ou mais" },
];

export const DIAS_SEMANA: Opcao<number>[] = [2, 3, 4, 5, 6, 7].map((n) => ({ valor: n, rotulo: String(n) }));

export const EQUIPAMENTOS: Opcao[] = [
  { valor: "tapete", rotulo: "Tapete", ajuda: "Vale colchonete ou toalha grossa" },
  { valor: "cabo_vassoura", rotulo: "Cabo de vassoura", ajuda: "Ou um bastão leve" },
];

export const ESTILOS_PROGRESSO: Opcao[] = [
  { valor: "barra", rotulo: "Barra", ajuda: "Número centralizado com a barra embaixo dele" },
  { valor: "moldura", rotulo: "Moldura", ajuda: "A borda da tela vira a barra de progresso" },
];

export const ESTILOS_MUSICA: Opcao[] = [
  { valor: "eletronica", rotulo: "Eletrônica", ajuda: "Batida constante para manter o ritmo" },
  { valor: "lofi", rotulo: "Lo-fi", ajuda: "Calma, boa para mobilidade e alongamento" },
  { valor: "batida", rotulo: "Batida acelerada", ajuda: "Para os dias de mais energia" },
  { valor: "sem_musica", rotulo: "Sem música", ajuda: "Só a voz e os sons do treinador" },
];

export const METAS_DIARIAS: Opcao<number>[] = [
  { valor: 1, rotulo: "1 desafio", ajuda: "5 minutos por dia" },
  { valor: 2, rotulo: "2 desafios", ajuda: "10 minutos por dia" },
  { valor: 3, rotulo: "3 desafios", ajuda: "15 minutos por dia" },
];

export const COMPROMISSOS: Opcao<number>[] = [
  { valor: 7, rotulo: "7 dias", ajuda: "Uma semana para pegar o jeito" },
  { valor: 14, rotulo: "14 dias", ajuda: "Duas semanas para virar rotina" },
  { valor: 30, rotulo: "30 dias", ajuda: "Um mês para virar hábito" },
];

export const LIMITACOES: Opcao[] = [
  { valor: "joelho", rotulo: "Joelho" },
  { valor: "ombro", rotulo: "Ombro" },
  { valor: "lombar", rotulo: "Lombar" },
  { valor: "punho", rotulo: "Punho" },
];

export const rotuloDe = (opcoes: Opcao<string | number>[], valor: unknown) =>
  opcoes.find((o) => o.valor === valor)?.rotulo ?? "—";

export type CampoPerfil =
  | "apelido"
  | "data_nascimento"
  | "sexo"
  | "altura_cm"
  | "peso_kg"
  | "objetivo"
  | "nivel_atividade"
  | "dias_semana"
  | "equipamentos";

export interface EtapaPerfil {
  id: string;
  campo: CampoPerfil;
  titulo: string;
  ajuda?: string;
  tipo: "texto" | "data" | "numero" | "escolha" | "multipla";
  opcoes?: Opcao<string | number>[];
  unidade?: string;
}

/** Uma pergunta por tela, na ordem da seção 3.1 (passo 4). */
export const ETAPAS_PERFIL: EtapaPerfil[] = [
  { id: "apelido", campo: "apelido", tipo: "texto", titulo: "Como quer ser chamado?", ajuda: "É o nome que aparece na liga e nos convites. De 3 a 20 letras." },
  { id: "nascimento", campo: "data_nascimento", tipo: "data", titulo: "Quando você nasceu?", ajuda: "O Hive Break é para maiores de 18 anos." },
  { id: "sexo", campo: "sexo", tipo: "escolha", opcoes: SEXOS, titulo: "Qual é o seu sexo?", ajuda: "Serve para comparar seu desempenho com referências justas." },
  { id: "altura", campo: "altura_cm", tipo: "numero", unidade: "cm", titulo: "Qual é a sua altura?", ajuda: "Ajuda a câmera a medir a amplitude dos movimentos. Só você vê." },
  { id: "peso", campo: "peso_kg", tipo: "numero", unidade: "kg", titulo: "Qual é o seu peso?", ajuda: "Usado para estimar o gasto de energia. Só você vê." },
  { id: "objetivo", campo: "objetivo", tipo: "escolha", opcoes: OBJETIVOS, titulo: "Qual é o seu objetivo principal?" },
  { id: "atividade", campo: "nivel_atividade", tipo: "escolha", opcoes: NIVEIS_ATIVIDADE, titulo: "Como está sua rotina de exercício hoje?" },
  { id: "dias", campo: "dias_semana", tipo: "escolha", opcoes: DIAS_SEMANA, titulo: "Quantos dias por semana você quer treinar?", ajuda: "Ajusta o ritmo dos lembretes." },
  { id: "equipamento", campo: "equipamentos", tipo: "multipla", opcoes: EQUIPAMENTOS, titulo: "O que você já tem em casa?", ajuda: "Os primeiros níveis não pedem nada. Avisamos com antecedência quando precisar." },
];

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

const erro = (mensagem: string): { ok: false; erro: string } => ({ ok: false, erro: mensagem });

function numero(bruto: string): number {
  return Number(bruto.trim().replace(",", "."));
}

export function idade(dataNascimento: string, hoje: Date = new Date()): number {
  const [ano, mes, dia] = dataNascimento.split("-").map(Number);
  let anos = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) anos--;
  return anos;
}

/** Faixas da seção 5, mais "60+" (decisão do Luan: maiores de 60 são aceitos). */
export function faixaEtaria(anos: number): string {
  if (anos < 30) return "18-29";
  if (anos < 40) return "30-39";
  if (anos < 50) return "40-49";
  if (anos < 60) return "50-59";
  return "60+";
}

export function imc(alturaCm: number, pesoKg: number): number {
  const metros = alturaCm / 100;
  return Math.round((pesoKg / (metros * metros)) * 10) / 10;
}

function escolha(opcoes: Opcao<string | number>[], bruto: string, mensagem: string): Validacao<string | number> {
  const achada = opcoes.find((o) => String(o.valor) === bruto);
  return achada ? { ok: true, valor: achada.valor } : erro(mensagem);
}

/** Valida o valor de um campo do perfil vindo de um formulário. */
export function validarCampo(campo: CampoPerfil, valores: string[], hoje: Date = new Date()): Validacao<unknown> {
  const bruto = (valores[0] ?? "").trim();
  switch (campo) {
    case "apelido": {
      if (bruto.length < 3 || bruto.length > 20) return erro("Use de 3 a 20 caracteres.");
      return { ok: true, valor: bruto };
    }
    case "data_nascimento": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto) || Number.isNaN(Date.parse(bruto))) return erro("Informe uma data válida.");
      const anos = idade(bruto, hoje);
      if (anos < 18) return erro("O Hive Break é para maiores de 18 anos.");
      if (anos > 110) return erro("Confira o ano de nascimento.");
      return { ok: true, valor: bruto };
    }
    case "altura_cm": {
      const n = numero(bruto);
      if (!Number.isFinite(n) || bruto === "") return erro("Informe sua altura em centímetros.");
      // Aceita "1,72" (metros) e converte.
      const cm = Math.round(n < 3 ? n * 100 : n);
      if (cm < 120 || cm > 230) return erro("A altura precisa ficar entre 120 e 230 cm.");
      return { ok: true, valor: cm };
    }
    case "peso_kg": {
      const n = numero(bruto);
      if (!Number.isFinite(n) || bruto === "") return erro("Informe seu peso em quilos.");
      const kg = Math.round(n * 10) / 10;
      if (kg < 30 || kg > 250) return erro("O peso precisa ficar entre 30 e 250 kg.");
      return { ok: true, valor: kg };
    }
    case "sexo":
      return escolha(SEXOS, bruto, "Escolha uma opção.");
    case "objetivo":
      return escolha(OBJETIVOS, bruto, "Escolha um objetivo.");
    case "nivel_atividade":
      return escolha(NIVEIS_ATIVIDADE, bruto, "Escolha uma opção.");
    case "dias_semana":
      return escolha(DIAS_SEMANA, bruto, "Escolha de 2 a 7 dias.");
    case "equipamentos": {
      const marcados = valores.filter((v) => v !== "" && v !== "nenhum");
      if (marcados.some((v) => !EQUIPAMENTOS.some((e) => e.valor === v))) return erro("Opção inválida.");
      if (valores.length === 0) return erro("Marque o que você tem, ou \"Nenhum\".");
      return { ok: true, valor: [...new Set(marcados)] };
    }
  }
}

export function validarFuso(bruto: string): string | null {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: bruto });
    return bruto;
  } catch {
    return null;
  }
}

export function validarInteiro(bruto: string, minimo: number, maximo: number): number | null {
  const n = Number(bruto);
  return Number.isInteger(n) && n >= minimo && n <= maximo ? n : null;
}

/** Linha de public.profiles como o dono a lê. */
export interface Perfil {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  apelido: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  altura_cm: number | null;
  peso_kg: number | null;
  objetivo: string | null;
  nivel_atividade: string | null;
  dias_semana: number | null;
  meta_desafios_dia: number | null;
  equipamentos: string[] | null;
  musica_estilo: string | null;
  volume_musica: number;
  volume_voz: number;
  horario_lembrete: string | null;
  fuso_horario: string;
  /** Segundos da contagem do pop-up "PREPARE-SE" (migração 0009; ausente antes dela). */
  contagem_preparo_s?: number;
  /** Estilo do HUD de treino: "barra" (padrão) ou "moldura" (docs/HUD_TREINO.md). */
  estilo_progresso?: "barra" | "moldura";
  limitacoes: string[];
  peso_meta_kg: number | null;
  visibilidade_peso: "eu" | "variacao" | "tudo";
  esconder_xp: boolean;
  vitrine_conquistas: string[];
  dificuldade_atual: number;
  liberado_alta_intensidade: boolean;
  liberacao_declarada_em: string | null;
  divisao_atual: string;
  nivel_atual: number;
  codigo_convite: string;
  convidado_por: string | null;
  onboarding_concluido_em: string | null;
  criado_em: string;
  /** Visitante (docs/VISITANTE.md, migração 20261122000100; ausentes antes dela). */
  username?: string | null;
  username_trocado_em?: string | null;
  ref_convite?: string | null;
  triagem_respondida_em?: string | null;
  triagem_restricao?: boolean;
  visitante?: boolean;
}

/** Link do próprio perfil (rota /@username): sem username ainda, manda criar um primeiro. */
export function perfilHref(username: string | null | undefined): string {
  return username ? `/@${username}` : "/perfil/username";
}
