import { Formulario } from "@/componentes/Formulario";
import { TelaPasso } from "@/componentes/TelaPasso";
import { ACEITES, AVISO_MEDICO, RESUMO_PRIVACIDADE } from "@/dominio/termos";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { aceitarTermos } from "../acoes";

export default async function Termos() {
  const sessao = await exigirCadastroEmAndamento();
  return (
    <TelaPasso rota="/onboarding/termos" titulo="Antes de começar: sua privacidade" ajuda="O essencial, em linguagem simples.">
      <Formulario acao={aceitarTermos} botao="Aceitar e continuar">
        <ul className="flex flex-col gap-4">
          {RESUMO_PRIVACIDADE.map((item) => (
            <li key={item.titulo} className="flex gap-3">
              <svg className="mt-0.5 shrink-0 text-mel" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.500l4.500 4.500L19 7.500" />
              </svg>
              <div>
                <p className="font-bold leading-tight">{item.titulo}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-apagado">{item.texto}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[15px] leading-relaxed text-apagado">{AVISO_MEDICO}</p>
        <fieldset className="mt-3 flex flex-col gap-1 rounded-2xl border border-borda bg-superficie p-2">
          <legend className="sr-only">Aceites</legend>
          {ACEITES.map((aceite) => (
            <label key={aceite.tipo} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-2">
              <input
                type="checkbox"
                name={aceite.tipo}
                defaultChecked={sessao.aceites.includes(aceite.tipo)}
                className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-mel)]"
              />
              <span className="text-[15px] leading-relaxed">{aceite.texto}</span>
            </label>
          ))}
        </fieldset>
      </Formulario>
    </TelaPasso>
  );
}
