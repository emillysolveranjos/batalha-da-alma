// Turnos salvos, fase atual e início de turno: usados pelo painel e pela barra do mestre na batalha.
// Fica no navegador do mestre (localStorage), compartilhado entre as duas telas.

import { BattleConfig, BattleState, SavedTurn } from "./shared";

export function loadLibrary(): SavedTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem("batalha-turnos") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveLibrary(lib: SavedTurn[]) {
  try {
    localStorage.setItem("batalha-turnos", JSON.stringify(lib));
  } catch {
    /* sem armazenamento */
  }
}

/** Fase escolhida para o próximo turno (-1 = como está nas abas). */
export function getPhaseIdx(): number {
  try {
    const v = Number(localStorage.getItem("batalha-fase") ?? "-1");
    return Number.isFinite(v) ? v : -1;
  } catch {
    return -1;
  }
}

export function setPhaseIdx(i: number) {
  try {
    localStorage.setItem("batalha-fase", String(i));
  } catch {
    /* sem armazenamento */
  }
}

/** Copia os ataques (e o modo/intensidade, se houver) de um turno salvo para a configuração. */
export function applyTurn(cfg: BattleConfig, t: SavedTurn) {
  cfg.ataques = structuredClone(t.ataques);
  cfg.monstro.fala = t.fala;
  cfg.mecanica.ordem = t.ordem;
  if (t.modo) cfg.alma.modo = t.modo;
  if (t.intensidade) cfg.mecanica.intensidade = t.intensidade;
  if (t.cenario) cfg.cenario = structuredClone(t.cenario);
}

/** Avança para a próxima fase da lista; devolve o nome dela ou null se a lista estiver vazia. */
export function advancePhase(cfg: BattleConfig): string | null {
  const lib = loadLibrary();
  if (!lib.length) return null;
  const i = (getPhaseIdx() + 1) % lib.length;
  setPhaseIdx(i);
  applyTurn(cfg, lib[i]);
  return lib[i].nome;
}

/** Estado de um novo turno; mantém número do turno e vida do monstro se a batalha já estava ativa. */
export function newBattleState(cfg: BattleConfig, prev: BattleState | null | undefined, participantes: string[]): BattleState {
  const ativa = !!prev?.ativo;
  return {
    ativo: true,
    turno: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    seed: Math.floor(Math.random() * 1e9),
    participantes,
    config: structuredClone(cfg),
    numero: ativa ? (prev!.numero ?? 1) + 1 : 1,
    monstroHp: ativa ? Math.min(prev!.monstroHp ?? cfg.monstro.hp, cfg.monstro.hp) : cfg.monstro.hp,
  };
}
