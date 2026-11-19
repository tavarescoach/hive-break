import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;
let ana: string;
let bruno: string;
let carla: string;
let ligaId: string;

const RESPOSTAS_NAO = { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false };

const PERFIL_COMPLETO = `
  update public.profiles set apelido = 'Ana', data_nascimento = '1990-05-10', sexo = 'feminino',
    altura_cm = 165, peso_kg = 62.5, objetivo = 'saude_geral', nivel_atividade = 'pouco_ativo',
    dias_semana = 3, meta_desafios_dia = 1, equipamentos = '{}', musica_estilo = 'lofi'
  where id = $1`;

beforeAll(async () => {
  db = await criarBanco();
  ana = await criarUsuario(db, "Ana Souza");
  bruno = await criarUsuario(db, "Bruno Lima");
  carla = await criarUsuario(db, "Carla Dias");

  // Ana preenche dados de saúde, como o app faria.
  await como(db, { usuario: ana }, async (tx) => {
    await tx.query(PERFIL_COMPLETO, [ana]);
    await tx.query("select public.registrar_triagem($1)", [JSON.stringify({ ...RESPOSTAS_NAO, q2: true })]);
    await tx.query("insert into public.pain_reports (user_id, regiao, acao_tomada) values ($1, 'joelho', 'encerrou')", [ana]);
  });
  // Dados gravados pelo servidor.
  await db.query("insert into public.baselines (user_id, agachamentos_40s) values ($1, 18)", [ana]);
  // Ana e Bruno são amigos e estão na mesma liga; Carla não.
  const [a, b] = [ana, bruno].sort();
  await db.query("insert into public.friendships (user_a, user_b, origem) values ($1, $2, 'convite')", [a, b]);
  // Grupo da Prata: Carla (Bronze) nunca cai nele quando termina o cadastro.
  const liga = await db.query<{ id: string }>(
    "insert into public.leagues (divisao, semana_inicio, semana_fim) values ('prata', public.liga_semana_inicio(), public.liga_semana_inicio() + 6) returning id",
  );
  ligaId = liga.rows[0].id;
  await db.query("insert into public.league_members (league_id, user_id, pontos) values ($1, $2, 80), ($1, $3, 120)", [liga.rows[0].id, ana, bruno]);
  await db.query("update public.profiles set onboarding_concluido_em = now() where id = $1", [ana]);
});

describe("cadastro", () => {
  it("conta nova ganha perfil, ofensiva, preferências e código de convite de 6 caracteres", async () => {
    const { rows } = await db.query<Record<string, unknown>>(
      `select p.nome, p.avatar_url, p.codigo_convite, s.atual, s.protetores, n.lembrete
       from public.profiles p join public.streaks s on s.user_id = p.id
       join public.notification_preferences n on n.user_id = p.id where p.id = $1`,
      [bruno],
    );
    expect(rows[0]).toMatchObject({ nome: "Bruno Lima", atual: 0, protetores: 0, lembrete: true });
    expect(rows[0].codigo_convite).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it("conta nova ganha um username único, gerado a partir do nome", async () => {
    const dupla1 = await criarUsuario(db, "Zé Dup", "ze.dup.1@exemplo.com");
    const dupla2 = await criarUsuario(db, "Zé Dup", "ze.dup.2@exemplo.com");
    const { rows } = await db.query<{ username: string }>(
      "select username from public.profiles where id in ($1, $2) order by criado_em", [dupla1, dupla2],
    );
    expect(rows[0].username).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(rows[1].username).not.toBe(rows[0].username);
  });

  it("o dono troca o próprio username, mas não para um já usado", async () => {
    await como(db, { usuario: bruno }, (tx) => tx.query("update public.profiles set username = 'bruno_novo' where id = $1", [bruno]));
    const { rows } = await db.query<{ username: string }>("select username from public.profiles where id = $1", [bruno]);
    expect(rows[0].username).toBe("bruno_novo");

    const usernameDaAna = (await db.query<{ username: string }>("select username from public.profiles where id = $1", [ana])).rows[0].username;
    await expect(
      como(db, { usuario: bruno }, (tx) => tx.query("update public.profiles set username = $1 where id = $2", [usernameDaAna, bruno])),
    ).rejects.toThrow(/duplicate key|unique/);
    await expect(
      como(db, { usuario: bruno }, (tx) => tx.query("update public.profiles set username = 'AB' where id = $1", [bruno])),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("todas as tabelas do schema public têm RLS ligada", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    expect(rows).toEqual([]);
    const total = await db.query<{ n: number }>("select count(*)::int as n from pg_tables where schemaname = 'public'");
    expect(total.rows[0].n).toBe(45);
  });
});

describe("dados de saúde ficam só com o dono", () => {
  const tabelas = ["profiles", "health_screenings", "baselines", "pain_reports", "consents", "streaks", "notification_preferences"];

  it("a dona lê os próprios dados", async () => {
    await como(db, { usuario: ana }, async (tx) => {
      const perfil = await tx.query<{ altura_cm: number; peso_kg: string }>("select altura_cm, peso_kg from public.profiles");
      expect(perfil.rows).toHaveLength(1);
      expect(perfil.rows[0].altura_cm).toBe(165);
      expect((await tx.query("select * from public.health_screenings")).rows).toHaveLength(1);
      expect((await tx.query("select * from public.baselines")).rows).toHaveLength(1);
      expect((await tx.query("select * from public.pain_reports")).rows).toHaveLength(1);
    });
  });

  it.each([
    ["um amigo da mesma liga", () => bruno],
    ["um desconhecido", () => carla],
  ])("%s não lê altura, peso, triagem, linha de base nem relatos de dor", async (_quem, quem) => {
    await como(db, { usuario: quem() }, async (tx) => {
      const perfis = await tx.query<{ id: string }>("select id from public.profiles");
      expect(perfis.rows.map((r) => r.id)).toEqual([quem()]);
      for (const tabela of ["health_screenings", "baselines", "pain_reports"]) {
        expect((await tx.query(`select * from public.${tabela}`)).rows, tabela).toEqual([]);
      }
      expect((await tx.query("select * from public.profiles where id = $1", [ana])).rows).toEqual([]);
    });
  });

  it("visitante sem login não lê nenhuma tabela de usuário", async () => {
    for (const tabela of tabelas) {
      await expect(
        como(db, { usuario: null }, (tx) => tx.query(`select * from public.${tabela}`)),
        tabela,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("a view pública mostra identidade, objetivo e meta da semana, nunca dados de saúde", async () => {
    await como(db, { usuario: bruno }, async (tx) => {
      const { rows } = await tx.query<Record<string, unknown>>("select * from public.perfis_publicos where id = $1", [ana]);
      expect(Object.keys(rows[0]).sort()).toEqual([
        "apelido", "avatar_url", "criado_em", "dias_semana", "divisao_atual", "id", "meta_desafios_dia", "nivel_atual", "objetivo", "username",
        "vitrine_conquistas",
      ]);
      expect(rows[0].apelido).toBe("Ana");
    });
    // Perfil público (seção 6 do docs/PERFIL.md): quem não está logado também lê a view.
    await como(db, { usuario: null }, async (tx) => {
      const { rows } = await tx.query<Record<string, unknown>>("select apelido, username from public.perfis_publicos where id = $1", [ana]);
      expect(rows).toEqual([{ apelido: "Ana", username: expect.stringMatching(/^[a-z0-9_]{3,20}$/) }]);
    });
  });

  it("ninguém edita ou apaga os dados de outra pessoa", async () => {
    await como(db, { usuario: bruno }, async (tx) => {
      const r = await tx.query("update public.profiles set apelido = 'Hackeado' where id = $1", [ana]);
      expect(r.affectedRows).toBe(0);
    });
    await expect(
      como(db, { usuario: bruno }, (tx) => tx.query("delete from public.profiles where id = $1", [ana])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(db, { usuario: bruno }, (tx) =>
        tx.query("insert into public.pain_reports (user_id, regiao, acao_tomada) values ($1, 'ombro', 'encerrou')", [ana]),
      ),
    ).rejects.toThrow(/row-level security/);
    const { rows } = await db.query<{ apelido: string }>("select apelido from public.profiles where id = $1", [ana]);
    expect(rows[0].apelido).toBe("Ana");
  });
});

describe("campos calculados só mudam pelo servidor", () => {
  it.each([
    ["dificuldade_atual", "10"],
    ["liberado_alta_intensidade", "true"],
    ["divisao_atual", "'diamante'"],
    ["nivel_atual", "8"],
    ["codigo_convite", "'AAAAAA'"],
    ["convidado_por", "null"],
    ["onboarding_concluido_em", "now()"],
  ])("o dono não consegue alterar %s direto", async (coluna, valor) => {
    await expect(
      como(db, { usuario: ana }, (tx) => tx.query(`update public.profiles set ${coluna} = ${valor} where id = $1`, [ana])),
    ).rejects.toThrow(/permission denied/);
  });

  it("o cliente não escreve em ofensiva, XP, tentativas, liga, amizades nem convites", async () => {
    const comandos = [
      "update public.streaks set atual = 99, protetores = 4",
      `insert into public.xp_events (user_id, tipo, valor) values ('${ana}', 'desafio', 9999)`,
      `insert into public.streak_days (user_id, dia, tipo) values ('${ana}', current_date, 'feito')`,
      "update public.league_members set pontos = 99999",
      `insert into public.invites (inviter_id, invitee_id) values ('${ana}', '${carla}')`,
      "delete from public.friendships",
      `insert into public.user_achievements (user_id, achievement_id) values ('${ana}', 'ofensiva_100')`,
      "update public.notification_preferences set pausado_ate = null",
      "update public.levels set tema = 'x'",
    ];
    for (const sql of comandos) {
      await expect(como(db, { usuario: ana }, (tx) => tx.query(sql)), sql).rejects.toThrow(/permission denied/);
    }
  });

  it("aceites: registra, mas não altera nem apaga o histórico", async () => {
    await como(db, { usuario: ana }, async (tx) => {
      await tx.query("insert into public.consents (user_id, tipo, versao) values ($1, 'termos', 'v1'), ($1, 'privacidade', 'v1'), ($1, 'dados_saude', 'v1')", [ana]);
    });
    await expect(como(db, { usuario: ana }, (tx) => tx.query("update public.consents set versao = 'v0'"))).rejects.toThrow(/permission denied/);
    await expect(como(db, { usuario: ana }, (tx) => tx.query("delete from public.consents"))).rejects.toThrow(/permission denied/);
    await expect(
      como(db, { usuario: ana }, (tx) => tx.query("insert into public.consents (user_id, tipo, versao, aceito_em) values ($1, 'termos', 'v1', '2020-01-01')", [ana])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(db, { usuario: bruno }, (tx) => tx.query("insert into public.consents (user_id, tipo, versao) values ($1, 'termos', 'v1')", [ana])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("validação do perfil", () => {
  const atualizar = (sql: string) => como(db, { usuario: carla }, (tx) => tx.query(`update public.profiles set ${sql} where id = $1`, [carla]));

  it("recusa menor de 18 anos", async () => {
    const hoje = new Date();
    const dezessete = `${hoje.getFullYear() - 17}-01-01`;
    await expect(atualizar(`data_nascimento = '${dezessete}'`)).rejects.toThrow(/idade_minima/);
    await atualizar("data_nascimento = '1960-03-02'");
  });

  it("recusa valores fora das faixas da especificação", async () => {
    for (const sql of ["altura_cm = 100", "altura_cm = 240", "peso_kg = 20", "peso_kg = 300", "apelido = 'ab'",
      "apelido = 'um apelido comprido demais'", "dias_semana = 1", "meta_desafios_dia = 4", "sexo = 'outro'",
      "equipamentos = '{halter}'", "volume_musica = 101"]) {
      await expect(atualizar(sql), sql).rejects.toThrow(/violates check constraint/);
    }
    await atualizar("altura_cm = 172, peso_kg = 80, apelido = '  Carla  ', equipamentos = '{tapete}'");
    const { rows } = await db.query<{ apelido: string }>("select apelido from public.profiles where id = $1", [carla]);
    expect(rows[0].apelido).toBe("Carla");
  });
});

describe("triagem e liberação", () => {
  it("um 'sim' limita a baixa intensidade; a autodeclaração libera e guarda a data", async () => {
    let perfil = await db.query<{ liberado_alta_intensidade: boolean; liberacao_declarada_em: string | null }>(
      "select liberado_alta_intensidade, liberacao_declarada_em from public.profiles where id = $1", [ana]);
    expect(perfil.rows[0]).toMatchObject({ liberado_alta_intensidade: false, liberacao_declarada_em: null });

    await como(db, { usuario: ana }, (tx) => tx.query("select public.declarar_liberacao_medica()"));
    perfil = await db.query("select liberado_alta_intensidade, liberacao_declarada_em from public.profiles where id = $1", [ana]);
    expect(perfil.rows[0].liberado_alta_intensidade).toBe(true);
    expect(perfil.rows[0].liberacao_declarada_em).not.toBeNull();
  });

  it("tudo 'não' libera na hora", async () => {
    const r = await como(db, { usuario: bruno }, (tx) =>
      tx.query<{ ok: boolean }>("select public.registrar_triagem($1) as ok", [JSON.stringify(RESPOSTAS_NAO)]));
    expect(r.rows[0].ok).toBe(true);
  });

  it("recusa triagem incompleta ou com valores estranhos, e liberação sem triagem", async () => {
    for (const respostas of [{ q1: false }, { ...RESPOSTAS_NAO, q7: "talvez" }, { ...RESPOSTAS_NAO, q8: false }, []]) {
      await expect(
        como(db, { usuario: carla }, (tx) => tx.query("select public.registrar_triagem($1)", [JSON.stringify(respostas)])),
      ).rejects.toThrow(/triagem_invalida/);
    }
    await expect(como(db, { usuario: carla }, (tx) => tx.query("select public.declarar_liberacao_medica()"))).rejects.toThrow(/triagem_pendente/);
  });

  it("visitante não chama funções de usuário", async () => {
    await expect(
      como(db, { usuario: null }, (tx) => tx.query("select public.registrar_triagem($1)", [JSON.stringify(RESPOSTAS_NAO)])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("convite", () => {
  it("a landing de convite mostra só apelido, foto e ofensiva, mesmo sem login", async () => {
    const codigo = (await db.query<{ c: string }>("select codigo_convite as c from public.profiles where id = $1", [ana])).rows[0].c;
    const r = await como(db, { usuario: null }, (tx) =>
      tx.query<Record<string, unknown>>("select * from public.convite_publico($1)", [codigo.toLowerCase()]));
    expect(r.rows).toEqual([{ apelido: "Ana", avatar_url: expect.stringContaining("Ana"), ofensiva: 0 }]);
    const nada = await como(db, { usuario: null }, (tx) => tx.query("select * from public.convite_publico('ZZZZZZ')"));
    expect(nada.rows).toEqual([]);
  });

  it("registra quem convidou uma única vez, nunca o próprio código nem código inválido", async () => {
    const codigoDe = async (id: string) =>
      (await db.query<{ c: string }>("select codigo_convite as c from public.profiles where id = $1", [id])).rows[0].c;
    const dani = await criarUsuario(db, "Dani Reis");
    const registrar = (codigo: string) =>
      como(db, { usuario: dani }, async (tx) => (await tx.query<{ ok: boolean }>("select public.registrar_convite($1) as ok", [codigo])).rows[0].ok);

    expect(await registrar("ZZZZZZ")).toBe(false);
    expect(await registrar(await codigoDe(dani))).toBe(false);
    expect(await registrar(await codigoDe(ana))).toBe(true);
    expect(await registrar(await codigoDe(bruno))).toBe(false);

    const perfil = await db.query<{ convidado_por: string }>("select convidado_por from public.profiles where id = $1", [dani]);
    expect(perfil.rows[0].convidado_por).toBe(ana);
    const convites = await db.query<Record<string, unknown>>("select inviter_id, ativado_em, recompensado from public.invites where invitee_id = $1", [dani]);
    expect(convites.rows).toEqual([{ inviter_id: ana, ativado_em: null, recompensado: false }]);

    // Quem convidou vê o convite; um terceiro, não.
    expect((await como(db, { usuario: ana }, (tx) => tx.query("select * from public.invites"))).rows).toHaveLength(1);
    expect((await como(db, { usuario: carla }, (tx) => tx.query("select * from public.invites"))).rows).toHaveLength(0);
  });

  it("conta que já terminou o onboarding não pode mais registrar convite", async () => {
    const codigo = (await db.query<{ c: string }>("select codigo_convite as c from public.profiles where id = $1", [bruno])).rows[0].c;
    const r = await como(db, { usuario: ana }, (tx) => tx.query<{ ok: boolean }>("select public.registrar_convite($1) as ok", [codigo]));
    expect(r.rows[0].ok).toBe(false);
  });
});

describe("conclusão do onboarding", () => {
  it("diz o que falta e só conclui com tudo preenchido", async () => {
    const eva = await criarUsuario(db, "Eva Melo");
    const concluir = () =>
      como(db, { usuario: eva }, async (tx) =>
        (await tx.query<{ r: { ok: boolean; faltando: string[] } }>("select public.concluir_onboarding() as r")).rows[0].r);

    expect(await concluir()).toEqual({ ok: false, faltando: ["termos", "perfil", "triagem", "meta", "musica"] });

    await como(db, { usuario: eva }, async (tx) => {
      await tx.query("insert into public.consents (user_id, tipo, versao) values ($1, 'termos', 'v1'), ($1, 'privacidade', 'v1'), ($1, 'dados_saude', 'v1')", [eva]);
      await tx.query(PERFIL_COMPLETO.replace("'Ana'", "'Eva'").replace("'pouco_ativo'", "'ativo'"), [eva]);
      await tx.query("select public.registrar_triagem($1)", [JSON.stringify(RESPOSTAS_NAO)]);
    });
    expect(await concluir()).toEqual({ ok: false, faltando: ["meta"] });
    await expect(como(db, { usuario: eva }, (tx) => tx.query("select public.definir_compromisso(10)"))).rejects.toThrow(/compromisso_invalido/);
    await como(db, { usuario: eva }, (tx) => tx.query("select public.definir_compromisso(14)"));
    expect(await concluir()).toEqual({ ok: true, faltando: [] });

    const { rows } = await db.query<Record<string, unknown>>(
      `select p.dificuldade_atual, p.onboarding_concluido_em is not null as concluido, s.meta_compromisso, l.liberado
       from public.profiles p join public.streaks s on s.user_id = p.id
       join public.user_level_progress l on l.user_id = p.id and l.level_id = 1 where p.id = $1`, [eva]);
    expect(rows[0]).toEqual({ dificuldade_atual: 5, concluido: true, meta_compromisso: 14, liberado: true });
  });

  it("dificuldade inicial: sedentário 2, pouco ativo 3, ativo 5; sem liberação, no máximo 3", async () => {
    const { rows } = await db.query<{ a: number; b: number; c: number; d: number }>(
      `select public.dificuldade_inicial('sedentario', true) as a, public.dificuldade_inicial('pouco_ativo', true) as b,
              public.dificuldade_inicial('ativo', true) as c, public.dificuldade_inicial('ativo', false) as d`);
    expect(rows[0]).toEqual({ a: 2, b: 3, c: 5, d: 3 });
  });
});

describe("liga e conteúdo", () => {
  it("o ranking é visível só para quem está no mesmo grupo", async () => {
    const doGrupo = "select * from public.league_members where league_id = $1";
    expect((await como(db, { usuario: ana }, (tx) => tx.query(doGrupo, [ligaId]))).rows).toHaveLength(2);
    expect((await como(db, { usuario: carla }, (tx) => tx.query(doGrupo, [ligaId]))).rows).toHaveLength(0);
    expect((await como(db, { usuario: carla }, (tx) => tx.query("select * from public.leagues where id = $1", [ligaId]))).rows).toHaveLength(0);
    // Carla só vê o grupo dela, em que entrou ao terminar o cadastro.
    const daCarla = await como(db, { usuario: carla }, (tx) => tx.query<{ user_id: string }>("select user_id from public.league_members"));
    expect(daCarla.rows.map((r) => r.user_id)).not.toContain(ana);
  });

  it("qualquer pessoa lê o conteúdo: 8 níveis e as conquistas do seed", async () => {
    const niveis = await como(db, { usuario: null }, (tx) => tx.query<{ tema: string }>("select tema from public.levels order by ordem"));
    expect(niveis.rows).toHaveLength(8);
    expect(niveis.rows[0].tema).toBe("Primeiros passos");
    const conquistas = await como(db, { usuario: carla }, (tx) => tx.query("select id from public.achievements"));
    expect(conquistas.rows).toHaveLength(14);
  });
});

describe("peso e meta da semana (docs/PERFIL.md)", () => {
  it("registrar_peso grava 1 linha por dia e só o dono lê", async () => {
    await como(db, { usuario: ana }, (tx) => tx.query("select public.registrar_peso(80)"));
    await como(db, { usuario: ana }, (tx) => tx.query("select public.registrar_peso(79.5)"));
    const { rows } = await db.query<{ peso_kg: string }>("select peso_kg from public.pesagens where usuario_id = $1", [ana]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].peso_kg)).toBe(79.5);

    await expect(como(db, { usuario: bruno }, (tx) => tx.query("select * from public.pesagens where usuario_id = $1", [ana])))
      .resolves.toMatchObject({ rows: [] });
  });

  it("peso_card respeita a visibilidade: eu (padrão), variação e tudo", async () => {
    const paraOutro = (quem: string | null) => como(db, { usuario: quem }, (tx) => tx.query<{ peso_card: Record<string, unknown> }>("select public.peso_card($1)", [ana]));

    expect((await paraOutro(bruno)).rows[0].peso_card).toEqual({ papel: "outro", visivel: false });

    await db.query("update public.profiles set visibilidade_peso = 'variacao' where id = $1", [ana]);
    let r = (await paraOutro(bruno)).rows[0].peso_card as Record<string, unknown>;
    expect(r).toMatchObject({ papel: "outro", visivel: true });
    expect(r.atual).toBeUndefined();
    expect(typeof r.variacao_kg).toBe("number");

    await db.query("update public.profiles set visibilidade_peso = 'tudo' where id = $1", [ana]);
    r = (await paraOutro(bruno)).rows[0].peso_card as Record<string, unknown>;
    expect(r.atual).toBeDefined();
    // Nunca o absoluto para quem não está logado, mesmo com "mostrar tudo".
    const semLogin = (await paraOutro(null)).rows[0].peso_card as Record<string, unknown>;
    expect(semLogin.atual).toBeUndefined();
    expect(typeof semLogin.variacao_kg).toBe("number");

    await db.query("update public.profiles set visibilidade_peso = 'eu' where id = $1", [ana]);
  });

  it("meta_semana devolve a meta, os 7 dias da semana e o streak, até sem login", async () => {
    const r = await como(db, { usuario: null }, (tx) => tx.query<{ meta_semana: Record<string, unknown> }>("select public.meta_semana($1)", [ana]));
    const dados = r.rows[0].meta_semana as { meta_hives_dia: number; dias: unknown[]; feitas_na_semana: number; streak: number };
    expect(dados.meta_hives_dia).toBe(1);
    expect(dados.dias).toHaveLength(7);
    expect(dados.feitas_na_semana).toBeGreaterThanOrEqual(0);
    expect(dados.streak).toBeGreaterThanOrEqual(0);
  });
});

describe("estatísticas e calendário (docs/PERFIL.md)", () => {
  it("dono e amigo (sem esconder XP) veem a grade inteira; só eles, não quem não é amigo nem está logado", async () => {
    await db.query("update public.league_members set posicao_final = 1 where league_id = $1 and user_id = $2", [ligaId, ana]);
    const pegar = (quem: string | null) =>
      como(db, { usuario: quem }, (tx) => tx.query<{ estatisticas_perfil: Record<string, unknown> }>("select public.estatisticas_perfil($1)", [ana]))
        .then((r) => r.rows[0].estatisticas_perfil as Record<string, unknown>);

    const doDono = await pegar(ana);
    expect(doDono).toMatchObject({ nivel: "dono", podios: 1 });
    expect(doDono.xp_total).toBeTypeOf("number");

    const doAmigo = await pegar(bruno);
    expect(doAmigo).toMatchObject({ nivel: "completo", podios: 1 });
    expect(doAmigo.xp_total).toBeTypeOf("number");

    const doPublico = await pegar(null);
    expect(doPublico).toMatchObject({ nivel: "publico" });
    expect(doPublico.xp_total).toBeNull();
    expect(doPublico.podios).toBeNull();
    expect(doPublico.ofensiva).toBeTypeOf("number");
    expect(doPublico.divisao).toBeDefined();
  });

  it("esconder_xp deixa só ofensiva (e conquistas, fora desta função) para quem não é o dono", async () => {
    await db.query("update public.profiles set esconder_xp = true where id = $1", [ana]);
    const r = await como(db, { usuario: bruno }, (tx) => tx.query<{ estatisticas_perfil: Record<string, unknown> }>("select public.estatisticas_perfil($1)", [ana]));
    const dados = r.rows[0].estatisticas_perfil as Record<string, unknown>;
    expect(dados.nivel).toBe("limitado");
    expect(dados.xp_total).toBeNull();
    expect(dados.podios).toBeNull();
    expect(dados.ofensiva).toBeTypeOf("number");

    // Mesmo com esconder_xp ligado, o dono continua vendo tudo.
    const doDono = await como(db, { usuario: ana }, (tx) => tx.query<{ estatisticas_perfil: Record<string, unknown> }>("select public.estatisticas_perfil($1)", [ana]));
    expect((doDono.rows[0].estatisticas_perfil as Record<string, unknown>).nivel).toBe("dono");
    await db.query("update public.profiles set esconder_xp = false where id = $1", [ana]);
  });

  it("calendario_mes devolve os dias do mês, e nada para quem não está logado", async () => {
    const hoje = new Date();
    const r = await como(db, { usuario: ana }, (tx) =>
      tx.query<{ calendario_mes: { dia: string; hives: number }[] }>("select public.calendario_mes($1, $2, $3)", [ana, hoje.getFullYear(), hoje.getMonth() + 1]));
    const dias = r.rows[0].calendario_mes;
    expect(dias.length).toBeGreaterThanOrEqual(28);
    expect(dias[0]).toHaveProperty("bateu_meta");

    await expect(como(db, { usuario: null }, (tx) => tx.query("select public.calendario_mes($1, 2026, 11)", [ana]))).rejects.toThrow(/permission denied/);
  });
});

describe("busca de amigos, seguir e bloquear (docs/PERFIL.md, seção 4)", () => {
  beforeAll(async () => {
    // Nos outros blocos, só a Ana (e a Eva, num teste isolado) terminam o cadastro;
    // aqui a busca e o seguir precisam de todo mundo com o cadastro completo.
    await db.query("update public.profiles set onboarding_concluido_em = now() where id in ($1, $2)", [bruno, carla]);
  });

  const seguir = (quem: string, alvo: string) => como(db, { usuario: quem }, (tx) => tx.query("select public.seguir_usuario($1)", [alvo]));
  const buscar = (quem: string, q: string) =>
    como(db, { usuario: quem }, (tx) => tx.query<{ buscar_usuarios: Record<string, unknown>[] }>("select public.buscar_usuarios($1)", [q]))
      .then((r) => r.rows[0].buscar_usuarios);

  it("busca com menos de 2 letras devolve vazio", async () => {
    expect(await buscar(ana, "c")).toEqual([]);
  });

  it("acha por apelido ou @username, nunca a própria pessoa", async () => {
    const resultado = await buscar(ana, "carla");
    expect(resultado.map((r) => r.id)).toContain(carla);
    expect(resultado.map((r) => r.id)).not.toContain(ana);
  });

  it("quem desliga 'aparecer na busca' some dos resultados", async () => {
    await db.query("update public.profiles set aparecer_na_busca = false where id = $1", [carla]);
    expect((await buscar(ana, "carla")).map((r) => r.id)).not.toContain(carla);
    await db.query("update public.profiles set aparecer_na_busca = true where id = $1", [carla]);
  });

  it("seguir é de mão única; vira amigo (sao_amigos) quando os dois se seguem", async () => {
    const saoAmigos = async () => (await db.query<{ sao_amigos: boolean }>("select public.sao_amigos($1, $2) as sao_amigos", [ana, carla])).rows[0].sao_amigos;
    expect(await saoAmigos()).toBe(false);

    await seguir(ana, carla);
    let r = (await como(db, { usuario: ana }, (tx) => tx.query<{ relacao_com: Record<string, unknown> }>("select public.relacao_com($1, $2)", [ana, carla]))).rows[0].relacao_com;
    expect(r).toMatchObject({ seguindo: true, segue_voce: false });
    expect(await saoAmigos()).toBe(false);

    await seguir(carla, ana);
    expect(await saoAmigos()).toBe(true);

    await como(db, { usuario: ana }, (tx) => tx.query("select public.deixar_de_seguir($1)", [carla]));
    expect(await saoAmigos()).toBe(false);
    r = (await como(db, { usuario: ana }, (tx) => tx.query<{ relacao_com: Record<string, unknown> }>("select public.relacao_com($1, $2)", [ana, carla]))).rows[0].relacao_com;
    expect(r).toMatchObject({ seguindo: false, segue_voce: true });

    await como(db, { usuario: carla }, (tx) => tx.query("select public.deixar_de_seguir($1)", [ana]));
  });

  it("não segue nem busca quem bloqueou (nos dois sentidos) e some os dois lados do seguir", async () => {
    await seguir(ana, carla);
    await seguir(carla, ana);
    await como(db, { usuario: ana }, (tx) => tx.query("select public.bloquear_usuario($1)", [carla]));

    expect((await db.query("select * from public.seguidores where $1 in (seguidor_id, seguido_id) and $2 in (seguidor_id, seguido_id)", [ana, carla])).rows).toEqual([]);
    expect((await buscar(ana, "carla")).map((r) => r.id)).not.toContain(carla);
    expect((await buscar(carla, "ana")).map((r) => r.id)).not.toContain(ana);

    await expect(seguir(carla, ana)).rejects.toThrow(/bloqueado/);

    await como(db, { usuario: ana }, (tx) => tx.query("select public.desbloquear_usuario($1)", [carla]));
    expect((await buscar(ana, "carla")).map((r) => r.id)).toContain(carla);
  });

  it("limite de chamadas por minuto da busca", async () => {
    for (let i = 0; i < 30; i++) await buscar(bruno, "ana");
    await expect(buscar(bruno, "ana")).rejects.toThrow(/busca_muito_frequente/);
  });

  it("sugestoes_busca traz quem te segue e você não segue de volta", async () => {
    await seguir(carla, bruno);
    const r = await como(db, { usuario: bruno }, (tx) => tx.query<{ sugestoes_busca: Record<string, unknown>[] }>("select public.sugestoes_busca()"));
    expect(r.rows[0].sugestoes_busca.map((x) => x.id)).toContain(carla);
    await como(db, { usuario: carla }, (tx) => tx.query("select public.deixar_de_seguir($1)", [bruno]));
  });
});

describe("vitrine, feed de amigos e seguindo/seguidores (docs/PERFIL.md, seção 3)", () => {
  it("progresso_conquistas traz as 14 conquistas, com progresso para quem dá para contar", async () => {
    await db.query("insert into public.user_achievements (user_id, achievement_id) values ($1, 'primeiro_desafio')", [ana]);
    const r = await como(db, { usuario: null }, (tx) => tx.query<{ progresso_conquistas: Record<string, unknown>[] }>("select public.progresso_conquistas($1)", [ana]));
    const lista = r.rows[0].progresso_conquistas;
    expect(lista).toHaveLength(14);
    const primeira = lista.find((c) => c.id === "primeiro_desafio");
    expect(primeira).toMatchObject({ conquistada: true });
    const ofensiva30 = lista.find((c) => c.id === "ofensiva_30");
    expect(ofensiva30).toMatchObject({ conquistada: false, meta: 30 });
    expect(typeof ofensiva30?.atual).toBe("number");
  });

  it("a vitrine só aceita até 3 conquistas que a pessoa já tem", async () => {
    await expect(como(db, { usuario: ana }, (tx) => tx.query("select public.definir_vitrine($1)", [["ofensiva_100"]]))).rejects.toThrow(/conquista_nao_sua/);
    await como(db, { usuario: ana }, (tx) => tx.query("select public.definir_vitrine($1)", [["primeiro_desafio"]]));
    const { rows } = await db.query<{ vitrine_conquistas: string[] }>("select vitrine_conquistas from public.profiles where id = $1", [ana]);
    expect(rows[0].vitrine_conquistas).toEqual(["primeiro_desafio"]);
    await expect(como(db, { usuario: ana }, (tx) => tx.query("select public.definir_vitrine($1)", [["a", "b", "c", "d"]]))).rejects.toThrow(/vitrine_demais/);
  });

  it("feed de amigos mostra a conquista de quem é amigo (ana e bruno já são, pela amizade do convite)", async () => {
    const r = await como(db, { usuario: bruno }, (tx) => tx.query<{ feed_amigos: Record<string, unknown>[] }>("select public.feed_amigos()"));
    const doAna = r.rows[0].feed_amigos.find((e) => e.user_id === ana);
    expect(doAna).toMatchObject({ tipo: "conquista", rotulo: "Primeiro desafio" });

    // Carla não é amiga da Ana: não aparece no feed da Carla.
    const doCarla = await como(db, { usuario: carla }, (tx) => tx.query<{ feed_amigos: Record<string, unknown>[] }>("select public.feed_amigos()"));
    expect(doCarla.rows[0].feed_amigos.find((e) => e.user_id === ana)).toBeUndefined();
  });

  it("high five: um por pessoa por dia, só quem está logado", async () => {
    await como(db, { usuario: bruno }, (tx) => tx.query("select public.dar_high_five($1)", [ana]));
    await como(db, { usuario: bruno }, (tx) => tx.query("select public.dar_high_five($1)", [ana]));
    const { rows } = await db.query("select * from public.high_fives where de_user = $1 and para_user = $2", [bruno, ana]);
    expect(rows).toHaveLength(1);
    const r = await como(db, { usuario: bruno }, (tx) => tx.query<{ feed_amigos: Record<string, unknown>[] }>("select public.feed_amigos()"));
    expect(r.rows[0].feed_amigos.find((e) => e.user_id === ana)).toMatchObject({ eu_dei_high_five: true, high_fives: 1 });
  });

  it("minha_rede lista seguindo/seguidores ordenados por XP da semana", async () => {
    await como(db, { usuario: carla }, (tx) => tx.query("select public.seguir_usuario($1)", [ana]));
    const seguidores = await como(db, { usuario: ana }, (tx) => tx.query<{ minha_rede: Record<string, unknown>[] }>("select public.minha_rede('seguidores')"));
    expect(seguidores.rows[0].minha_rede.map((x) => x.id)).toContain(carla);
    const seguindo = await como(db, { usuario: carla }, (tx) => tx.query<{ minha_rede: Record<string, unknown>[] }>("select public.minha_rede('seguindo')"));
    expect(seguindo.rows[0].minha_rede.map((x) => x.id)).toContain(ana);
    await como(db, { usuario: carla }, (tx) => tx.query("select public.deixar_de_seguir($1)", [ana]));
  });
});
