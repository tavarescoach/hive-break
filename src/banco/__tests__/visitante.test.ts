import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

/**
 * Visitante (docs/VISITANTE.md): joga antes do cadastro e vira conta ao
 * confirmar o e-mail. O usuário anônimo é criado como o Supabase Auth cria
 * (is_anonymous = true, sem e-mail); a confirmação do código grava o e-mail.
 */
let db: PGlite;

const rpc = <T>(usuario: string | null, sql: string, params: unknown[] = []) =>
  como(db, { usuario }, async (tx) => (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r);
const blocos = (reps: number) => `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
  'tempo_valido_s', 0, 'fora_quadro_pct', 0, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
const concluir = (usuario: string, desafio: string) =>
  rpc(usuario, `public.finalizar_desafio($1, 'camera', ${blocos(10)})`, [desafio]);

async function anonimo(): Promise<string> {
  const { rows } = await db.query<{ id: string }>("insert into auth.users (is_anonymous) values (true) returning id");
  return rows[0].id;
}

/** Conta com cadastro completo (o "quem convidou"). */
async function pessoa(nome: string) {
  const id = await criarUsuario(db, nome);
  await db.query("update public.profiles set apelido = $2, onboarding_concluido_em = now() where id = $1", [id, nome]);
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  return id;
}

const codigo = async (id: string) =>
  (await db.query<{ codigo_convite: string }>("select codigo_convite from public.profiles where id = $1", [id])).rows[0].codigo_convite;
const perfil = async (id: string) =>
  (await db.query<Record<string, unknown>>("select * from public.profiles where id = $1", [id])).rows[0];
const eventos = async (id: string) =>
  (await db.query<{ tipo: string }>("select tipo from public.eventos_visitante where user_id = $1 order by id", [id])).rows.map((r) => r.tipo);
const confirmarEmail = (id: string, email: string) =>
  db.query("update auth.users set email = $2, is_anonymous = false where id = $1", [id, email]);
const pontosLiga = async (id: string) =>
  (await db.query<{ pontos: number }>(
    `select m.pontos::int as pontos from public.league_members m join public.leagues l on l.id = m.league_id
     where m.user_id = $1 and l.semana_inicio = public.liga_semana_inicio()`, [id])).rows[0]?.pontos;

/** Visitante com username, aceites e declaração feitos. */
async function visitante(username: string, opcoes: { ref?: string; restricao?: boolean; familia?: string; gancho?: string } = {}) {
  const id = await anonimo();
  const r = await rpc<{ ok: boolean }>(id, "public.criar_visitante($1, true, 'v1', $2, $3, $4)",
    [username, opcoes.ref ?? null, opcoes.familia ?? null, opcoes.gancho ?? null]);
  expect(r.ok).toBe(true);
  await rpc(id, "public.registrar_declaracao_saude($1, true, 'v1')", [!opcoes.restricao]);
  return id;
}

beforeAll(async () => {
  db = await criarBanco();
});

describe("username", () => {
  const verificar = (nome: string) => rpc<{ ok: boolean; motivo: string | null; sugestoes: string[] }>(null, "public.username_verificar($1)", [nome]);

  it("aceita letras, números, ponto e sublinhado, de 3 a 20", async () => {
    expect(await verificar("joana.silva_23")).toMatchObject({ ok: true, motivo: null });
    expect(await verificar("Ana")).toMatchObject({ ok: true });
  });

  it("recusa curto, longo, com espaço ou acento", async () => {
    for (const nome of ["jo", "a".repeat(21), "joana silva", "joão", "joana-silva", ""]) {
      expect((await verificar(nome)).motivo, nome).toBe("formato");
    }
  });

  it("recusa palavrão, mesmo disfarçado com ponto, e não barra palavra parecida", async () => {
    expect((await verificar("caralho")).motivo).toBe("proibido");
    expect((await verificar("p.o.r.r.a")).motivo).toBe("proibido");
    expect((await verificar("cu")).motivo).toBe("formato");
    expect((await verificar("cu_1")).motivo).toBe("proibido");
    expect((await verificar("cuidado")).ok).toBe(true);
    expect((await verificar("paulo")).ok).toBe(true);
  });

  it("recusa nomes reservados, com ou sem número", async () => {
    for (const nome of ["admin", "Admin2", "hivebreak", "hive_break_oficial", "suporte.hb", "luan", "luan23", "oficial"]) {
      expect((await verificar(nome)).motivo, nome).toBe("reservado");
    }
    expect((await verificar("luana")).ok).toBe(true);
  });

  it("username em uso, sem diferenciar maiúsculas, traz sugestões livres", async () => {
    await visitante("joana");
    const r = await verificar("JOANA");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("em_uso");
    expect(r.sugestoes).toContain("joana.break");
    expect(r.sugestoes.length).toBe(3);
    for (const s of r.sugestoes) expect((await verificar(s)).ok, s).toBe(true);
    expect(r.sugestoes.some((s) => /^joana[._]\d{2}$/.test(s) || s === "joana_hb")).toBe(true);
  });

  it("criar_visitante devolve o motivo e as sugestões sem gravar", async () => {
    const id = await anonimo();
    const r = await rpc<{ ok: boolean; motivo: string; sugestoes: string[] }>(id, "public.criar_visitante('Joana', true, 'v1')");
    expect(r).toMatchObject({ ok: false, motivo: "em_uso" });
    expect(r.sugestoes.length).toBeGreaterThan(0);
    expect((await perfil(id)).username).toBeNull();
  });

  it("troca no máximo 1 vez a cada 30 dias", async () => {
    const id = await visitante("troca.um");
    expect(await rpc(id, "public.trocar_username('troca.dois')")).toBeNull();
    expect(await rpc(id, "public.trocar_username('troca.tres')")).toBe("espera");
    await db.query("update public.profiles set username_trocado_em = now() - interval '31 days' where id = $1", [id]);
    expect(await rpc(id, "public.trocar_username('troca.tres')")).toBeNull();
    expect((await perfil(id)).username).toBe("troca.tres");
  });
});

describe("começar como visitante", () => {
  it("cria perfil de visitante sem preferências de aviso, com aceites e Seção 1 liberada", async () => {
    const id = await visitante("comeco");
    const p = await perfil(id);
    expect(p).toMatchObject({ visitante: true, username: "comeco", apelido: "comeco", triagem_restricao: false, liberado_alta_intensidade: true });
    expect(p.triagem_respondida_em).not.toBeNull();
    const prefs = await db.query("select 1 from public.notification_preferences where user_id = $1", [id]);
    expect(prefs.rows).toEqual([]);
    const aceites = await db.query("select tipo from public.consents where user_id = $1 order by tipo", [id]);
    expect(aceites.rows.map((r) => (r as { tipo: string }).tipo)).toEqual(["dados_saude", "privacidade", "termos"]);
    expect(await eventos(id)).toEqual(["visitor_started", "username_created", "screening_done"]);
  });

  it("sem marcar 18 anos e termos, não começa", async () => {
    const id = await anonimo();
    await expect(rpc(id, "public.criar_visitante('semtermos', false, 'v1')")).rejects.toThrow(/termos/);
  });

  it("declaração sem o termo de responsabilidade é recusada", async () => {
    const id = await anonimo();
    await expect(rpc(id, "public.registrar_declaracao_saude(true, false, 'v1')")).rejects.toThrow(/declaracao_invalida/);
  });

  it("só uma conta normal não pode virar visitante", async () => {
    const id = await pessoa("Normal");
    await expect(rpc(id, "public.criar_visitante('normal', true, 'v1')")).rejects.toThrow(/nao_visitante/);
  });
});

describe("declaração de saúde", () => {
  const estados = async (id: string) =>
    new Map((await db.query<{ challenge_id: string; estado: string }>(
      "select challenge_id, estado from public.trilha_estados($1) where level_id = 1", [id])).rows.map((r) => [r.challenge_id, r.estado]));

  it("com restrição, libera só respiração e mobilidade leve", async () => {
    const id = await visitante("restrito", { restricao: true });
    expect(await perfil(id)).toMatchObject({ triagem_restricao: true, liberado_alta_intensidade: false });
    const e = await estados(id);
    expect(e.get("n1u1d02")).toBe("disponivel"); // mobilidade baixa
    expect(e.get("n1u1d08")).not.toBe("travado"); // respiração
    for (const travado of ["n1u1d01", "n1u1d03", "n1u1d05", "n1u1d07", "n1u1final"]) expect(e.get(travado), travado).toBe("travado");
    await expect(concluir(id, "n1u1d03")).rejects.toThrow(/desafio_bloqueado/);
    await concluir(id, "n1u1d02");
  });

  it("sem restrição, todos os desafios da seção seguem a fila normal", async () => {
    const id = await visitante("livre");
    const e = await estados(id);
    expect(e.get("n1u1d01")).toBe("disponivel");
    expect([...e.values()].includes("travado")).toBe(false);
  });

  it("refazer a declaração muda a restrição; a liberação médica também tira", async () => {
    const id = await visitante("refaz");
    await rpc(id, "public.registrar_declaracao_saude(false, true, 'v1')");
    expect((await perfil(id)).triagem_restricao).toBe(true);
    await rpc(id, "public.declarar_liberacao_medica()");
    expect(await perfil(id)).toMatchObject({ triagem_restricao: false, liberado_alta_intensidade: true });
  });
});

describe("visitante → conta", () => {
  let ana: string;
  let bia: string;

  beforeAll(async () => {
    ana = await pessoa("Ana");
    bia = await visitante("bia", { ref: await codigo(ana), familia: "D", gancho: "D04" });
  });

  it("guarda o ref e o convite, mas não ativa antes de confirmar", async () => {
    expect(await perfil(bia)).toMatchObject({ ref_convite: await codigo(ana), convidado_por: ana });
    await concluir(bia, "n1u1d01");
    const { rows } = await db.query<{ ativado_em: string | null; familia: string }>("select ativado_em, familia from public.invites where invitee_id = $1", [bia]);
    expect(rows[0]).toMatchObject({ ativado_em: null, familia: "D" });
    expect(await eventos(bia)).toContain("visitor_challenge_completed");
    const xpAna = await db.query("select 1 from public.xp_events where user_id = $1 and tipo = 'convite'", [ana]);
    expect(xpAna.rows).toEqual([]);
  });

  it("não conta na liga enquanto é visitante", async () => {
    const xp = await db.query<{ n: number }>("select sum(valor)::int as n from public.xp_events where user_id = $1", [bia]);
    expect(xp.rows[0].n).toBeGreaterThan(0);
    expect(await pontosLiga(bia)).toBeUndefined();
  });

  it("confirmar o e-mail preserva resultado e ref, lança a liga e credita quem convidou", async () => {
    const xpBia = (await db.query<{ n: number }>("select sum(valor)::int as n from public.xp_events where user_id = $1", [bia])).rows[0].n;
    await confirmarEmail(bia, "bia@exemplo.com");
    const p = await perfil(bia);
    expect(p).toMatchObject({ visitante: false, username: "bia", ref_convite: await codigo(ana), convidado_por: ana });
    expect(await pontosLiga(bia)).toBe(xpBia);
    const prefs = await db.query("select 1 from public.notification_preferences where user_id = $1", [bia]);
    expect(prefs.rows.length).toBe(1);
    const { rows } = await db.query<{ ativado_em: string | null; recompensado: boolean }>(
      "select ativado_em, recompensado from public.invites where invitee_id = $1", [bia]);
    expect(rows[0].ativado_em).not.toBeNull();
    expect(rows[0].recompensado).toBe(true);
    const xpAna = await db.query("select valor from public.xp_events where user_id = $1 and tipo = 'convite'", [ana]);
    expect(xpAna.rows).toEqual([{ valor: 20 }]);
    const tentativas = await db.query("select 1 from public.challenge_attempts where user_id = $1 and status = 'concluido'", [bia]);
    expect(tentativas.rows.length).toBe(1);
    const funil = await db.query<{ tipo: string }>("select tipo from public.convite_eventos where user_id = $1 order by id", [bia]);
    expect(funil.rows.map((r) => r.tipo)).toEqual(["desafio_concluido", "cadastro"]);
    expect(await eventos(bia)).toContain("visitor_converted");
  });

  it("confirmar_visitante e a confirmação repetida não creditam de novo", async () => {
    expect(await rpc(bia, "public.confirmar_visitante()")).toBe(true);
    const xpAna = await db.query("select 1 from public.xp_events where user_id = $1 and tipo = 'convite'", [ana]);
    expect(xpAna.rows.length).toBe(1);
  });

  it("visitante que confirma sem ter feito desafio só ativa o convite no 1º desafio", async () => {
    const carla = await visitante("carla", { ref: await codigo(ana) });
    await confirmarEmail(carla, "carla@exemplo.com");
    const antes = await db.query<{ ativado_em: string | null }>("select ativado_em from public.invites where invitee_id = $1", [carla]);
    expect(antes.rows[0].ativado_em).toBeNull();
    await db.query("update public.profiles set onboarding_concluido_em = now() where id = $1", [carla]);
    await concluir(carla, "n1u1d01");
    const depois = await db.query<{ ativado_em: string | null }>("select ativado_em from public.invites where invitee_id = $1", [carla]);
    expect(depois.rows[0].ativado_em).not.toBeNull();
  });

  it("o visitante pode fazer o desafio do convite, mesmo bloqueado na trilha", async () => {
    const dani = await pessoa("Dani");
    await db.query("update public.profiles set liberado_alta_intensidade = true where id = $1", [dani]);
    await db.query(
      `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
       values ($1, 'n1u1d05', 1, 'camera', 'concluido', now() - interval '1 hour', 10)`, [dani]);
    const vis = await visitante("vis.do.convite", { ref: await codigo(dani) });
    expect(await rpc(vis, "public.meu_desafio_do_convite()")).toBe("n1u1d05");
    expect(await rpc(null, "(select challenge_id from public.convite_desafio($1))", [await codigo(dani)])).toBe("n1u1d05");
    await concluir(vis, "n1u1d05");
    // Outro desafio bloqueado continua bloqueado.
    await expect(concluir(vis, "n1u1d06")).rejects.toThrow(/desafio_bloqueado/);
    // Com restrição, o desafio intenso do convite fica travado.
    const restrito = await visitante("vis.restrito", { ref: await codigo(dani), restricao: true });
    await expect(concluir(restrito, "n1u1d05")).rejects.toThrow(/desafio_bloqueado/);
  });

  it("o código de um visitante não vale como convite", async () => {
    const vis = await visitante("vis.convida");
    expect(await rpc(null, "(select count(*)::int from public.convite_publico($1))", [await codigo(vis)])).toBe(0);
    const outro = await anonimo();
    await rpc(outro, "public.criar_visitante('convidado.vis', true, 'v1', $1)", [await codigo(vis)]);
    expect((await perfil(outro)).convidado_por).toBeNull();
  });

  it("visitante não liga o push", async () => {
    const vis = await visitante("sem.push");
    await expect(rpc(vis, "public.salvar_push('https://push.exemplo.com/1', '{\"p256dh\":\"a\",\"auth\":\"b\"}')")).rejects.toThrow(/visitante/);
  });
});

describe("e-mail que já tem conta", () => {
  it("migra o resultado do visitante para a conta e apaga o visitante", async () => {
    const dona = await pessoa("Dona");
    const vis = await visitante("dona.visitante");
    await concluir(vis, "n1u1d01");
    const xpVis = (await db.query<{ n: number }>("select sum(valor)::int as n from public.xp_events where user_id = $1", [vis])).rows[0].n;
    const token = await rpc<string>(vis, "public.preparar_migracao_visitante()");
    expect(token).toMatch(/^[0-9a-f]{48}$/);

    // Outra conta com um token errado não leva nada.
    expect(await rpc(dona, "public.migrar_visitante_por_token('errado')")).toEqual({ ok: false, desafios: 0 });

    expect(await rpc(dona, "public.migrar_visitante_por_token($1)", [token])).toEqual({ ok: true, desafios: 1 });
    const t = await db.query("select 1 from public.challenge_attempts where user_id = $1 and challenge_id = 'n1u1d01'", [dona]);
    expect(t.rows.length).toBe(1);
    expect(await pontosLiga(dona)).toBe(xpVis);
    const progresso = await db.query("select 1 from public.user_challenge_progress where user_id = $1 and challenge_id = 'n1u1d01'", [dona]);
    expect(progresso.rows.length).toBe(1);
    const sobrou = await db.query("select 1 from auth.users where id = $1", [vis]);
    expect(sobrou.rows).toEqual([]);
    // O username de visitante foi descartado e o token não serve duas vezes.
    expect((await rpc<{ ok: boolean }>(null, "public.username_verificar('dona.visitante')")).ok).toBe(true);
    expect(await rpc(dona, "public.migrar_visitante_por_token($1)", [token])).toEqual({ ok: false, desafios: 0 });
    const ev = await db.query<{ tipo: string }>("select tipo from public.eventos_visitante where user_id = $1 order by id desc limit 1", [vis]);
    expect(ev.rows[0].tipo).toBe("visitor_converted");
  });

  it("só visitante prepara migração", async () => {
    const conta = await pessoa("Conta");
    await expect(rpc(conta, "public.preparar_migracao_visitante()")).rejects.toThrow(/nao_visitante/);
  });
});

describe("hive", () => {
  it("visitante entra na hive e aparece com o username; não conta na liga até confirmar", async () => {
    const anfitria = await pessoa("Anfitria");
    const hive = await rpc<string>(anfitria, "public.criar_hive('n1u1d01', false)");
    const vis = await visitante("hive.vis");
    await rpc(vis, "public.entrar_hive($1)", [hive]);
    const participantes = await db.query("select 1 from public.hive_participantes where hive_id = $1", [hive]);
    expect(participantes.rows.length).toBe(2);
    const nomes = await db.query<{ apelido: string }>("select apelido from public.perfis_publicos where id = $1", [vis]);
    expect(nomes.rows[0].apelido).toBe("hive.vis");
    await concluir(vis, "n1u1d01");
    expect(await pontosLiga(vis)).toBeUndefined();
  });

  it("visitante sem a declaração não entra em hive nem joga", async () => {
    const anfitria = await pessoa("Anfitria Dois");
    const hive = await rpc<string>(anfitria, "public.criar_hive('n1u1d01', false)");
    const id = await anonimo();
    await rpc(id, "public.criar_visitante('sem.declaracao', true, 'v1')");
    await expect(rpc(id, "public.entrar_hive($1)", [hive])).rejects.toThrow(/cadastro_incompleto/);
    await expect(concluir(id, "n1u1d01")).rejects.toThrow(/cadastro_incompleto/);
  });
});

describe("código por e-mail", () => {
  it("reenvio só depois de 60 s", async () => {
    const r1 = await rpc<{ ok: boolean }>(null, "public.codigo_pode_enviar('Zé@Exemplo.com ')");
    expect(r1.ok).toBe(true);
    const r2 = await rpc<{ ok: boolean; espera_s: number }>(null, "public.codigo_pode_enviar('zé@exemplo.com')");
    expect(r2.ok).toBe(false);
    expect(r2.espera_s).toBeGreaterThan(50);
    await db.query("update public.codigo_email_tentativas set enviado_em = now() - interval '61 seconds'");
    expect((await rpc<{ ok: boolean }>(null, "public.codigo_pode_enviar('zé@exemplo.com')")).ok).toBe(true);
  });

  it("5 erros bloqueiam; um código novo zera; o certo apaga", async () => {
    await rpc(null, "public.codigo_pode_enviar('erra@exemplo.com')");
    const restantes: number[] = [];
    for (let i = 0; i < 6; i++) restantes.push(await rpc<number>(null, "public.codigo_erro('erra@exemplo.com')"));
    expect(restantes).toEqual([4, 3, 2, 1, 0, 0]);
    expect(await rpc(null, "public.codigo_estado('erra@exemplo.com')")).toMatchObject({ restantes: 0 });
    await db.query("update public.codigo_email_tentativas set enviado_em = now() - interval '61 seconds'");
    await rpc(null, "public.codigo_pode_enviar('erra@exemplo.com')");
    expect(await rpc(null, "public.codigo_estado('erra@exemplo.com')")).toMatchObject({ restantes: 5, enviado_ha_s: 0 });
    await rpc(null, "public.codigo_ok('erra@exemplo.com')");
    const linhas = await db.query("select 1 from public.codigo_email_tentativas where email_hash = public.codigo_hash('erra@exemplo.com')");
    expect(linhas.rows).toEqual([]);
  });

  it("sem envio registrado: 5 tentativas e idade nula", async () => {
    expect(await rpc(null, "public.codigo_estado('nunca@exemplo.com')")).toEqual({ restantes: 5, enviado_ha_s: null });
  });

  it("guarda só o hash do e-mail", async () => {
    const { rows } = await db.query<{ email_hash: string }>("select email_hash from public.codigo_email_tentativas");
    for (const r of rows) expect(r.email_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rotina diária", () => {
  it("apaga visitante não confirmado há mais de 7 dias e registra visitor_expired", async () => {
    const velho = await visitante("velho");
    await concluir(velho, "n1u1d01");
    const novo = await visitante("novinho");
    const conta = await pessoa("Conta Antiga");
    await db.query("update public.profiles set criado_em = now() - interval '8 days' where id = any($1)", [[velho, conta]]);
    expect(await rpc(null, "1")).toBe(1);
    const { rows } = await db.query<{ n: number }>("select public.limpar_visitantes() as n");
    expect(rows[0].n).toBe(1);
    expect((await db.query("select 1 from auth.users where id = $1", [velho])).rows).toEqual([]);
    expect((await db.query("select 1 from public.challenge_attempts where user_id = $1", [velho])).rows).toEqual([]);
    expect((await db.query("select 1 from auth.users where id = any($1)", [[novo, conta]])).rows.length).toBe(2);
    const ev = await db.query<{ tipo: string; dados: { desafios: number } }>(
      "select tipo, dados from public.eventos_visitante where user_id = $1 order by id desc limit 1", [velho]);
    expect(ev.rows[0]).toMatchObject({ tipo: "visitor_expired", dados: { desafios: 1 } });
  });

  it("o cliente não chama as funções internas", async () => {
    const vis = await visitante("intruso");
    await expect(rpc(vis, "public.limpar_visitantes()")).rejects.toThrow(/permission denied/);
    await expect(rpc(vis, "public.migrar_visitante($1, $1)", [vis])).rejects.toThrow(/permission denied/);
    await expect(rpc(vis, "public.converter_visitante($1)", [vis])).rejects.toThrow(/permission denied/);
    await expect(como(db, { usuario: vis }, (tx) => tx.query("select * from public.eventos_visitante"))).rejects.toThrow(/permission denied/);
  });
});
