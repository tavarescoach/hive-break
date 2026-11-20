import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarBanco, criarUsuario } from "../banco-de-teste";

/**
 * Motor de lembretes (FUNIL_LEMBRETES.md, doc do Luan). Todas as pessoas estão em
 * São Paulo (UTC−3, sem horário de verão). 20/11/2026 é uma sexta-feira.
 */
let db: PGlite;

interface Envio {
  log_id: number;
  user_id: string;
  canal: "email" | "push";
  gatilho: string;
  email: string;
  nome: string;
  assunto: string | null;
  preheader: string | null;
  titulo: string | null;
  texto: string;
  cta_texto: string | null;
  url: string;
  link_desativar: string;
}

let contador = 0;
/** Pessoa com cadastro concluído e a trilha liberada. */
async function pessoa(opcoes: { push?: boolean; convidou?: boolean } = {}) {
  contador += 1;
  const nome = `Pessoa${contador}`;
  const id = await criarUsuario(db, `${nome} Teste`);
  await db.query(
    "update public.profiles set apelido = $2, objetivo = 'forca', onboarding_concluido_em = now() where id = $1",
    [id, nome],
  );
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  // Quem já convidou alguém não recebe o A5, que tem prioridade sobre o hábito.
  if (opcoes.convidou !== false) {
    await db.query("insert into public.lembrete_eventos (user_id, tipo) values ($1, 'invite_sent')", [id]);
  }
  if (opcoes.push) {
    await db.query("insert into public.push_subscriptions (user_id, endpoint, chaves) values ($1, $2, '{}')", [
      id,
      `https://push.exemplo.com/${id}`,
    ]);
  }
  return id;
}

/** Desafio concluído no instante dado (hora de São Paulo). */
async function treinou(id: string, quando: string) {
  await db.query(
    `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em)
     values ($1, 'n1u1d01', 1, 'camera', 'concluido', $2::timestamptz)`,
    [id, `${quando}-03`],
  );
}

async function ofensiva(id: string, atual: number, ultimoDia: string, protetores = 1) {
  await db.query("update public.streaks set atual = $2, ultimo_dia_ativo = $3::date, protetores = $4 where user_id = $1", [
    id,
    atual,
    ultimoDia,
    protetores,
  ]);
}

const pendentes = async (id: string, quando: string) =>
  (await db.query<Envio>("select * from public.lembretes_pendentes($1::timestamptz)", [`${quando}-03`])).rows.filter(
    (r) => r.user_id === id,
  );

const imediato = async (id: string, gatilho: string, dados: object = {}) =>
  (await db.query<Envio>("select * from public.lembrete_imediato($1, $2, $3)", [id, gatilho, JSON.stringify(dados)])).rows;

const gatilhos = (envios: Envio[]) => envios.map((e) => `${e.gatilho}:${e.canal}`).sort();

/**
 * `lembrete_imediato` sempre usa `now()` real (não recebe instante de teste);
 * se o relógio do ambiente cair no silêncio de São Paulo (22h30–8h), o canal
 * push é pulado (lembrete_silencio) e o teste vira dependente da hora real em
 * que rodou. Fuso cujo horário local, agora, cai ao meio-dia — bem longe do
 * silêncio dos dois lados — para o teste valer em qualquer hora real.
 */
function fusoLongeDoSilencio(): string {
  const horaUtc = new Date().getUTCHours();
  let deslocamento = (12 - horaUtc) % 24;
  if (deslocamento > 12) deslocamento -= 24;
  if (deslocamento < -12) deslocamento += 24;
  if (deslocamento === 0) return "Etc/UTC";
  // Convenção POSIX (invertida): Etc/GMT-N = UTC+N; Etc/GMT+N = UTC-N.
  return deslocamento > 0 ? `Etc/GMT-${deslocamento}` : `Etc/GMT+${-deslocamento}`;
}

const config = (chave: string, valor: unknown) =>
  db.query("update public.lembretes_config set valor = $2 where chave = $1", [chave, JSON.stringify(valor)]);

beforeAll(async () => {
  db = await criarBanco();
  await config("APP_URL", "https://app.exemplo.com");
  await config("LEMBRETES_SEGREDO", "segredo-de-teste");
});

beforeEach(async () => {
  await config("LEMBRETES_SIMULAR", false);
  await config("R0_AB_12H_PCT", 0);
});

describe("lembrete diário (R0) no horário da última prática", () => {
  it("sai 24h depois da última prática, com o horário no texto", async () => {
    const ana = await pessoa({ push: true });
    await treinou(ana, "2026-11-18 09:00");
    await treinou(ana, "2026-11-19 15:20");
    await ofensiva(ana, 2, "2026-11-19");

    expect(await pendentes(ana, "2026-11-20 15:10")).toEqual([]);
    const [envio, ...resto] = await pendentes(ana, "2026-11-20 15:25");
    expect(resto).toEqual([]);
    expect(envio).toMatchObject({ gatilho: "R0", canal: "push", titulo: "Hora do break 🐝" });
    expect(envio.texto).toBe("Ontem você fez seu break às 15h20. Bora repetir?");
    expect(envio.url).toBe("https://app.exemplo.com/trilha?utm_source=lembrete&utm_campaign=R0");
    expect(envio.link_desativar).toMatch(new RegExp(`^https://app\\.exemplo\\.com/lembretes/desativar\\?token=${ana}\\.lembrete\\.[0-9a-f]{64}$`));
    // A janela é de 1 h e o aviso sai uma vez só.
    expect(await pendentes(ana, "2026-11-20 15:40")).toEqual([]);
  });

  it("grupo 12h do teste A/B recebe mais cedo", async () => {
    await config("R0_AB_12H_PCT", 100);
    const bia = await pessoa({ push: true });
    await treinou(bia, "2026-11-18 21:00");
    await treinou(bia, "2026-11-19 21:00");
    const envios = await pendentes(bia, "2026-11-20 09:05");
    expect(gatilhos(envios)).toEqual(["R0:push"]);
    const { rows } = await db.query<{ v: { grupo_ab: string } }>("select variaveis as v from public.notification_log where id = $1", [
      envios[0].log_id,
    ]);
    expect(rows[0].v.grupo_ab).toBe("12h");
  });

  it("sem push, vai por e-mail", async () => {
    const caio = await pessoa();
    await treinou(caio, "2026-11-18 10:00");
    await treinou(caio, "2026-11-19 10:00");
    const [envio] = await pendentes(caio, "2026-11-20 10:05");
    expect(envio).toMatchObject({ gatilho: "R0", canal: "email", email: expect.stringContaining("@exemplo.com") });
    expect(envio.assunto).toMatch(/^Seu break de hoje: .+, \d+ min$/);
    expect(envio.cta_texto).toBe("Fazer meu break");
  });
});

describe("horário silencioso", () => {
  it("prática às 23h30 vira lembrete às 8h do dia seguinte, nada antes", async () => {
    const dani = await pessoa({ push: true });
    await treinou(dani, "2026-11-18 23:30");
    await treinou(dani, "2026-11-19 23:30");
    expect(await pendentes(dani, "2026-11-20 07:50")).toEqual([]);
    expect(gatilhos(await pendentes(dani, "2026-11-20 08:05"))).toEqual(["R0:push"]);
  });

  it("push imediato não sai de madrugada", async () => {
    const edu = await pessoa({ push: true });
    await db.query("insert into public.high_fives (de_user, para_user, criado_em) values ($1, $2, now())", [await pessoa(), edu]);
    await db.query("update public.profiles set fuso_horario = 'Pacific/Kiritimati' where id = $1", [edu]);
    const hora = (await db.query<{ h: number }>("select extract(hour from now() at time zone 'Pacific/Kiritimati')::int as h")).rows[0].h;
    const envios = await imediato(edu, "S6", { amigo: "Ana" });
    expect(envios.length).toBe(hora >= 8 && hora < 22 ? 1 : 0);
  });
});

describe("limites diários", () => {
  it("1 e-mail por dia; as boas-vindas (A1) não contam", async () => {
    const fabi = await pessoa();
    await treinou(fabi, "2026-11-18 19:00");
    await treinou(fabi, "2026-11-19 19:00");
    await ofensiva(fabi, 5, "2026-11-19");
    // Boas-vindas de hoje, fora do limite.
    await db.query(
      "insert into public.notification_log (user_id, gatilho, canal, status, criado_em, dia_local) values ($1, 'A1', 'email', 'enviado', '2026-11-20 09:00-03', '2026-11-20')",
      [fabi],
    );
    expect(gatilhos(await pendentes(fabi, "2026-11-20 19:05"))).toEqual(["R0:email"]);
    // R1 às 20h: o e-mail do dia já foi.
    expect(await pendentes(fabi, "2026-11-20 20:05")).toEqual([]);
  });

  it("3 push por dia: o 4º não sai, o e-mail do R1 sai", async () => {
    const gil = await pessoa({ push: true });
    await treinou(gil, "2026-11-18 08:00");
    await treinou(gil, "2026-11-19 08:00");
    await ofensiva(gil, 4, "2026-11-19");
    for (const g of ["S6", "S1", "S4"]) {
      await db.query(
        "insert into public.notification_log (user_id, gatilho, canal, status, criado_em, dia_local) values ($1, $2, 'push', 'enviado', '2026-11-20 12:00-03', '2026-11-20')",
        [gil, g],
      );
    }
    expect(gatilhos(await pendentes(gil, "2026-11-20 20:05"))).toEqual(["R1:email"]);
  });
});

describe("prioridade", () => {
  it("dois gatilhos ao mesmo tempo: sai o mais importante; o outro, na rodada seguinte", async () => {
    const hugo = await pessoa({ push: true });
    await treinou(hugo, "2026-11-18 20:00");
    await treinou(hugo, "2026-11-19 20:00");
    await ofensiva(hugo, 6, "2026-11-19");
    // R0 (hábito, 20h) e R1 (ofensiva, 20h) coincidem: vai o R1 (push e e-mail).
    expect(gatilhos(await pendentes(hugo, "2026-11-20 20:05"))).toEqual(["R1:email", "R1:push"]);
    expect(gatilhos(await pendentes(hugo, "2026-11-20 20:20"))).toEqual(["R0:push"]);
  });

  it("R1b às 22h só para quem não tem protetor", async () => {
    const ivo = await pessoa({ push: true });
    const jac = await pessoa({ push: true });
    for (const id of [ivo, jac]) {
      await treinou(id, "2026-11-18 12:00");
      await treinou(id, "2026-11-19 12:00");
    }
    await ofensiva(ivo, 3, "2026-11-19", 0);
    await ofensiva(jac, 3, "2026-11-19", 1);
    const [envio] = await pendentes(ivo, "2026-11-20 22:05");
    expect(envio).toMatchObject({ gatilho: "R1b", canal: "push" });
    expect(envio.texto).toMatch(/3 dias|dia 4/);
    expect(await pendentes(jac, "2026-11-20 22:05")).toEqual([]);
  });
});

describe("saída ao concluir desafio", () => {
  it("quem já treinou hoje não recebe R0, R1 nem R1b", async () => {
    const lia = await pessoa({ push: true });
    await treinou(lia, "2026-11-18 20:00");
    await treinou(lia, "2026-11-19 20:00");
    await ofensiva(lia, 8, "2026-11-19", 0);
    await treinou(lia, "2026-11-20 19:00");
    await ofensiva(lia, 9, "2026-11-20", 0);
    expect(await pendentes(lia, "2026-11-20 20:05")).toEqual([]);
    expect(await pendentes(lia, "2026-11-20 22:05")).toEqual([]);
  });

  it("aviso enviado seguido de desafio em até 2 h conta como convertido", async () => {
    const mel = await pessoa({ push: true });
    await treinou(mel, "2026-11-18 10:00");
    await treinou(mel, "2026-11-19 10:00");
    const [envio] = await pendentes(mel, "2026-11-20 10:05");
    await db.query("update public.notification_log set status = 'enviado', enviado_em = now() - interval '10 minutes' where id = $1", [
      envio.log_id,
    ]);
    await db.query(
      "insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em) values ($1, 'n1u1d01', 1, 'camera', 'concluido', now())",
      [mel],
    );
    const { rows } = await db.query<{ desafio_em_2h: boolean }>("select desafio_em_2h from public.notification_log where id = $1", [
      envio.log_id,
    ]);
    expect(rows[0].desafio_em_2h).toBe(true);
  });
});

describe("reativação e pausa de 14 dias", () => {
  it("W1 no 3º dia, W2 no 7º, W3 no 14º e depois silêncio", async () => {
    const nina = await pessoa({ push: true });
    await treinou(nina, "2026-11-01 11:00");
    await treinou(nina, "2026-11-02 11:00");
    expect(gatilhos(await pendentes(nina, "2026-11-05 11:05"))).toEqual(["W1:email", "W1:push"]);
    expect(gatilhos(await pendentes(nina, "2026-11-09 11:05"))).toEqual(["W2:email"]);
    const [w3] = await pendentes(nina, "2026-11-16 11:05");
    expect(w3).toMatchObject({ gatilho: "W3", canal: "email", assunto: "Vamos dar um tempo nos lembretes" });
    const pausa = await db.query<{ p: string }>("select pausado_ate::text as p from public.notification_preferences where user_id = $1", [nina]);
    expect(pausa.rows[0].p).toBe("infinity");
    // Pausada: nem o resumo de sábado, nem outro W3.
    expect(await pendentes(nina, "2026-11-17 11:05")).toEqual([]);
    expect(await imediato(nina, "S1", { amigo: "Ana" })).toEqual([]);
  });

  it("voltar a treinar tira a pausa", async () => {
    const otto = await pessoa();
    await db.query("update public.notification_preferences set pausado_ate = 'infinity' where user_id = $1", [otto]);
    await treinou(otto, "2026-11-20 10:00");
    const { rows } = await db.query<{ p: string | null }>("select pausado_ate as p from public.notification_preferences where user_id = $1", [otto]);
    expect(rows[0].p).toBeNull();
  });

  it("quem ainda está na ativação (1 dia feito) não recebe reativação", async () => {
    const pia = await pessoa();
    await treinou(pia, "2026-11-01 11:00");
    expect(await pendentes(pia, "2026-11-04 11:05")).toEqual([]);
  });
});

describe("ativação", () => {
  it("A2: push 2 h depois do cadastro, e-mail no dia seguinte", async () => {
    const rui = await pessoa({ push: true });
    await db.query("update public.profiles set criado_em = '2026-11-20 10:00-03' where id = $1", [rui]);
    expect(gatilhos(await pendentes(rui, "2026-11-20 12:05"))).toEqual(["A2:push"]);
    expect(gatilhos(await pendentes(rui, "2026-11-21 10:05"))).toEqual(["A2:email"]);
  });

  it("A5: no 3º dia, quem ainda não convidou ninguém; uma vez só", async () => {
    const vivi = await pessoa({ convidou: false });
    await treinou(vivi, "2026-11-18 14:00");
    await treinou(vivi, "2026-11-19 14:00");
    await ofensiva(vivi, 2, "2026-11-19");
    expect(await pendentes(vivi, "2026-11-19 14:05")).toEqual([]);
    const [envio] = await pendentes(vivi, "2026-11-20 14:05");
    expect(envio).toMatchObject({ gatilho: "A5", canal: "email", cta_texto: "Chamar no WhatsApp" });
    expect(envio.texto).toContain("2 dias");
    expect(gatilhos(await pendentes(vivi, "2026-11-21 14:05"))).not.toContain("A5:email");
  });

  it("A4: fez o dia 1 ontem, no mesmo horário", async () => {
    const sol = await pessoa({ push: true });
    await treinou(sol, "2026-11-19 13:00");
    const [envio] = await pendentes(sol, "2026-11-20 13:05");
    expect(envio.gatilho).toBe("A4");
  });

  it("A1 uma vez só; A3 só no primeiro dia de treino", async () => {
    const teo = await pessoa();
    expect(gatilhos(await imediato(teo, "A1"))).toEqual(["A1:email"]);
    expect(await imediato(teo, "A1")).toEqual([]);
    expect(await imediato(teo, "A3")).toEqual([]);
    await db.query(
      "insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em) values ($1, 'n1u1d01', 1, 'manual', 'concluido', now())",
      [teo],
    );
    const [a3] = await imediato(teo, "A3");
    expect(a3).toMatchObject({ gatilho: "A3", canal: "email", cta_texto: "Chamar minha hive" });
    // Sem repetições contadas (modo manual): sai a variação sem {reps}.
    expect(a3.texto).not.toMatch(/\{|repetições/);
  });
});

describe("social e marcos", () => {
  it("S3: o amigo já fez hoje, falta a pessoa", async () => {
    const ugo = await pessoa({ push: true });
    const vera = await pessoa();
    const [a, b] = [ugo, vera].sort();
    await db.query("insert into public.friendships (user_a, user_b, origem) values ($1, $2, 'codigo')", [a, b]);
    await treinou(ugo, "2026-11-18 21:00");
    await treinou(ugo, "2026-11-19 21:00");
    await ofensiva(ugo, 4, "2026-11-19");
    await ofensiva(vera, 6, "2026-11-20");
    const [envio] = await pendentes(ugo, "2026-11-20 18:05");
    expect(envio).toMatchObject({ gatilho: "S3", canal: "push" });
    expect(envio.texto + envio.titulo).toContain(`Pessoa${contador}`);
    expect(envio.texto + envio.titulo).toContain("5 dias");
  });

  it("R3: marco de ofensiva uma vez por marco", async () => {
    const wal = await pessoa({ push: true });
    // Marco é imediato e não respeita o silêncio para o canal email, mas o push sim:
    // sem isto, o teste dependeria da hora real em que roda (ver fusoLongeDoSilencio).
    await db.query("update public.profiles set fuso_horario = $2 where id = $1", [wal, fusoLongeDoSilencio()]);
    await ofensiva(wal, 7, "2026-11-20");
    expect(gatilhos(await imediato(wal, "R3"))).toEqual(["R3:email", "R3:push"]);
    await db.query("delete from public.notification_log where user_id = $1 and dia_local is not null and gatilho = 'R3'", [wal]).then(() =>
      db.query(
        "insert into public.notification_log (user_id, gatilho, canal, status, variaveis, criado_em) values ($1, 'R3', 'push', 'enviado', '{\"n\": 7}', now())",
        [wal],
      ),
    );
    expect(await imediato(wal, "R3")).toEqual([]);
    await ofensiva(wal, 8, "2026-11-20");
    expect(await imediato(wal, "R3")).toEqual([]);
  });

  it("S6 agrupado: com vários high fives no dia, sai o número", async () => {
    const xu = await pessoa({ push: true });
    await db.query("update public.profiles set fuso_horario = 'UTC' where id = $1", [xu]);
    const hora = (await db.query<{ h: number }>("select extract(hour from now() at time zone 'UTC')::int as h")).rows[0].h;
    if (hora < 8 || hora >= 22) return; // horário silencioso em UTC: coberto no teste do silêncio.
    for (let i = 0; i < 3; i++) {
      await db.query("insert into public.high_fives (de_user, para_user) values ($1, $2)", [await pessoa(), xu]);
    }
    const [envio] = await imediato(xu, "S6", { amigo: "Ana" });
    expect(envio.texto).toBe("3 pessoas te mandaram high five hoje.");
    expect(await imediato(xu, "S6", { amigo: "Bia" })).toEqual([]);
  });

  it("categoria desligada não recebe", async () => {
    const yan = await pessoa({ push: true });
    await db.query("update public.notification_preferences set ofensiva = false, lembrete = false where user_id = $1", [yan]);
    await treinou(yan, "2026-11-18 20:00");
    await treinou(yan, "2026-11-19 20:00");
    await ofensiva(yan, 6, "2026-11-19");
    expect(await pendentes(yan, "2026-11-20 20:05")).toEqual([]);
  });
});

describe("resumo semanal e hive ao vivo", () => {
  it("R2: sábado às 10h, com o título conforme a semana", async () => {
    const cris = await pessoa();
    await treinou(cris, "2026-11-12 09:00");
    await treinou(cris, "2026-11-17 09:00");
    await treinou(cris, "2026-11-18 09:00");
    const [envio] = await pendentes(cris, "2026-11-21 10:05");
    expect(envio).toMatchObject({ gatilho: "R2", canal: "email", assunto: "Sua semana esquentou 🔥" });
    expect(envio.texto).toContain("2 de 7");
    expect(envio.texto).not.toContain("{");
  });

  it("H2 para o amigo do anfitrião que não entrou; H3 depois que a hive acaba", async () => {
    const anfitriao = await pessoa({ push: true });
    const colega = await pessoa({ push: true });
    const amigo = await pessoa({ push: true });
    for (const outro of [colega, amigo]) {
      const [a, b] = [anfitriao, outro].sort();
      await db.query("insert into public.friendships (user_a, user_b, origem) values ($1, $2, 'codigo')", [a, b]);
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into public.hives (anfitriao_id, challenge_id, inicio_em, fim_em)
       values ($1, 'n1u1d01', '2026-11-20 15:00-03', '2026-11-20 15:10-03') returning id`,
      [anfitriao],
    );
    for (const id of [anfitriao, colega]) {
      await db.query("insert into public.hive_participantes (hive_id, user_id, reps) values ($1, $2, 30)", [rows[0].id, id]);
    }
    const [h2] = await pendentes(amigo, "2026-11-20 15:05");
    expect(h2).toMatchObject({ gatilho: "H2", canal: "push", titulo: "Let's hive 🐝" });
    expect(h2.texto).toBe(`Pessoa${contador - 2} e mais 1 já estão no break. Ainda dá tempo, entra.`);
    expect(h2.url).toBe(`https://app.exemplo.com/hive/${rows[0].id}?utm_source=lembrete&utm_campaign=H2`);
    expect(await pendentes(colega, "2026-11-20 15:05")).toEqual([]);

    // Uma rodada só: ela reserva para todo mundo.
    const rodada = (await db.query<Envio>("select * from public.lembretes_pendentes('2026-11-20 15:20-03')")).rows;
    const h3 = rodada.find((e) => e.user_id === colega);
    expect(h3).toMatchObject({ gatilho: "H3", canal: "email" });
    expect(h3?.assunto).toContain("60 repetições");
    expect(gatilhos(rodada.filter((e) => e.user_id === amigo))).toEqual(["H3:push"]);
  });
});

describe("reserva", () => {
  it("não duplica: a segunda rodada no mesmo horário não devolve nada", async () => {
    const zeca = await pessoa({ push: true });
    await treinou(zeca, "2026-11-18 16:00");
    await treinou(zeca, "2026-11-19 16:00");
    expect(gatilhos(await pendentes(zeca, "2026-11-20 16:05"))).toEqual(["R0:push"]);
    expect(await pendentes(zeca, "2026-11-20 16:05")).toEqual([]);
    expect(await pendentes(zeca, "2026-11-20 16:20")).toEqual([]);
    const { rows } = await db.query<{ n: number; status: string }>(
      "select count(*)::int as n, min(status) as status from public.notification_log where user_id = $1",
      [zeca],
    );
    expect(rows[0]).toEqual({ n: 1, status: "reservado" });
  });

  it("simulação: grava 'simulado' e não devolve a linha", async () => {
    await config("LEMBRETES_SIMULAR", true);
    const abel = await pessoa({ push: true });
    await treinou(abel, "2026-11-18 17:00");
    await treinou(abel, "2026-11-19 17:00");
    expect(await pendentes(abel, "2026-11-20 17:05")).toEqual([]);
    const { rows } = await db.query<{ status: string; texto: string }>("select status, texto from public.notification_log where user_id = $1", [abel]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("simulado");
    expect(rows[0].texto).not.toContain("{");
  });

  it("todo texto do seed usa 'hive', nunca 'colmeia'", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.notification_templates where concat_ws(' ', assunto, preheader, titulo, texto, cta_texto) ilike '%colmeia%'",
    );
    expect(rows[0].n).toBe(0);
    const faltando = await db.query<{ gatilho: string }>(
      `select g.gatilho from public.lembrete_gatilhos g
       where not exists (select 1 from public.notification_templates t where t.gatilho = g.gatilho and t.ativo)`,
    );
    expect(faltando.rows).toEqual([]);
  });
});

describe("role do n8n", () => {
  it("só executa as duas funções e marca status, enviado_em e erro", async () => {
    const bela = await pessoa();
    const [envio] = await imediato(bela, "A1");
    await db.exec("set role n8n_lembretes");
    try {
      await db.query("update public.notification_log set status = 'enviado', enviado_em = now() where id = $1", [envio.log_id]);
      await db.query("select * from public.lembretes_pendentes()");
      await expect(db.query("select texto from public.notification_log limit 1")).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.notification_log set texto = 'x' where id = $1", [envio.log_id])).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select * from public.profiles limit 1")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.lembretes_config")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    const { rows } = await db.query<{ status: string }>("select status from public.notification_log where id = $1", [envio.log_id]);
    expect(rows[0].status).toBe("enviado");
  });

  it("cliente do app (authenticated) não chama o motor", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from public.lembretes_pendentes()")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("funções do app", () => {
  const comoUsuario = async <T>(usuario: string | null, sql: string, params: unknown[] = []) => {
    return db.transaction(async (tx) => {
      const claims = usuario ? { sub: usuario, role: "authenticated" } : { role: "anon" };
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${usuario ? "authenticated" : "anon"}`);
      return (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r;
    });
  };

  it("desativar pelo link: só com token válido", async () => {
    const dora = await pessoa();
    const token = (await db.query<{ t: string }>("select public.lembrete_token($1, 'ofensiva') as t", [dora])).rows[0].t;
    // Troca o último caractere por um garantidamente diferente (nunca o mesmo token por coincidência).
    const ultimoTrocado = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(await comoUsuario(null, "public.desativar_lembretes($1)", [ultimoTrocado])).toEqual({ ok: false });
    expect(await comoUsuario(null, "public.desativar_lembretes($1)", [""])).toEqual({ ok: false });
    expect(await comoUsuario(null, "public.desativar_lembretes($1)", [token])).toEqual({ ok: true, categoria: "ofensiva" });
    let prefs = (await db.query("select ofensiva, lembrete, email_ativo from public.notification_preferences where user_id = $1", [dora])).rows[0];
    expect(prefs).toEqual({ ofensiva: false, lembrete: true, email_ativo: true });
    expect(await comoUsuario(null, "public.desativar_lembretes($1, true)", [token])).toEqual({ ok: true, categoria: "todos" });
    prefs = (await db.query("select ofensiva, lembrete, email_ativo from public.notification_preferences where user_id = $1", [dora])).rows[0];
    expect(prefs).toEqual({ ofensiva: false, lembrete: false, email_ativo: false });
  });

  it("dados do push só com o segredo; abertura só com a assinatura", async () => {
    const ema = await pessoa({ push: true });
    await treinou(ema, "2026-11-18 11:00");
    await treinou(ema, "2026-11-19 11:00");
    const [envio] = await pendentes(ema, "2026-11-20 11:05");
    await expect(comoUsuario(null, "public.lembrete_push_dados('errado', $1)", [envio.log_id])).rejects.toThrow(/segredo_invalido/);
    const dados = await comoUsuario<{ titulo: string; inscricoes: { endpoint: string }[] }>(
      null, "public.lembrete_push_dados('segredo-de-teste', $1)", [envio.log_id]);
    expect(dados.titulo).toBe(envio.titulo);
    expect(dados.inscricoes).toHaveLength(1);
    expect(await comoUsuario(null, "public.lembrete_push_desativar('segredo-de-teste', $1)", [[dados.inscricoes[0].endpoint]])).toBe(1);
    const assinatura = (await db.query<{ a: string }>("select public.lembrete_assinatura_abertura($1) as a", [envio.log_id])).rows[0].a;
    expect(await comoUsuario(null, "public.registrar_abertura_lembrete($1, 'x')", [envio.log_id])).toBe(false);
    expect(await comoUsuario(null, "public.registrar_abertura_lembrete($1, $2)", [envio.log_id, assinatura])).toBe(true);
  });

  it("depois do desafio: A3 no 1º dia, S5 para os amigos de quem volta, S4 para quem foi ultrapassado", async () => {
    const fred = await pessoa();
    const gabi = await pessoa();
    const [a, b] = [fred, gabi].sort();
    await db.query("insert into public.friendships (user_a, user_b, origem) values ($1, $2, 'codigo')", [a, b]);
    await db.query(
      "insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em) values ($1, 'n1u1d01', 1, 'camera', 'concluido', now())",
      [fred],
    );
    const primeiro = await comoUsuario<{ gatilho: string }[]>(fred, "public.lembretes_apos_desafio(null)");
    expect(primeiro.map((e) => e.gatilho)).toEqual(["A3"]);

    await db.query("update public.challenge_attempts set concluido_em = now() - interval '20 days' where user_id = $1", [fred]);
    await db.query(
      "insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em) values ($1, 'n1u1d01', 1, 'camera', 'concluido', now())",
      [fred],
    );
    // Os dois entraram em grupos ao terminar o cadastro; aqui ficam juntos num grupo só.
    await db.query(
      `delete from public.league_members m using public.leagues l
       where m.league_id = l.id and m.user_id in ($1, $2) and l.semana_inicio = public.liga_semana_inicio()`, [fred, gabi]);
    const { rows } = await db.query<{ id: string }>(
      "insert into public.leagues (divisao, semana_inicio, semana_fim) values ('bronze', public.liga_semana_inicio(), public.liga_semana_inicio() + 6) returning id",
    );
    await db.query("insert into public.league_members (league_id, user_id, pontos) values ($1, $2, 30), ($1, $3, 25)", [rows[0].id, fred, gabi]);
    const eventos = await comoUsuario<{ user_id: string; gatilho: string; dados: Record<string, unknown> }[]>(
      fred, "public.lembretes_apos_desafio(20)");
    expect(eventos).toEqual([
      { user_id: gabi, gatilho: "S5", dados: { amigo: expect.any(String), tempo: "20 dias" } },
      { user_id: gabi, gatilho: "S4", dados: { amigo: expect.any(String), xp: 6 } },
    ]);
  });

  it("salvar push liga o push e troca o dono do aparelho", async () => {
    const hel = await pessoa();
    await db.query("update public.notification_preferences set push_ativo = false where user_id = $1", [hel]);
    await comoUsuario(hel, "public.salvar_push('https://push.exemplo.com/compartilhado', '{\"p256dh\":\"a\",\"auth\":\"b\"}', 'Android')");
    const iris = await pessoa();
    await comoUsuario(iris, "public.salvar_push('https://push.exemplo.com/compartilhado', '{\"p256dh\":\"a\",\"auth\":\"b\"}', null)");
    const { rows } = await db.query("select user_id from public.push_subscriptions where endpoint = 'https://push.exemplo.com/compartilhado'");
    expect(rows).toEqual([{ user_id: iris }]);
    const pref = await db.query("select push_ativo from public.notification_preferences where user_id = $1", [hel]);
    expect(pref.rows[0]).toEqual({ push_ativo: true });
  });

  it("admin: só quem está em ADMINS lê o log e dispara teste para si", async () => {
    const jo = await pessoa({ push: true });
    await expect(comoUsuario(jo, "public.lembretes_admin_log(10)")).rejects.toThrow(/sem_permissao/);
    await config("ADMINS", [jo]);
    await config("LEMBRETES_SIMULAR", true);
    const log = await comoUsuario<{ simular: boolean; gatilhos: string[] }>(jo, "public.lembretes_admin_log(10)");
    expect(log.simular).toBe(true);
    expect(log.gatilhos).toContain("R1b");
    // Disparo de teste: ignora simulação e limites, com valores de exemplo.
    const envios = await imediato(jo, "S4", { teste: true });
    expect(envios).toHaveLength(1);
    expect(envios[0].texto).not.toContain("{");
    expect(await imediato(jo, "R1", { teste: true })).toHaveLength(2);
    // Quem não é admin não usa o modo teste.
    expect(await imediato(await pessoa(), "R1", { teste: true })).toEqual([]);
  });
});
