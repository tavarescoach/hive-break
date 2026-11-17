import { describe, expect, it } from "vitest";
import { Motor } from "../motor";
import { definicao, dosTipo, rodar } from "./apoio";
import { agachamento, gerarSequencia, parado, PROPORCAO, repetir, type Trecho } from "./sintetico";

const def = definicao("agachamento_livre");
const emPe = (s = 1.2) => parado(s, { joelho: 174 });
const cenario = (...trechos: (Trecho | Trecho[])[]) => gerarSequencia([emPe(), ...trechos.flat(), emPe(1)]);

describe("agachamento livre", () => {
  it("conta 10 repetições completas, sem parciais", () => {
    const { estado, kpis } = rodar(def, cenario(repetir(10, () => agachamento())));
    expect(estado.repsValidas).toBe(10);
    expect(estado.repsParciais).toBe(0);
    expect(kpis.indice_tecnico).toBe(1);
  });

  it("conta certo também a 20 fps e com mais ruído", () => {
    const frames = gerarSequencia([emPe(), ...repetir(10, () => agachamento()), emPe(1)], { fps: 20, ruido: 0.008, semente: 3 });
    expect(rodar(def, frames).estado.repsValidas).toBe(10);
  });

  it("meia repetição (fundo a 112°) conta, mas com o aviso \"Desça mais\"", () => {
    const { estado, eventos, kpis } = rodar(
      def,
      cenario(
        repetir(3, () => agachamento()),
        repetir(3, () => agachamento({ fundo: 112 })),
        repetir(2, () => agachamento()),
      ),
    );
    expect(estado.repsValidas).toBe(8);
    expect(estado.repsParciais).toBe(0);
    const avisos = dosTipo(eventos, "erro").filter((e) => e.id === "amplitude_curta");
    expect(avisos).toHaveLength(3);
    expect(avisos[0].feedback).toBe("Desça mais");
    // A meia repetição vale menos na amplitude e na técnica.
    expect(kpis.indice_tecnico).toBeCloseTo(5 / 8, 2);
  });

  it("agachamento curto demais (130°) vira parcial: aparece no feedback e não soma", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(4, () => agachamento({ fundo: 130 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(4);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Desça mais");
  });

  it("flexão leve do joelho (150°) não é rep nem parcial", () => {
    const { estado } = rodar(def, cenario(repetir(4, () => agachamento({ fundo: 150 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(0);
  });

  it("tremor em pé não conta repetição", () => {
    const treme: Trecho = { s: 8, pose: (u) => ({ joelho: 168 + 6 * Math.sin(u * 8 * 2 * Math.PI * 3) }) };
    const { estado } = rodar(def, gerarSequencia([emPe(), treme], { ruido: 0.01 }));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(0);
  });

  it("movimento rápido demais (antifraude) não conta", () => {
    const rapido = () => agachamento({ descida: 0.08, pausa: 0.05, subida: 0.08, descanso: 0.05 });
    const { estado } = rodar(def, cenario(repetir(10, rapido)));
    expect(estado.repsValidas).toBe(0);
  });

  it("ciclo completo em menos de 500 ms (mais de 2 por segundo) é registrado como rápido, não como válido", () => {
    // Sem ruído nem suavização, para o tempo de cada fase ser exato: ciclos de 440 ms.
    const rapido = () => agachamento({ descida: 0.02, pausa: 0.2, subida: 0.02, descanso: 0.2 });
    const frames = gerarSequencia([emPe(), ...repetir(6, rapido), emPe(1)], { ruido: 0 });
    const motor = new Motor(def, { proporcao: PROPORCAO, suavizar: false });
    const eventos = frames.flatMap((f) => motor.processar(f));
    // Só a primeira pode valer: antes dela a pessoa estava parada, então não há ciclo curto.
    expect(motor.estado.repsValidas).toBe(1);
    expect(dosTipo(eventos, "rep_rapida").length).toBe(5);
    expect(motor.kpis().reps_rapidas).toBe(5);
  });

  it("detecta joelhos para dentro e derruba o índice técnico", () => {
    const { estado, eventos, kpis } = rodar(
      def,
      cenario(
        repetir(2, () => agachamento()),
        repetir(2, () => agachamento({ valgo: 0.06 })),
      ),
    );
    expect(estado.repsValidas).toBe(4);
    const erros = dosTipo(eventos, "erro").filter((e) => e.id === "valgo");
    expect(erros.length).toBe(2);
    expect(erros[0]).toMatchObject({ id: "valgo", feedback: "Joelhos para fora" });
    expect(kpis.indice_tecnico).toBe(0.5);
    expect(kpis.erros.valgo).toBe(2);
  });

  it("joelhos para dentro só é checado com os tornozelos bem visíveis (evita falso positivo)", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(3, () => agachamento({ valgo: 0.06, extra: { visibilidadePes: 0.55 } }))));
    expect(estado.repsValidas).toBe(3);
    expect(dosTipo(eventos, "erro").filter((e) => e.id === "valgo")).toHaveLength(0);
  });

  it("conta mesmo com os pés fora da imagem", () => {
    const { estado } = rodar(def, cenario(repetir(4, () => agachamento({ extra: { visibilidadePes: 0.1 } }))));
    expect(estado.repsValidas).toBe(4);
  });

  it("ignora frames com pontos pouco visíveis sem contar errado", () => {
    const piscada = parado(0.4, { joelho: 174, visibilidadePes: 0.3 });
    const { estado, eventos } = rodar(
      def,
      cenario(
        repetir(3, () => agachamento()),
        piscada,
        repetir(3, () => agachamento()),
      ),
    );
    expect(estado.repsValidas).toBe(6);
    expect(dosTipo(eventos, "fora_quadro").length).toBe(0);
  });

  it("avisa quando o corpo sai do quadro por 1 s e retoma sozinho", () => {
    const { estado, eventos, kpis } = rodar(
      def,
      cenario(
        repetir(3, () => agachamento()),
        parado(2.5, { ausente: true }),
        emPe(0.5),
        repetir(3, () => agachamento()),
      ),
    );
    expect(estado.repsValidas).toBe(6);
    const fora = dosTipo(eventos, "fora_quadro");
    const voltou = dosTipo(eventos, "voltou_quadro");
    expect(fora.length).toBe(1);
    expect(voltou.length).toBe(1);
    // Aviso em até ~1 s depois de sumir.
    const sumiu = 1200 + 3 * 2000;
    expect(fora[0].t - sumiu).toBeGreaterThanOrEqual(950);
    expect(fora[0].t - sumiu).toBeLessThanOrEqual(1100);
    expect(kpis.fora_quadro_pct).toBeGreaterThan(10);
  });

  it("sair do quadro no meio da descida não gera repetição", () => {
    const meiaDescida: Trecho = { s: 0.5, pose: (u) => ({ joelho: 174 - 60 * u }) };
    const { estado } = rodar(def, gerarSequencia([emPe(), meiaDescida, parado(2, { ausente: true }), emPe(1.5)]));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(0);
  });

  it("calcula os KPIs do bloco", () => {
    const { kpis } = rodar(def, cenario(repetir(10, () => agachamento({ fundo: 90 }))));
    expect(kpis.reps_validas).toBe(10);
    // Fundo a 90 graus, entre o mínimo aceito (120) e o ideal (85): cerca de 0,86.
    expect(kpis.amplitude_media).toBeGreaterThan(0.75);
    expect(kpis.amplitude_media).toBeLessThan(0.95);
    // Descida de 0,7 s e subida de 0,6 s (menos a folga das fases).
    expect(kpis.tempo_excentrico).toBeGreaterThan(0.5);
    expect(kpis.tempo_excentrico).toBeLessThan(1.0);
    expect(kpis.tempo_concentrico).toBeGreaterThan(0.3);
    expect(kpis.tempo_concentrico).toBeLessThan(0.8);
    // 10 reps de 2 s em 22,2 s de bloco = 27 reps/min.
    expect(kpis.cadencia).toBeGreaterThan(25);
    expect(kpis.cadencia).toBeLessThan(29);
    expect(kpis.regularidade).toBeGreaterThan(0.95);
    expect(kpis.fora_quadro_pct).toBe(0);
  });
});
