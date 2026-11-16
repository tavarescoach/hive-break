"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_CONVITE, normalizarCodigo } from "@/lib/convite";

/** Guarda o código de quem convidou e segue para o login. */
export async function aceitarConvite(formulario: FormData) {
  const codigo = normalizarCodigo(String(formulario.get("codigo") ?? ""));
  if (codigo) {
    (await cookies()).set(COOKIE_CONVITE, codigo, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
  }
  redirect("/entrar");
}
