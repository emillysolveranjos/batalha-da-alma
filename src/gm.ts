// Turnos salvos, fase atual e início de turno: usados pelo painel e pela barra do mestre na batalha.
// Fica no navegador do mestre (localStorage), compartilhado entre as duas telas.

import { BattleConfig, BattleState, SavedTurn } from "./shared";

export function loadLibrary(): SavedTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem("batalha-turnos") || "[]");
    if (!Array.isArray(raw)) return [];
    // listas antigas guardavam "Preset — Fase" no nome
    return (raw as SavedTurn[]).map((t) => {
      if (t.grupo || !t.nome.includes(" — ")) return t;
      const i = t.nome.indexOf(" — ");
      return { ...t, grupo: t.nome.slice(0, i), nome: t.nome.slice(i + 3) };
    });
  } catch {
    return [];
  }
}

/** "Kaizo Knight — Estocada" ou só o nome, para turnos do próprio mestre. */
export function phaseLabel(t: SavedTurn) {
  return t.grupo ? `${t.grupo} — ${t.nome}` : t.nome;
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
  if (t.esquiva !== undefined) cfg.monstro.esquiva = t.esquiva;
}

/** Anda para a próxima (ou anterior) fase da mesma luta; devolve o nome ou null se não houver fases. */
export function advancePhase(cfg: BattleConfig, dir = 1): string | null {
  const lib = loadLibrary();
  if (!lib.length) return null;
  const cur = getPhaseIdx();
  const grupo = cur >= 0 && lib[cur] ? lib[cur].grupo : lib[0].grupo;
  const idxs = lib.map((t, i) => (t.grupo === grupo ? i : -1)).filter((i) => i >= 0);
  const pos = idxs.indexOf(cur);
  const next = pos < 0 ? idxs[0] : idxs[(pos + dir + idxs.length) % idxs.length];
  setPhaseIdx(next);
  applyTurn(cfg, lib[next]);
  return phaseLabel(lib[next]);
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
