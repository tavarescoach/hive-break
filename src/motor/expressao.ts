/**
 * Interpretador das condições escritas nas definições de exercício, por exemplo:
 *   "medida > 160"
 *   "min_medida entre 100 e 120"
 *   "dist(joelhos) < 0.8 * dist(tornozelos)"
 *   "pes_abertura > 1.5 e maos_cabeca > 0"
 *
 * É um analisador próprio e pequeno: não usa eval nem executa código.
 *
 * Gramática:
 *   ou      := e ("ou" e)*
 *   e       := nao ("e" nao)*
 *   nao     := "nao" nao | comp
 *   comp    := soma ((">" | "<" | ">=" | "<=") soma | "entre" soma "e" soma)?
 *   soma    := prod (("+" | "-") prod)*
 *   prod    := unario (("*" | "/") unario)*
 *   unario  := "-" unario | primario
 *   primario:= numero | nome | funcao "(" args ")" | "(" ou ")"
 */

export type No =
  | { tipo: "num"; valor: number }
  | { tipo: "var"; nome: string }
  | { tipo: "dist"; pontos: string[] }
  | { tipo: "func"; nome: "abs" | "min" | "max"; args: No[] }
  | { tipo: "neg"; arg: No }
  | { tipo: "arit"; op: "+" | "-" | "*" | "/"; a: No; b: No }
  | { tipo: "comp"; op: ">" | "<" | ">=" | "<="; a: No; b: No }
  | { tipo: "entre"; valor: No; minimo: No; maximo: No }
  | { tipo: "e"; a: No; b: No }
  | { tipo: "ou"; a: No; b: No }
  | { tipo: "nao"; arg: No };

export interface Contexto {
  /** Valor de uma variável (medida, min_/max_ de medida). NaN se indisponível. */
  variavel(nome: string): number;
  /** Distância na imagem: um plural ("joelhos") ou dois nomes de ponto. */
  dist(pontos: string[]): number;
}

type Token = { tipo: "num"; valor: number } | { tipo: "nome"; valor: string } | { tipo: "simb"; valor: string };

const PALAVRAS = new Set(["e", "ou", "nao", "entre"]);
const FUNCOES = new Set(["abs", "min", "max"]);

function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < texto.length && /[0-9.]/.test(texto[j])) j++;
      const valor = Number(texto.slice(i, j));
      if (Number.isNaN(valor)) throw new Error(`Número inválido em "${texto}"`);
      tokens.push({ tipo: "num", valor });
      i = j;
    } else if (/[a-zA-Z_áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(c)) {
      let j = i;
      while (j < texto.length && /[a-zA-Z0-9_áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(texto[j])) j++;
      let valor = texto.slice(i, j);
      if (valor === "não") valor = "nao";
      tokens.push({ tipo: "nome", valor });
      i = j;
    } else if ((c === ">" || c === "<") && texto[i + 1] === "=") {
      tokens.push({ tipo: "simb", valor: c + "=" });
      i += 2;
    } else if ("><+-*/(),".includes(c)) {
      tokens.push({ tipo: "simb", valor: c });
      i++;
    } else {
      throw new Error(`Caractere inesperado "${c}" em "${texto}"`);
    }
  }
  return tokens;
}

class Analisador {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly texto: string,
  ) {}

  analisar(): No {
    const no = this.ou();
    if (this.pos < this.tokens.length) throw this.erro("sobrou texto no fim");
    return no;
  }

  private erro(msg: string): Error {
    return new Error(`Condição inválida "${this.texto}": ${msg}`);
  }

  private espiar(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eh(tipo: Token["tipo"], valor: string): boolean {
    const t = this.espiar();
    return !!t && t.tipo === tipo && t.valor === valor;
  }

  private consumir(tipo: Token["tipo"], valor: string): void {
    if (!this.eh(tipo, valor)) throw this.erro(`esperava "${valor}"`);
    this.pos++;
  }

  private ou(): No {
    let no = this.e();
    while (this.eh("nome", "ou")) {
      this.pos++;
      no = { tipo: "ou", a: no, b: this.e() };
    }
    return no;
  }

  private e(): No {
    let no = this.nao();
    while (this.eh("nome", "e")) {
      this.pos++;
      no = { tipo: "e", a: no, b: this.nao() };
    }
    return no;
  }

  private nao(): No {
    if (this.eh("nome", "nao")) {
      this.pos++;
      return { tipo: "nao", arg: this.nao() };
    }
    return this.comp();
  }

  private comp(): No {
    const a = this.soma();
    const t = this.espiar();
    if (t?.tipo === "simb" && (t.valor === ">" || t.valor === "<" || t.valor === ">=" || t.valor === "<=")) {
      this.pos++;
      return { tipo: "comp", op: t.valor, a, b: this.soma() };
    }
    if (this.eh("nome", "entre")) {
      this.pos++;
      const minimo = this.soma();
      this.consumir("nome", "e");
      const maximo = this.soma();
      return { tipo: "entre", valor: a, minimo, maximo };
    }
    return a;
  }

  private soma(): No {
    let no = this.prod();
    for (;;) {
      const t = this.espiar();
      if (t?.tipo === "simb" && (t.valor === "+" || t.valor === "-")) {
        this.pos++;
        no = { tipo: "arit", op: t.valor, a: no, b: this.prod() };
      } else return no;
    }
  }

  private prod(): No {
    let no = this.unario();
    for (;;) {
      const t = this.espiar();
      if (t?.tipo === "simb" && (t.valor === "*" || t.valor === "/")) {
        this.pos++;
        no = { tipo: "arit", op: t.valor, a: no, b: this.unario() };
      } else return no;
    }
  }

  private unario(): No {
    if (this.eh("simb", "-")) {
      this.pos++;
      return { tipo: "neg", arg: this.unario() };
    }
    return this.primario();
  }

  private primario(): No {
    const t = this.espiar();
    if (!t) throw this.erro("terminou cedo demais");
    if (t.tipo === "num") {
      this.pos++;
      return { tipo: "num", valor: t.valor };
    }
    if (t.tipo === "simb" && t.valor === "(") {
      this.pos++;
      const no = this.ou();
      this.consumir("simb", ")");
      return no;
    }
    if (t.tipo === "nome") {
      if (PALAVRAS.has(t.valor)) throw this.erro(`"${t.valor}" fora de lugar`);
      this.pos++;
      if (this.eh("simb", "(")) {
        this.pos++;
        if (t.valor === "dist") {
          const pontos: string[] = [];
          do {
            const p = this.espiar();
            if (p?.tipo !== "nome") throw this.erro("dist() espera nomes de pontos");
            pontos.push(p.valor);
            this.pos++;
          } while (this.eh("simb", ",") && ++this.pos);
          this.consumir("simb", ")");
          if (pontos.length < 1 || pontos.length > 2) throw this.erro("dist() espera 1 ou 2 pontos");
          return { tipo: "dist", pontos };
        }
        if (!FUNCOES.has(t.valor)) throw this.erro(`função desconhecida "${t.valor}"`);
        const args: No[] = [this.soma()];
        while (this.eh("simb", ",")) {
          this.pos++;
          args.push(this.soma());
        }
        this.consumir("simb", ")");
        const nome = t.valor as "abs" | "min" | "max";
        if (nome === "abs" && args.length !== 1) throw this.erro("abs() espera 1 valor");
        return { tipo: "func", nome, args };
      }
      return { tipo: "var", nome: t.valor };
    }
    throw this.erro(`símbolo inesperado "${t.valor}"`);
  }
}

export function analisar(texto: string): No {
  return new Analisador(tokenizar(texto), texto).analisar();
}

function numero(no: No, ctx: Contexto): number {
  switch (no.tipo) {
    case "num":
      return no.valor;
    case "var":
      return ctx.variavel(no.nome);
    case "dist":
      return ctx.dist(no.pontos);
    case "neg":
      return -numero(no.arg, ctx);
    case "func": {
      const v = no.args.map((a) => numero(a, ctx));
      if (no.nome === "abs") return Math.abs(v[0]);
      if (v.some(Number.isNaN)) return NaN;
      return no.nome === "min" ? Math.min(...v) : Math.max(...v);
    }
    case "arit": {
      const a = numero(no.a, ctx);
      const b = numero(no.b, ctx);
      if (no.op === "+") return a + b;
      if (no.op === "-") return a - b;
      if (no.op === "*") return a * b;
      return a / b;
    }
    default:
      throw new Error("Esperava um valor numérico, mas a expressão é uma condição");
  }
}

/**
 * Avalia uma condição. `folga` afrouxa as comparações (histerese): com folga 5,
 * "medida > 160" continua verdadeira até a medida cair abaixo de 155.
 * Qualquer valor indisponível (NaN) torna a comparação falsa.
 */
export function avaliarCondicao(no: No, ctx: Contexto, folga = 0): boolean {
  switch (no.tipo) {
    case "comp": {
      const a = numero(no.a, ctx);
      const b = numero(no.b, ctx);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (no.op === ">") return a > b - folga;
      if (no.op === ">=") return a >= b - folga;
      if (no.op === "<") return a < b + folga;
      return a <= b + folga;
    }
    case "entre": {
      const v = numero(no.valor, ctx);
      const lo = numero(no.minimo, ctx);
      const hi = numero(no.maximo, ctx);
      if (Number.isNaN(v) || Number.isNaN(lo) || Number.isNaN(hi)) return false;
      return v >= lo - folga && v <= hi + folga;
    }
    case "e":
      return avaliarCondicao(no.a, ctx, folga) && avaliarCondicao(no.b, ctx, folga);
    case "ou":
      return avaliarCondicao(no.a, ctx, folga) || avaliarCondicao(no.b, ctx, folga);
    case "nao":
      return !avaliarCondicao(no.arg, ctx, -folga);
    default:
      throw new Error("A expressão precisa ser uma condição (comparação), não um número");
  }
}

export function avaliarNumero(no: No, ctx: Contexto): number {
  return numero(no, ctx);
}

/** Nomes de variáveis usados na expressão (para validar a definição). */
export function variaveisUsadas(no: No, acc = new Set<string>()): Set<string> {
  switch (no.tipo) {
    case "var":
      acc.add(no.nome);
      break;
    case "neg":
    case "nao":
      variaveisUsadas(no.arg, acc);
      break;
    case "func":
      no.args.forEach((a) => variaveisUsadas(a, acc));
      break;
    case "arit":
    case "comp":
    case "e":
    case "ou":
      variaveisUsadas(no.a, acc);
      variaveisUsadas(no.b, acc);
      break;
    case "entre":
      variaveisUsadas(no.valor, acc);
      variaveisUsadas(no.minimo, acc);
      variaveisUsadas(no.maximo, acc);
      break;
  }
  return acc;
}

/** Pontos citados em dist() (para validar a definição). */
export function distsUsadas(no: No, acc: string[][] = []): string[][] {
  switch (no.tipo) {
    case "dist":
      acc.push(no.pontos);
      break;
    case "neg":
    case "nao":
      distsUsadas(no.arg, acc);
      break;
    case "func":
      no.args.forEach((a) => distsUsadas(a, acc));
      break;
    case "arit":
    case "comp":
    case "e":
    case "ou":
      distsUsadas(no.a, acc);
      distsUsadas(no.b, acc);
      break;
    case "entre":
      distsUsadas(no.valor, acc);
      distsUsadas(no.minimo, acc);
      distsUsadas(no.maximo, acc);
      break;
  }
  return acc;
}
