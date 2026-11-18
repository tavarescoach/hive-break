"use server";

import { cookies } from "next/headers";
import {
  classificarErroCodigo, emailValido, MENSAGENS_CODIGO, mensagemErroCodigo, normalizarEmail, tipoVerificacao,
  type FluxoCodigo, type ResultadoErroCodigo,
} from "@/dominio/codigo-email";
import { COOKIE_MIGRACAO, OPCOES_COOKIE_MIGRACAO } from "@/lib/convite";
import { lerSessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Código de 6 dígitos por e-mail (docs/VISITANTE.md, seções 2, 6 e 7).
 *
 *   conversao: visitante salvando o resultado. updateUser({ email }) no usuário
 *              anônimo; o Supabase manda o código do template "Change Email
 *              Address" e o verifyOtp é do tipo email_change. Ao confirmar, o
 *              Auth grava o e-mail e o banco converte o visitante (mesmo id).
 *   migracao:  o e-mail do visitante já tem conta. Manda o código de login
 *              (signInWithOtp, template "Magic Link") e, depois de confirmado,
 *              migrar_visitante_por_token leva o resultado para a conta.
 *   login:     quem já tem conta entra. signInWithOtp + verifyOtp tipo email.
 */
export interface RespostaEnvio {
  ok: boolean;
  /** Pode mudar de conversao para migracao quando o e-mail já tem conta. */
  fluxo?: FluxoCodigo;
  erro?: string;
  /** Segundos até poder pedir outro código. */
  esperaS?: number;
  /** Login de um e-mail sem conta. */
  semConta?: boolean;
}

export interface RespostaVerificacao {
  ok: boolean;
  destino?: string;
  erro?: string;
  tipoErro?: ResultadoErroCodigo["tipo"];
  /** Resultado do visitante levado para a conta existente. */
  migrados?: number;
}

interface ErroAuth {
  code?: string;
  message: string;
  status?: number;
}

const emailJaExiste = (e: ErroAuth) =>
  e.code === "email_exists" || e.code === "user_already_exists" || /already (been )?registered|already exists/i.test(e.message);
const semCadastro = (e: ErroAuth) => e.code === "otp_disabled" || /signups not allowed/i.test(e.message);

function mensagemDeEnvio(e: ErroAuth): string {
  if (e.code === "captcha_failed" || /captcha/i.test(e.message)) return MENSAGENS_CODIGO.captcha;
  if (e.code === "over_email_send_rate_limit" || e.code === "over_request_rate_limit" || e.status === 429) return MENSAGENS_CODIGO.limite;
  if (e.code === "email_address_invalid" || e.code === "validation_failed") return MENSAGENS_CODIGO.emailInvalido;
  return MENSAGENS_CODIGO.falha;
}

export async function enviarCodigo(fluxoPedido: "conversao" | "login", emailBruto: string, captcha?: string): Promise<RespostaEnvio> {
  if (!emailValido(emailBruto)) return { ok: false, erro: MENSAGENS_CODIGO.emailInvalido };
  const email = normalizarEmail(emailBruto);
  const supabase = await criarClienteServidor();
  const sessao = await lerSessao();
  const visitante = Boolean(sessao?.perfil.visitante);

  const pode = await supabase.rpc("codigo_pode_enviar", { p_email: email });
  const r = pode.data as { ok: boolean; espera_s: number } | null;
  if (pode.error || !r) return { ok: false, erro: MENSAGENS_CODIGO.falha };
  if (!r.ok) return { ok: false, erro: MENSAGENS_CODIGO.espera(r.espera_s), esperaS: r.espera_s };

  if (fluxoPedido === "conversao" && visitante) {
    const { error } = await supabase.auth.updateUser({ email });
    if (!error) {
      await supabase.rpc("registrar_evento_codigo", { p_tipo: "email_code_sent", p_fluxo: "conversao" });
      return { ok: true, fluxo: "conversao", esperaS: r.espera_s };
    }
    if (!emailJaExiste(error)) return { ok: false, erro: mensagemDeEnvio(error) };
    // O e-mail já tem conta: segue como login e leva o resultado depois.
  }

  let fluxo: FluxoCodigo = "login";
  if (visitante) {
    const token = await supabase.rpc("preparar_migracao_visitante");
    if (token.error || typeof token.data !== "string") return { ok: false, erro: MENSAGENS_CODIGO.falha };
    (await cookies()).set(COOKIE_MIGRACAO, token.data, OPCOES_COOKIE_MIGRACAO);
    fluxo = "migracao";
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Conta nova só pelo caminho principal (username de visitante); "Entrar" não cria conta.
    options: { shouldCreateUser: false, captchaToken: captcha },
  });
  if (error) {
    if (semCadastro(error)) return { ok: false, semConta: true, erro: "Não achei uma conta com esse e-mail." };
    return { ok: false, erro: mensagemDeEnvio(error) };
  }
  await supabase.rpc("registrar_evento_codigo", { p_tipo: "email_code_sent", p_fluxo: fluxo });
  return { ok: true, fluxo, esperaS: r.espera_s };
}

export async function verificarCodigo(fluxo: FluxoCodigo, emailBruto: string, codigo: string): Promise<RespostaVerificacao> {
  if (!emailValido(emailBruto) || !/^\d{6}$/.test(codigo)) return { ok: false, erro: "Digite os 6 números do código." };
  const email = normalizarEmail(emailBruto);
  const supabase = await criarClienteServidor();

  const estado = (await supabase.rpc("codigo_estado", { p_email: email })).data as { restantes: number; enviado_ha_s: number | null } | null;
  if (estado && estado.restantes <= 0) return { ok: false, erro: MENSAGENS_CODIGO.bloqueado, tipoErro: "bloqueado" };

  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: tipoVerificacao(fluxo) });
  if (error) {
    if (error.status === 429 || error.code === "over_request_rate_limit") return { ok: false, erro: MENSAGENS_CODIGO.limite };
    const restantes = (await supabase.rpc("codigo_erro", { p_email: email })).data as number | null;
    const tipo = classificarErroCodigo(restantes ?? 0, estado?.enviado_ha_s ?? null);
    return { ok: false, erro: mensagemErroCodigo(tipo), tipoErro: tipo.tipo };
  }

  await supabase.rpc("codigo_ok", { p_email: email });
  await supabase.rpc("registrar_evento_codigo", { p_tipo: "email_code_verified", p_fluxo: fluxo });

  if (fluxo === "conversao") {
    // O gatilho em auth.users já converteu; esta chamada é o reforço.
    await supabase.rpc("confirmar_visitante");
    return { ok: true, destino: "/onboarding" };
  }
  const migrados = await migrarSeHouver(supabase);
  return { ok: true, destino: "/onboarding", migrados };
}

/** Depois do login: se havia um visitante neste aparelho, leva o resultado dele para a conta. */
async function migrarSeHouver(supabase: Awaited<ReturnType<typeof criarClienteServidor>>): Promise<number> {
  const jarra = await cookies();
  const token = jarra.get(COOKIE_MIGRACAO)?.value;
  if (!token) return 0;
  jarra.delete(COOKIE_MIGRACAO);
  const { data } = await supabase.rpc("migrar_visitante_por_token", { p_token: token });
  return (data as { ok: boolean; desafios: number } | null)?.desafios ?? 0;
}

/** Google a partir da tela do visitante: guarda o token para levar o resultado se a conta Google já existir. */
export async function prepararMigracaoGoogle(): Promise<boolean> {
  const sessao = await lerSessao();
  if (!sessao?.perfil.visitante) return false;
  const token = await sessao.supabase.rpc("preparar_migracao_visitante");
  if (token.error || typeof token.data !== "string") return false;
  (await cookies()).set(COOKIE_MIGRACAO, token.data, OPCOES_COOKIE_MIGRACAO);
  return true;
}
