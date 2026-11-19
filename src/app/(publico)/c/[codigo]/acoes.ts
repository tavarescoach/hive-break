"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_CONVITE, COOKIE_GANCHO, familiaDaQuery, ganchoIdDaQuery, normalizarCodigo, serializarGancho,
} from "@/lib/convite";

const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 14,
  path: "/",
};

/** Guarda o código de quem convidou (e o gancho, se veio um) e segue para o username (visitante, docs/VISITANTE.md). */
export async function aceitarConvite(formulario: FormData) {
  const codigo = normalizarCodigo(String(formulario.get("codigo") ?? ""));
  const familia = familiaDaQuery(String(formulario.get("g") ?? ""));
  const ganchoId = ganchoIdDaQuery(String(formulario.get("h") ?? ""));
  const jarra = await cookies();
  if (codigo) jarra.set(COOKIE_CONVITE, codigo, OPCOES_COOKIE);
  if (familia && ganchoId) jarra.set(COOKIE_GANCHO, serializarGancho(familia, ganchoId), OPCOES_COOKIE);
  redirect("/comecar");
}
