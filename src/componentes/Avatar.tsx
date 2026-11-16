/** Foto do Google ou a inicial do nome. */
export function Avatar({ url, nome, tamanho = 48 }: { url: string | null; nome: string; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.42 };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto pequena vinda do Google; não precisa de otimização
      <img src={url} alt="" referrerPolicy="no-referrer" style={estilo} className="shrink-0 rounded-full border border-borda object-cover" />
    );
  }
  return (
    <span aria-hidden style={estilo} className="flex shrink-0 items-center justify-center rounded-full bg-mel font-black text-black">
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
