/** Assinatura da marca (decisão do Luan: Hive Break, por Luan Tavares, treinador). */
export function Assinatura({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-apagado ${className}`}>
      Hive Break · por <span className="font-semibold text-texto">Luan Tavares</span> · Treinador
    </p>
  );
}
