import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

/**
 * Resgate: "fulano está há 3 dias sem break" (docs/RESGATE.md). Os testes da
 * seção 10 do documento.
 */
let db: PGlite;

interface Candidato {
  amigo_id: string;
  apelido: string;
  avatar_url: string | null;
  dias_parado: number;
  hives_juntos: number;
  convidado_por_mim: boolean;
  amizade_em: string | null;
  app_disponivel: boolean;
}

interface EnvioResgate {
  id: number;
  para_usuario_id: string;
  canal: "app" | "whatsapp" | "hive";
  caminho: string;
  app_disponivel: boolean;
}

const rpc = <T>(usuario: string | null, sql: string, params: unknown[] = []) =>
  como(db, { usuario }, async (tx) => (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r);

let contador = 0;
async function pessoa() {
  contador += 1;
  const nome = `Pessoa${contador}`;
  const id = await criarUsuario(db, nome);
  await db.query("update public.profiles set apelido = $2, onboarding_concluido_em = now() where id = $1", [id, nome]);
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  return id;
}

/** Marca N desafios concluídos, o último há `dias` dias (section 2: >=2 na vida). */
async function historico(id: string, dias: number, totalDesafios = 2) {
  for (let i = 0; i < totalDesafios - 1; i++) {
    await db.query(
      `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
       values ($1, 'n1u1d01', 1, 'manual', 'concluido', now() - interval '60 days', 1)`,
      [id],
    );
  }
  await db.query(
    `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
     values ($1, 'n1u1d01', 1, 'manual', 'concluido', now() - ($2 || ' days')::interval, 1)`,
    [id, String(dias)],
  );
}

async function amizade(a: string, b: string) {
  const [x, y] = [a, b].sort();
  await db.query("insert into public.friendships (user_a, user_b, origem) values ($1, $2, 'codigo')", [x, y]);
}

const BLOCOS = (reps: number) => `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
  'tempo_valido_s', 0, 'fora_quadro_pct', 0, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
const concluirDesafio = (usuario: string, desafio = "n1u1d01", reps = 10) =>
  rpc<{ xp: number }>(usuario, `public.finalizar_desafio($1, 'camera', ${BLOCOS(reps)})`, [desafio]);

const candidatos = (usuario: string) =>
  como(db, { usuario }, async (tx) => (await tx.query<Candidato>("select * from public.amigos_para_resgatar()")).rows);
const enviar = (de: string, para: string, familia: "D" | "B" | "C", gancho: string, texto: string, canal: "app" | "whatsapp" | "hive" = "whatsapp") =>
  rpc<EnvioResgate>(de, "public.enviar_resgate($1, $2, $3, $4, $5)", [para, familia, gancho, texto, canal]);

beforeAll(async () => {
  db = await criarBanco();
});

describe("amigos_para_resgatar", () => {
  it("amigo com 2 dias sem treino não aparece; com 3 aparece", async () => {
    const ana = await pessoa();
    const bruno = await pessoa();
    await amizade(ana, bruno);
    await historico(bruno, 2);
    expect((await candidatos(ana)).map((c) => c.amigo_id)).not.toContain(bruno);

    await db.query("update public.challenge_attempts set concluido_em = now() - interval '3 days' where user_id = $1", [bruno]);
    const lista = await candidatos(ana);
    expect(lista.map((c) => c.amigo_id)).toContain(bruno);
    expect(lista.find((c) => c.amigo_id === bruno)?.dias_parado).toBe(3);
  });

  it("amigo recém-cadastrado (menos de 2 desafios) não aparece", async () => {
    const ana = await pessoa();
    const bruno = await pessoa();
    await amizade(ana, bruno);
    await historico(bruno, 5, 1);
    expect((await candidatos(ana)).map((c) => c.amigo_id)).not.toContain(bruno);
  });

  it("amigo resgatado hoje por outra pessoa não aparece de novo", async () => {
    const ana = await pessoa();
    const carla = await pessoa();
    const bruno = await pessoa();
    await amizade(ana, bruno);
    await amizade(carla, bruno);
    await historico(bruno, 4);
    expect((await candidatos(ana)).map((c) => c.amigo_id)).toContain(bruno);

    await enviar(carla, bruno, "C", "RC2", "Sentimos sua falta na hive. 3 minutinhos hoje?");
    expect((await candidatos(ana)).map((c) => c.amigo_id)).not.toContain(bruno);
  });

  it("resgatado com categoria Amigos/Hive desligada: só aparece a opção WhatsApp", async () => {
    const ana = await pessoa();
    const bruno = await pessoa();
    await amizade(ana, bruno);
    await historico(bruno, 4);
    await db.query("update public.notification_preferences set amigos = false where user_id = $1", [bruno]);

    const candidato = (await candidatos(ana)).find((c) => c.amigo_id === bruno);
    expect(candidato?.app_disponivel).toBe(false);
    await expect(enviar(ana, bruno, "C", "RC2", "Bora voltar?", "app")).rejects.toThrow(/canal_indisponivel/);
    const r = await enviar(ana, bruno, "C", "RC2", "Bora voltar?", "whatsapp");
    expect(r.canal).toBe("whatsapp");
  });
});

describe("limites de envio (seção 7)", () => {
  it("4º resgate do dia de quem resgata é bloqueado", async () => {
    const ana = await pessoa();
    const amigos: string[] = [];
    for (let i = 0; i < 4; i++) {
      const amigo = await pessoa();
      await amizade(ana, amigo);
      await historico(amigo, 4);
      amigos.push(amigo);
    }
    await enviar(ana, amigos[0], "D", "RD3", "Revanche? Meu placar tá te esperando.");
    await enviar(ana, amigos[1], "D", "RD3", "Revanche? Meu placar tá te esperando.");
    await enviar(ana, amigos[2], "D", "RD3", "Revanche? Meu placar tá te esperando.");
    await expect(enviar(ana, amigos[3], "D", "RD3", "Revanche? Meu placar tá te esperando.")).rejects.toThrow(/limite_diario_enviado/);
  });

  it("4º resgate da semana para o mesmo resgatado é bloqueado", async () => {
    const ana = await pessoa();
    const fernanda = await pessoa();
    await amizade(ana, fernanda);
    await historico(fernanda, 4);

    for (let i = 0; i < 3; i++) {
      const quemChamou = await pessoa();
      await db.query(
        `insert into public.resgates (de_usuario_id, para_usuario_id, familia, gancho_id, texto_final, canal, enviado_em)
         values ($1, $2, 'C', 'RC2', 'Bora voltar?', 'whatsapp', now() - interval '1 day' * $3)`,
        [quemChamou, fernanda, i + 2],
      );
    }
    expect((await candidatos(ana)).map((c) => c.amigo_id)).not.toContain(fernanda);
    await expect(enviar(ana, fernanda, "C", "RC2", "Bora voltar?")).rejects.toThrow(/candidato_invalido/);
  });
});

describe("recompensa ao voltar (seção 6)", () => {
  const protetoresDe = async (id: string) =>
    (await db.query<{ protetores: number }>("select protetores from public.streaks where user_id = $1", [id])).rows[0].protetores;
  const linhaResgate = async (de: string, para: string) =>
    (await db.query<{ voltou_em: string | null; recompensa_dada: boolean }>(
      "select voltou_em, recompensa_dada from public.resgates where de_usuario_id = $1 and para_usuario_id = $2",
      [de, para],
    )).rows[0];
  const abrirResgate = (de: string, para: string, horasAtras: number) =>
    db.query(
      `insert into public.resgates (de_usuario_id, para_usuario_id, familia, gancho_id, texto_final, canal, enviado_em)
       values ($1, $2, 'D', 'RD3', 'Revanche?', 'whatsapp', now() - interval '1 hour' * $3)`,
      [de, para, horasAtras],
    );

  it("volta em 47h dá recompensa; em 49h não dá", async () => {
    const ana = await pessoa();
    const perto = await pessoa();
    const longe = await pessoa();
    for (const amigo of [perto, longe]) {
      await amizade(ana, amigo);
      await historico(amigo, 4);
    }

    await abrirResgate(ana, perto, 47);
    await concluirDesafio(perto);
    await rpc(perto, "public.resgate_concluir()");
    expect(await protetoresDe(ana)).toBe(1);
    expect(await linhaResgate(ana, perto)).toMatchObject({ recompensa_dada: true });

    await abrirResgate(ana, longe, 49);
    await concluirDesafio(longe);
    await rpc(longe, "public.resgate_concluir()");
    expect(await protetoresDe(ana)).toBe(1);
    const r = await linhaResgate(ana, longe);
    expect(r.voltou_em).toBeNull();
    expect(r.recompensa_dada).toBe(false);
  });

  it("no máximo 2 protetores de resgate por mês, mesmo com mais voltas em 48h", async () => {
    const ana = await pessoa();
    const amigos: string[] = [];
    for (let i = 0; i < 3; i++) {
      const amigo = await pessoa();
      await amizade(ana, amigo);
      await historico(amigo, 4);
      amigos.push(amigo);
    }

    for (const amigo of amigos) {
      await abrirResgate(ana, amigo, 10);
      await concluirDesafio(amigo);
      await rpc(amigo, "public.resgate_concluir()");
    }

    expect(await protetoresDe(ana)).toBe(2);
    expect(await linhaResgate(ana, amigos[0])).toMatchObject({ recompensa_dada: true });
    expect(await linhaResgate(ana, amigos[1])).toMatchObject({ recompensa_dada: true });
    // A 3ª volta fecha o resgate (conta para a métrica), mas sem recompensa: o teto do mês já foi batido.
    const terceira = await linhaResgate(ana, amigos[2]);
    expect(terceira.voltou_em).not.toBeNull();
    expect(terceira.recompensa_dada).toBe(false);
  });
});

describe("funil de lembretes (seção 1 e 8)", () => {
  /**
   * O W1 só dispara dentro de 1h do horário da última prática, e
   * lembrete_no_dia empurra horários de silêncio (22h30–8h) para as 8h. Se
   * historico() usasse o horário real de "agora" (que pode cair no silêncio,
   * dependendo de quando o teste roda), tanto a última prática quanto a
   * janela esperada dependeriam da hora real. Aqui as duas ficam fixas às
   * 15h de São Paulo — um horário que nunca é empurrado — mudando só a data
   * real (hoje, hoje−3) para a conta de dias bater.
   */
  /** "Hoje" (data real) menos `diasAtras`, sempre às 15h de São Paulo (nunca cai no silêncio). */
  const AS_15H_SP = (diasAtras: string) =>
    `(((now() at time zone 'America/Sao_Paulo')::date - (${diasAtras})::int) + time '15:00') at time zone 'America/Sao_Paulo'`;

  async function historicoNoHorarioSeguro(id: string, dias: number) {
    await db.query(
      `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
       values ($1, 'n1u1d01', 1, 'manual', 'concluido', now() - interval '60 days', 1),
              ($1, 'n1u1d01', 1, 'manual', 'concluido', ${AS_15H_SP("$2")}, 1)`,
      [id, dias],
    );
  }

  const pendentesDe = async (id: string) =>
    (
      await db.query<{ gatilho: string }>(
        `select gatilho from public.lembretes_pendentes(${AS_15H_SP("0")}) where user_id = $1`,
        [id],
      )
    ).rows;

  it("W1 dispara normalmente para quem está há 3 dias sem desafio", async () => {
    await db.query("update public.lembretes_config set valor = 'false' where chave = 'LEMBRETES_SIMULAR'");
    const ana = await pessoa();
    await historicoNoHorarioSeguro(ana, 3);
    expect((await pendentesDe(ana)).map((r) => r.gatilho)).toContain("W1");
  });

  it("W1 é suprimido no dia em que a pessoa recebeu um resgate", async () => {
    await db.query("update public.lembretes_config set valor = 'false' where chave = 'LEMBRETES_SIMULAR'");
    const carla = await pessoa();
    const bruno = await pessoa();
    await amizade(carla, bruno);
    await historicoNoHorarioSeguro(carla, 3);
    await db.query(
      `insert into public.resgates (de_usuario_id, para_usuario_id, familia, gancho_id, texto_final, canal)
       values ($1, $2, 'D', 'RD3', 'Revanche?', 'whatsapp')`,
      [bruno, carla],
    );
    expect((await pendentesDe(carla)).map((r) => r.gatilho)).not.toContain("W1");
  });
});
