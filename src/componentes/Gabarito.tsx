"use client";

import { useEffect, useState } from "react";
import { GABARITOS, LIGACOES_FIGURA, type NomePonto, type Pose } from "@/exercicios/gabaritos";

/** Tempo de cada ida (ou volta) entre duas posições, e a pausa em cada uma. */
const MOVIMENTO_MS = 1100;
const PAUSA_MS = 500;

function interpolar(a: Pose, b: Pose, u: number): Pose {
  const s = (1 - Math.cos(Math.PI * u)) / 2;
  const r = {} as Pose;
  for (const k of Object.keys(a) as NomePonto[]) r[k] = [a[k][0] + (b[k][0] - a[k][0]) * s, a[k][1] + (b[k][1] - a[k][1]) * s];
  return r;
}

function usePose(poses: Pose[], animar: boolean): Pose {
  const [t, setT] = useState(0);
  const reduzir = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const movendo = animar && poses.length > 1 && !reduzir;
  useEffect(() => {
    if (!movendo) return;
    let raf = 0;
    const inicio = performance.now();
    const passo = () => {
      setT(performance.now() - inicio);
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [movendo]);
  if (!movendo) return poses[poses.length - 1];
  const ciclo = MOVIMENTO_MS + PAUSA_MS;
  const i = Math.floor(t / ciclo) % poses.length;
  const u = Math.min(1, (t % ciclo) / MOVIMENTO_MS);
  return interpolar(poses[i], poses[(i + 1) % poses.length], u);
}

/**
 * Figura de palito com a posição esperada do exercício. Nos de repetição, anima
 * entre o início e o meio do movimento.
 */
export function Gabarito({
  exercicio,
  tamanho = 160,
  cor = "#FFC42E",
  animar = true,
  pose: indicePose,
  className = "",
}: {
  exercicio: string;
  tamanho?: number;
  cor?: string;
  animar?: boolean;
  /** Mostra uma posição fixa (índice) em vez de animar. */
  pose?: number;
  className?: string;
}) {
  const gabarito = GABARITOS[exercicio];
  const animada = usePose(gabarito?.poses ?? [], animar && indicePose === undefined);
  const pose = indicePose !== undefined && gabarito ? gabarito.poses[Math.min(indicePose, gabarito.poses.length - 1)] : animada;
  if (!gabarito) return null;
  const chao = Math.min(98, Math.max(pose.tornozeloE[1], pose.tornozeloD[1], pose.punhoE[1], pose.punhoD[1]) + 3);
  const fundo = (a: NomePonto, b: NomePonto) => gabarito.lateral && a.endsWith("E") && b.endsWith("E");
  const pescoco: [number, number] = [(pose.ombroE[0] + pose.ombroD[0]) / 2, (pose.ombroE[1] + pose.ombroD[1]) / 2];

  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" role="img" aria-label="Posição esperada" className={className}>
      <line x1="4" y1={chao} x2="96" y2={chao} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
      {LIGACOES_FIGURA.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={pose[a][0]} y1={pose[a][1]} x2={pose[b][0]} y2={pose[b][1]}
          stroke={cor} strokeOpacity={fundo(a, b) ? 0.4 : 1} strokeWidth="4.5" strokeLinecap="round"
        />
      ))}
      <line x1={pescoco[0]} y1={pescoco[1]} x2={pose.cabeca[0]} y2={pose.cabeca[1]} stroke={cor} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx={pose.cabeca[0]} cy={pose.cabeca[1]} r="6.5" fill={cor} />
      {gabarito.bastao && (
        <line x1={pose.punhoE[0] - 6} y1={pose.punhoE[1]} x2={pose.punhoD[0] + 6} y2={pose.punhoD[1]} stroke="#C78A0A" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function dicaDoGabarito(exercicio: string): string | null {
  return GABARITOS[exercicio]?.dica ?? null;
}
