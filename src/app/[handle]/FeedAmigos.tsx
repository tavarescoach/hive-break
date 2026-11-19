import Link from "next/link";
import { Avatar } from "@/componentes/Avatar";
import { cartao } from "@/componentes/estilos";
import { BotaoHighFive } from "./BotaoHighFive";

export interface EventoFeed {
  user_id: string;
  apelido: string | null;
  username: string;
  avatar_url: string | null;
  tipo: string;
  rotulo: string;
  quando: string;
  high_fives: number;
  eu_dei_high_five: boolean;
}

/** Feed de amigos (docs/PERFIL.md, seção 3.3): no máximo 1 evento por pessoa por dia. */
export function FeedAmigos({ eventos }: { eventos: EventoFeed[] }) {
  return (
    <section className={`${cartao} flex flex-col gap-3`}>
      <h2 className="text-base font-bold">Atividade dos amigos</h2>
      {eventos.length === 0 ? (
        <p className="text-sm text-apagado">Quando seus amigos conquistarem algo, aparece aqui.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventos.map((e) => (
            <li key={`${e.user_id}-${e.quando}`} className="flex items-center gap-3">
              <Link href={`/@${e.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar url={e.avatar_url} nome={e.apelido ?? e.username} tamanho={40} />
                <p className="min-w-0 truncate text-sm">
                  <span className="font-bold">{e.apelido ?? e.username}</span> {e.rotulo.toLowerCase()}
                </p>
              </Link>
              <BotaoHighFive paraId={e.user_id} inicialDado={e.eu_dei_high_five} inicialTotal={e.high_fives} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
