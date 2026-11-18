"use client";

import { salvarPush } from "@/app/lembretes/acoes";

/** Push do navegador. No iPhone só existe com o app instalado na tela inicial. */
export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(preenchido);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Navegador";
}

/** Pede a permissão (se preciso), inscreve este aparelho e salva no banco. */
export async function ativarPushNesteAparelho(): Promise<"ok" | "negado" | "erro"> {
  if (!pushSuportado()) return "erro";
  try {
    const permissao = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permissao !== "granted") return "negado";
    await navigator.serviceWorker.register("/sw.js");
    const registro = await navigator.serviceWorker.ready;
    const inscricao =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      }));
    const { ok } = await salvarPush(inscricao.toJSON() as Parameters<typeof salvarPush>[0], nomeDoAparelho());
    return ok ? "ok" : "erro";
  } catch {
    return "erro";
  }
}

/** Este aparelho já está inscrito? */
export async function aparelhoInscrito(): Promise<boolean> {
  if (!pushSuportado()) return false;
  try {
    const registro = await navigator.serviceWorker.getRegistration("/sw.js");
    return Boolean(await registro?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
