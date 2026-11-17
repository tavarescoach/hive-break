/**
 * Teste de ponta a ponta da Fase 1 (cadastro, onboarding, convite), no Chromium.
 *
 * Antes de rodar (ver e2e/README.md):
 *   1. npx tsx e2e/supabase-falso.ts
 *   2. build e start do app com NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329
 *   3. node e2e/fluxo-fase1.mjs
 *
 * Variáveis: APP (endereço do app), SUPABASE (servidor falso), CAMERA_FALSA
 * (arquivo .mjpeg usado como câmera) e CAPTURAS (pasta para as telas).
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const APP = process.env.APP ?? "http://localhost:3111";
const SUPABASE = process.env.SUPABASE ?? "http://localhost:54329";
const CAPTURAS = process.env.CAPTURAS;
const argumentos = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--enable-unsafe-swiftshader"];
if (process.env.CAMERA_FALSA) argumentos.push(`--use-file-for-fake-video-capture=${process.env.CAMERA_FALSA}`);

const controle = (rota, corpo) =>
  fetch(`${SUPABASE}/__controle/${rota}`, { method: "POST", body: JSON.stringify(corpo) }).then((r) => r.json());
const sql = (texto, params) => controle("sql", { sql: texto, params });

let passo = 0;
async function captura(pagina, nome, paginaInteira = true) {
  if (CAPTURAS) await pagina.screenshot({ path: `${CAPTURAS}/${String(++passo).padStart(2, "0")}-${nome}.png`, fullPage: paginaInteira });
}

/** Faz um desafio sem câmera: timer → Concluí → Continuar. */
async function fazerDesafio(pagina, id) {
  await pagina.goto(`${APP}/desafio/${id}`);
  await pagina.getByRole("button", { name: "Fazer sem câmera" }).click();
  await pagina.getByRole("timer").waitFor();
  await pagina.getByRole("button", { name: "Concluí" }).click();
  await pagina.getByText("Ofensiva:").waitFor();
  await pagina.getByRole("link", { name: "Continuar" }).click();
  await pagina.waitForURL("**/trilha");
}

/** Abre o desafio com a câmera e espera o exercício começar a valer. */
async function abrirComCamera(pagina) {
  await pagina.getByRole("button", { name: "Começar com a câmera" }).click();
  // Com a câmera falsa de padrão colorido ninguém aparece: começa pelo botão.
  const botao = pagina.getByRole("button", { name: "Começar agora" });
  await pagina.getByRole("timer").or(botao).first().waitFor({ timeout: 60000 });
  await botao.click({ timeout: 1500 }).catch(() => {});
  await pagina.getByRole("timer").waitFor({ timeout: 60000 });
}

const continuar = (pagina, nome = "Continuar") => pagina.getByRole("button", { name: nome }).click();

async function novaPessoa(navegador, identidade) {
  await controle("proximo-usuario", identidade);
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const pagina = await contexto.newPage();
  const externas = [];
  pagina.on("request", (r) => {
    const host = new URL(r.url()).host;
    if (host !== new URL(APP).host && host !== new URL(SUPABASE).host) externas.push(r.url());
  });
  pagina.on("pageerror", (e) => console.log("  [erro na página]", e.message));
  return { pagina, externas };
}

/** Faz o cadastro inteiro. `triagemSim` marca "sim" numa pergunta. */
async function cadastro(pagina, { apelido, nascimento, triagemSim = false, prefixo }) {
  await pagina.getByRole("button", { name: "Entrar com Google" }).click();
  await pagina.waitForURL("**/onboarding/termos");
  await captura(pagina, `${prefixo}-termos`);

  // Sem marcar os aceites, não passa.
  await continuar(pagina, "Aceitar e continuar");
  await pagina.getByRole("alert").filter({ hasText: "três aceites" }).waitFor();
  for (const caixa of await pagina.getByRole("checkbox").all()) await caixa.check();
  await continuar(pagina, "Aceitar e continuar");

  await pagina.waitForURL("**/onboarding/perfil/apelido");
  await pagina.getByRole("textbox").fill("ab");
  await pagina.getByRole("textbox").press("Enter");
  // O navegador barra apelido curto (minlength); o servidor também valida.
  await pagina.getByRole("textbox").fill(apelido);
  await captura(pagina, `${prefixo}-apelido`);
  await continuar(pagina);

  await pagina.waitForURL("**/perfil/nascimento");
  await pagina.locator('input[type="date"]').fill(nascimento);
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/sexo");
  await pagina.getByText("Feminino").click();
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/altura");
  await pagina.getByRole("textbox").fill("300");
  await continuar(pagina);
  await pagina.getByRole("alert").filter({ hasText: "entre 120 e 230" }).waitFor();
  await pagina.getByRole("textbox").fill("1,68");
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/peso");
  await pagina.getByRole("textbox").fill("64,5");
  await captura(pagina, `${prefixo}-peso`);
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/objetivo");
  await pagina.getByText("Ganhar força").click();
  await captura(pagina, `${prefixo}-objetivo`);
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/atividade");
  await pagina.getByText("Pouco ativo").click();
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/dias");
  await pagina.getByText("4", { exact: true }).click();
  await captura(pagina, `${prefixo}-dias`);
  await continuar(pagina);
  await pagina.waitForURL("**/perfil/equipamento");
  await continuar(pagina);
  await pagina.getByRole("alert").filter({ hasText: "Nenhum" }).waitFor();
  await pagina.getByText("Tapete").click();
  await captura(pagina, `${prefixo}-equipamento`);
  await continuar(pagina);

  await pagina.waitForURL("**/onboarding/triagem");
  const grupos = await pagina.getByRole("group").all();
  assert.equal(grupos.length, 7, "a triagem tem 7 perguntas");
  for (const [i, grupo] of grupos.entries()) {
    await grupo.getByText(triagemSim && i === 5 ? "Sim" : "Não", { exact: true }).click();
  }
  await captura(pagina, `${prefixo}-triagem`);
  await continuar(pagina);
  if (triagemSim) {
    await pagina.getByText("Converse com um médico").waitFor();
    await captura(pagina, `${prefixo}-triagem-recomendacao`);
    await pagina.getByRole("link", { name: "Entendi, continuar" }).click();
  }

  await pagina.waitForURL("**/onboarding/meta");
  await pagina.getByText("2 desafios").click();
  await pagina.getByText("14 dias").click();
  await captura(pagina, `${prefixo}-meta`);
  await continuar(pagina, "Assumir meu compromisso");

  await pagina.waitForURL("**/camera");
  await captura(pagina, `${prefixo}-camera-guia`);
  await pagina.getByRole("button", { name: "Permitir a câmera" }).click();
  await pagina.getByRole("link", { name: "Estou pronto" }).waitFor();
  if (process.env.CAMERA_FALSA) {
    await pagina.getByText("Estou te vendo").waitFor({ timeout: 60000 });
  } else {
    await pagina.getByText("Afaste-se").waitFor({ timeout: 60000 });
  }
  await captura(pagina, `${prefixo}-camera-ao-vivo`);
  await pagina.getByRole("link", { name: "Estou pronto" }).click();

  await pagina.waitForURL("**/onboarding/musica");
  await pagina.getByText("Lo-fi").click();
  await captura(pagina, `${prefixo}-musica`);
  await continuar(pagina, "Ver minha trilha");
  await pagina.waitForURL("**/trilha");
  await pagina.getByText("Seção 1 · Unidade 1").waitFor();
  await pagina.getByText("COMEÇAR").waitFor();
  await pagina.waitForTimeout(400);
  await captura(pagina, `${prefixo}-trilha`, false);
}

const navegador = await chromium.launch({ args: argumentos });
try {
  // ---------------------------------------------------------------- visitante
  console.log("1. Visitante sem login é mandado para /entrar");
  const visitante = await novaPessoa(navegador, { nome: "Ninguém", email: "ninguem@exemplo.com" });
  for (const rota of ["/trilha", "/perfil", "/amigos", "/onboarding", "/camera", "/onboarding/triagem"]) {
    await visitante.pagina.goto(APP + rota);
    assert.match(visitante.pagina.url(), /\/entrar$/, `${rota} sem login`);
  }
  await visitante.pagina.goto(APP + "/c/ZZZZZZ");
  await visitante.pagina.getByText("Este convite não vale mais").waitFor();

  // ---------------------------------------------------------------------- Ana
  console.log("2. Ana chega pela landing, entra com Google e faz o cadastro");
  const ana = await novaPessoa(navegador, { nome: "Ana Souza", email: "ana@exemplo.com" });
  await ana.pagina.goto(APP);
  await captura(ana.pagina, "landing");
  await ana.pagina.getByRole("link", { name: "Começar" }).click();
  await ana.pagina.waitForURL("**/entrar");
  await captura(ana.pagina, "entrar");
  await cadastro(ana.pagina, { apelido: "Ana", nascimento: "1962-03-10", prefixo: "ana" });

  let [perfilAna] = await sql("select * from public.profiles where apelido = 'Ana'");
  assert.equal(perfilAna.altura_cm, 168);
  assert.equal(Number(perfilAna.peso_kg), 64.5);
  assert.deepEqual(perfilAna.equipamentos, ["tapete"]);
  assert.equal(perfilAna.fuso_horario, "America/Sao_Paulo");
  assert.equal(perfilAna.liberado_alta_intensidade, true);
  assert.equal(perfilAna.dificuldade_atual, 3, "pouco ativo começa na dificuldade 3");
  assert.equal(perfilAna.convidado_por, null);
  assert.ok(perfilAna.onboarding_concluido_em);
  const aceites = await sql("select tipo, versao from public.consents where user_id = $1 order by tipo", [perfilAna.id]);
  assert.deepEqual(aceites.map((a) => a.tipo), ["dados_saude", "privacidade", "termos"]);
  const [ofensivaAna] = await sql("select meta_compromisso from public.streaks where user_id = $1", [perfilAna.id]);
  assert.equal(ofensivaAna.meta_compromisso, 14);

  console.log("2b. Ana percorre a trilha: card do hexágono, timer, XP, baú e pular de seção");
  const trilha = ana.pagina;
  // Hexágono bloqueado explica o que falta.
  await trilha.getByRole("button", { name: "Mobilidade articular, bloqueado" }).first().click();
  await trilha.getByText("Complete os anteriores para liberar.").waitFor();
  await captura(trilha, "ana-trilha-bloqueado", false);
  // Hexágono atual abre o card com Começar.
  await trilha.getByRole("button", { name: "Aquecimento, disponível" }).click();
  await trilha.getByText("3 min 30 s · +10 XP").waitFor();
  await captura(trilha, "ana-trilha-card", false);
  await trilha.getByRole("link", { name: "Começar" }).click();
  await trilha.waitForURL("**/desafio/n1u1d01");
  await trilha.getByText("Marcha estacionária com braços").waitFor();
  await trilha.getByText("de frente para o celular").first().waitFor();
  await captura(trilha, "ana-desafio-pronto", false);

  // Com a câmera: o exercício começa, o contador e o anel aparecem.
  await abrirComCamera(trilha);
  await trilha.getByText("Exercício 1 de 2").waitFor();
  await trilha.waitForTimeout(1500);
  await captura(trilha, "ana-desafio-camera", false);
  // "Senti dor" pausa e pergunta onde dói; dá para continuar.
  await trilha.getByRole("button", { name: "Senti dor" }).click();
  await trilha.getByRole("dialog", { name: "Senti dor" }).waitFor();
  await captura(trilha, "ana-desafio-dor", false);
  await trilha.getByRole("button", { name: "Foi só um susto, continuar" }).click();
  // A imagem da câmera falsa é parada: sem movimento, vale como sem câmera (metade do XP).
  await trilha.getByRole("button", { name: "Concluí" }).click();
  await trilha.getByText("+8").waitFor();
  await trilha.getByText("A câmera não viu movimento").waitFor();
  await captura(trilha, "ana-desafio-resultado", false);
  await trilha.getByRole("link", { name: "Continuar" }).click();
  await trilha.waitForURL("**/trilha");
  await trilha.getByLabel("8 de 20 XP hoje").waitFor();
  await trilha.getByLabel("Ofensiva de 1 dia").waitFor();
  await trilha.getByRole("button", { name: "Aquecimento, concluído" }).first().waitFor();
  await trilha.getByRole("button", { name: "Mobilidade articular, disponível" }).waitFor();

  // Refazer vale 1/3 do XP uma vez por dia; desafio bloqueado não abre.
  await trilha.goto(`${APP}/desafio/n1u1d01`);
  await trilha.getByText("refazer vale 1/3 do XP").waitFor();
  await trilha.getByRole("button", { name: "Fazer sem câmera" }).click();
  await trilha.getByRole("timer").waitFor();
  await captura(trilha, "ana-desafio-timer", false);
  await trilha.getByRole("button", { name: "Pausar" }).click();
  await trilha.getByRole("button", { name: "Continuar o timer" }).click();
  await trilha.getByRole("button", { name: "Concluí" }).click();
  await trilha.getByText("+2").waitFor();
  await trilha.getByText("Refazer vale 1/3 do XP").waitFor();
  await trilha.goto(`${APP}/desafio/n1u1d05`);
  await trilha.waitForURL("**/trilha");

  for (const id of ["n1u1d02", "n1u1d03", "n1u1d04"]) await fazerDesafio(trilha, id);
  await trilha.getByRole("button", { name: "Baú de XP, pronto para abrir" }).click();
  await trilha.getByRole("button", { name: "Abrir baú" }).click();
  await trilha.getByText("+10 XP para você!").waitFor();
  await captura(trilha, "ana-trilha-bau", false);
  await trilha.getByLabel("35 de 20 XP hoje").waitFor();
  let xp = await sql("select tipo, sum(valor)::int as total from public.xp_events where user_id = $1 group by tipo order by tipo", [perfilAna.id]);
  assert.deepEqual(xp, [{ tipo: "bau", total: 10 }, { tipo: "desafio", total: 20 }, { tipo: "primeiro_do_dia", total: 3 }, { tipo: "refazer", total: 2 }]);
  // Só números chegaram ao servidor: um bloco por exercício do desafio feito com a câmera.
  const blocosSalvos = await sql("select reps_validas, tempo_valido_s::float, kpis from public.attempt_blocks b join public.challenge_attempts a on a.id = b.attempt_id where a.user_id = $1", [perfilAna.id]);
  assert.equal(blocosSalvos.length, 1);
  assert.ok("cadencia" in blocosSalvos[0].kpis);

  // "Senti dor" de verdade: registra a região e encerra sem XP.
  await trilha.goto(`${APP}/desafio/n1u1d05`);
  await abrirComCamera(trilha);
  await trilha.getByRole("button", { name: "Senti dor" }).click();
  await trilha.getByRole("button", { name: "Joelho" }).click();
  await trilha.waitForURL("**/trilha");
  const dores = await sql("select regiao, acao_tomada from public.pain_reports where user_id = $1", [perfilAna.id]);
  assert.deepEqual(dores, [{ regiao: "joelho", acao_tomada: "encerrou" }]);
  await trilha.getByLabel("35 de 20 XP hoje").waitFor();

  // Lista de seções e "Pular para cá".
  await trilha.getByRole("button", { name: "Ver todas as seções" }).click();
  await trilha.getByRole("dialog", { name: "Seções" }).waitFor();
  await captura(trilha, "ana-secoes", false);
  const secao5 = trilha.getByRole("listitem").filter({ hasText: "Chão firme" });
  await secao5.getByRole("button", { name: "Pular para cá" }).click();
  await secao5.getByText("Esta seção pede: tapete.").waitFor();
  await captura(trilha, "ana-secoes-confirmar", false);
  await secao5.getByRole("button", { name: "Pular", exact: true }).click();
  await trilha.getByLabel("Nível atual: 5").waitFor();
  await trilha.getByText("Seção 5 · Unidade 1").waitFor();
  await trilha.waitForTimeout(600);
  await captura(trilha, "ana-trilha-secao5", false);
  [perfilAna] = await sql("select * from public.profiles where id = $1", [perfilAna.id]);
  assert.equal(perfilAna.nivel_atual, 5);

  console.log("3. Ana, já cadastrada, não volta ao onboarding; vê perfil e link de convite");
  await ana.pagina.goto(APP + "/onboarding/termos");
  await ana.pagina.waitForURL("**/trilha");
  await ana.pagina.goto(APP);
  await ana.pagina.waitForURL("**/trilha");
  await ana.pagina.getByRole("link", { name: "Perfil" }).click();
  await ana.pagina.getByText("64 anos (faixa 60+)").waitFor();
  await captura(ana.pagina, "ana-perfil");
  await ana.pagina.getByRole("link", { name: "Editar dados e configurações" }).click();
  await ana.pagina.getByLabel("Peso (kg)").fill("63");
  await ana.pagina.getByText("Joelho").click();
  await captura(ana.pagina, "ana-config");
  await ana.pagina.getByRole("button", { name: "Salvar" }).click();
  await ana.pagina.waitForURL("**/perfil");
  await ana.pagina.getByText("63 kg").waitFor();
  await ana.pagina.getByRole("link", { name: "Amigos" }).click();
  await ana.pagina.getByText(perfilAna.codigo_convite, { exact: true }).waitFor();
  await captura(ana.pagina, "ana-amigos-vazio");
  await ana.pagina.getByRole("link", { name: "Liga" }).click();
  await ana.pagina.getByRole("heading", { name: "Divisão Bronze" }).waitFor();

  // -------------------------------------------------------------------- Bruno
  console.log("4. Bruno chega pelo link da Ana, responde 'sim' na triagem e fica limitado");
  const bruno = await novaPessoa(navegador, { nome: "Bruno Lima", email: "bruno@exemplo.com" });
  await bruno.pagina.goto(`${APP}/c/${perfilAna.codigo_convite.toLowerCase()}`);
  await bruno.pagina.getByRole("heading", { name: "Ana te convidou" }).waitFor();
  await captura(bruno.pagina, "bruno-landing-convite");
  await bruno.pagina.getByRole("button", { name: "Aceitar convite" }).click();
  await bruno.pagina.waitForURL("**/entrar");
  await cadastro(bruno.pagina, { apelido: "Bruno", nascimento: "1995-07-22", triagemSim: true, prefixo: "bruno" });

  let [perfilBruno] = await sql("select * from public.profiles where apelido = 'Bruno'");
  assert.equal(perfilBruno.convidado_por, perfilAna.id, "o convite registrou quem convidou");
  assert.equal(perfilBruno.liberado_alta_intensidade, false);
  const convites = await sql("select inviter_id, invitee_id, ativado_em, recompensado from public.invites");
  assert.deepEqual(convites, [{ inviter_id: perfilAna.id, invitee_id: perfilBruno.id, ativado_em: null, recompensado: false }]);

  // Limitado pela triagem: desafio intenso aparece travado, com o caminho para liberar.
  await bruno.pagina.getByRole("button", { name: "Força de pernas, bloqueado" }).first().click();
  await bruno.pagina.getByText("Travado por segurança").waitFor();
  await captura(bruno.pagina, "bruno-trilha-travado", false);
  await bruno.pagina.keyboard.press("Escape");
  await bruno.pagina.getByText("Travado por segurança").waitFor({ state: "detached" });

  console.log("5. Bruno declara liberação médica no perfil");
  await bruno.pagina.getByRole("link", { name: "Perfil" }).click();
  await bruno.pagina.getByText("Treinos intensos travados").waitFor();
  await captura(bruno.pagina, "bruno-perfil-travado");
  await bruno.pagina.getByRole("button", { name: "Confirmar liberação" }).click();
  await bruno.pagina.getByRole("alert").filter({ hasText: "Marque a confirmação" }).waitFor();
  await bruno.pagina.getByRole("checkbox").check();
  await bruno.pagina.getByRole("button", { name: "Confirmar liberação" }).click();
  await bruno.pagina.getByText("Você declarou liberação médica").waitFor();
  [perfilBruno] = await sql("select * from public.profiles where id = $1", [perfilBruno.id]);
  assert.equal(perfilBruno.liberado_alta_intensidade, true);
  assert.ok(perfilBruno.liberacao_declarada_em);

  console.log("6. Ana vê o Bruno na lista de convites, sem dados de saúde dele");
  await ana.pagina.goto(APP + "/amigos");
  await ana.pagina.getByText("Bruno", { exact: true }).waitFor();
  await ana.pagina.getByText("1 pessoa entrou pelo seu link").waitFor();
  await captura(ana.pagina, "ana-amigos-com-bruno");

  console.log("7. Menor de 18 anos é barrado; sair e entrar de novo volta para onde parou");
  const caio = await novaPessoa(navegador, { nome: "Caio Nunes", email: "caio@exemplo.com" });
  await caio.pagina.goto(APP + "/entrar");
  await caio.pagina.getByRole("button", { name: "Entrar com Google" }).click();
  await caio.pagina.waitForURL("**/onboarding/termos");
  for (const caixa of await caio.pagina.getByRole("checkbox").all()) await caixa.check();
  await continuar(caio.pagina, "Aceitar e continuar");
  await caio.pagina.waitForURL("**/perfil/apelido");
  await continuar(caio.pagina);
  await caio.pagina.waitForURL("**/perfil/nascimento");
  // Tira o limite do campo para testar a validação do servidor.
  await caio.pagina.locator('input[type="date"]').evaluate((campo) => campo.removeAttribute("max"));
  await caio.pagina.locator('input[type="date"]').fill(`${new Date().getFullYear() - 16}-01-15`);
  await continuar(caio.pagina);
  await caio.pagina.getByRole("alert").filter({ hasText: "maiores de 18" }).waitFor();
  await captura(caio.pagina, "caio-menor-de-idade");
  await caio.pagina.goto(APP + "/trilha");
  await caio.pagina.waitForURL("**/perfil/nascimento");

  await ana.pagina.goto(APP + "/perfil");
  await ana.pagina.getByRole("button", { name: "Sair da conta" }).click();
  await ana.pagina.waitForURL(APP + "/");
  await ana.pagina.goto(APP + "/trilha");
  await ana.pagina.waitForURL("**/entrar");

  const externas = [...visitante.externas, ...ana.externas, ...bruno.externas, ...caio.externas];
  assert.deepEqual(externas, [], "nenhuma requisição para fora do app e do Supabase");
  console.log("\nFase 1: fluxo completo OK");
} finally {
  await navegador.close();
}
