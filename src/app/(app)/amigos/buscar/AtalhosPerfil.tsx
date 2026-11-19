import QRCode from "qrcode";
import { cartao } from "@/componentes/estilos";
import { CopiarLink } from "./CopiarLink";

/** Link e QR code do próprio perfil (docs/PERFIL.md, seção 4.2). */
export async function AtalhosPerfil({ link }: { link: string }) {
  const svg = await QRCode.toString(link, {
    type: "svg",
    margin: 1,
    width: 112,
    color: { dark: "#f5f2ea", light: "#00000000" },
  });

  return (
    <div className={`${cartao} flex items-center gap-4`}>
      <div aria-hidden className="shrink-0 [&_svg]:h-20 [&_svg]:w-20" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-apagado">Seu link</p>
        <p className="truncate font-mono text-sm">{link}</p>
        <CopiarLink link={link} />
      </div>
    </div>
  );
}
