// Ferramenta de desenvolvimento (não entra no build): mede a dificuldade de cada fase dos presets
// com um "jogador robô" que olha um pouco à frente e desvia. Rode com o servidor do Vite aberto, no console:
//   const m = await import("/dev/balanco.ts"); await m.medirTudo();
// Cada fase volta com: acertos do robô (jogador razoável), acertos parado (alma sem mexer) e duração.

import { BattleEngine } from "../src/engine";
import { BUILTIN_PRESETS, type PresetFile } from "../src/presets";
import { applyTurn } from "../src/gm";
import type { SavedTurn } from "../src/shared";

type Eng = BattleEngine & Record<string, any>;

const HORIZON = [0.05, 0.12, 0.2, 0.3, 0.4];
const DIRS: [number, number][] = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7],
];

/** Onde o projétil estará daqui a t segundos (aproximação linear, feixes girando incluídos). */
function ahead(u: any, t: number) {
  if (u.pivot) {
    const ang = u.ang + u.spin * t;
    return { ...u, ang, x: u.pivot.x + Math.cos(ang) * (u.pivot.len / 2), y: u.pivot.y + Math.sin(ang) * (u.pivot.len / 2) };
  }
  if (u.hold && u.life + t < u.hold.t) return u;
  if (u.orbit && u.life + t < u.orbit.until) {
    // espiral / roda: gira e (às vezes) fecha o raio
    const o = u.orbit;
    const th = Math.atan2(u.y - o.cy, u.x - o.cx) + o.w * t;
    const r = Math.max(0, o.r - (o.dr ?? 0) * t);
    return { ...u, x: o.cx + Math.cos(th) * r, y: o.cy + Math.sin(th) * r };
  }
  if (u.wave) {
    const w = u.wave;
    return { ...u, x: w.x0 + w.amp * Math.sin(w.w * (u.life + t) + w.ph), y: u.y + u.vy * t };
  }
  if (u.osc) {
    const o = u.osc;
    return { ...u, y: o.y0 - o.amp * (0.5 - 0.5 * Math.cos(o.w * (u.life + t))) };
  }
  const vx = u.hold ? u.hold.vx : u.vx;
  const vy = u.hold ? u.hold.vy : u.vy;
  return { ...u, x: u.x + vx * t + 0.5 * (u.ax ?? 0) * t * t, y: u.y + vy * t + 0.5 * (u.ay ?? 0) * t * t, ang: u.ang + u.spin * t };
}

function active(u: any, t: number) {
  if (u.dead || u.deco) return false;
  if (u.warn - t > 0.02) return false;
  if (u.beam && u.life + t > u.fadeAt) return false;
  return true;
}

/** Perigo de a alma estar nas posições pos(t) nos próximos instantes. */
function danger(e: Eng, pos: (t: number) => { x: number; y: number }, moving: boolean) {
  const hr = 4.5 * e.soulScale + 2.5;
  const near = pos(HORIZON[HORIZON.length - 1]);
  let d = 0;
  for (const u of e.bullets as any[]) {
    if (u.kind === "verde") continue;
    if (u.kind === "azul" && !moving) continue;
    if (u.kind === "laranja" && moving) continue;
    if (!u.beam && !u.pivot && !u.cone && u.rw === undefined) {
      const sp = Math.hypot(u.vx, u.vy) + 60;
      if (Math.hypot(u.x - near.x, u.y - near.y) > u.r + sp * 0.45 + 30) continue;
    }
    for (let i = 0; i < HORIZON.length; i++) {
      const t = HORIZON[i];
      if (!active(u, t)) continue;
      const p = pos(t);
      if (e.hits(ahead(u, t), p.x, p.y, hr)) {
        d += 1 / (1 + i * 0.6);
        break;
      }
    }
  }
  for (const c of e.cannons as any[]) {
    // canhão prestes a disparar: evita a linha dele
    const fireAt = c.enter + c.charge;
    if (c.t > fireAt + c.fire || fireAt - c.t > 0.45) continue;
    const p = pos(Math.max(0, fireAt - c.t));
    const dx = p.x - c.tx;
    const dy = p.y - c.ty;
    const along = dx * Math.cos(c.ang) + dy * Math.sin(c.ang);
    const across = Math.abs(-dx * Math.sin(c.ang) + dy * Math.cos(c.ang));
    if (along > 0 && across < c.width / 2 + hr) d += 1;
  }
  return d;
}

function clampBox(e: Eng, x: number, y: number) {
  const b = e.box;
  const h = 8 * e.soulScale;
  return { x: Math.max(b.l + h, Math.min(b.r - h, x)), y: Math.max(b.t + h, Math.min(b.b - h, y)) };
}

function edgePenalty(e: Eng, p: { x: number; y: number }) {
  const b = e.box;
  const m = Math.min(p.x - b.l, b.r - p.x, p.y - b.t, b.b - p.y);
  return m < 14 ? 0.04 * (14 - m) / 14 : 0;
}

let lastDir = 0;

/** Escolhe as teclas do robô para este quadro. */
function think(e: Eng) {
  const s = e.soul;
  const sp = 150 * Math.max(0.2, e.cfg.alma.velocidade);
  const mode = e.mode;
  e.keys.clear();
  if (mode === "verde") {
    // escudo para o projétil que chega primeiro
    let best = Infinity;
    let dir = s.shield;
    for (const u of e.bullets as any[]) {
      if (u.dead || u.deco || u.beam || u.kind === "verde") continue;
      const dx = u.x - s.x;
      const dy = u.y - s.y;
      const dist = Math.hypot(dx, dy);
      const closing = -(dx * u.vx + dy * u.vy) / Math.max(1, dist);
      if (closing <= 0) continue;
      const tt = dist / closing;
      if (tt < best) {
        best = tt;
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      }
    }
    s.shield = dir;
    return;
  }
  if (mode === "roxa") {
    let bestV = Infinity;
    let pick = { line: s.line, dx: 0 };
    for (const dl of [0, -1, 1]) {
      const line = s.line + dl;
      if (line < 0 || line >= e.nLines) continue;
      const ly = e.lineY(line);
      for (const dx of [0, -1, 1]) {
        const v = danger(e, (t) => clampBox(e, s.x + dx * sp * t, s.y + (ly - s.y) * Math.min(1, t * 12)), dx !== 0 || dl !== 0) + Math.abs(dl) * 0.02 + Math.abs(dx) * 0.01;
        if (v < bestV) { bestV = v; pick = { line, dx }; }
      }
    }
    s.line = pick.line;
    if (pick.dx < 0) e.keys.add("ArrowLeft");
    if (pick.dx > 0) e.keys.add("ArrowRight");
    return;
  }
  if (mode === "azul") {
    const gd = e.gravDir;
    const vertical = gd === 0 || gd === 2;
    const sign = gd === 0 || gd === 3 ? 1 : -1;
    const b = e.box;
    const half = 8 * e.soulScale;
    const groundP = vertical ? (sign > 0 ? b.b - half : b.t + half) : sign > 0 ? b.r - half : b.l + half;
    const ceilP = vertical ? (sign > 0 ? b.t + half : b.b - half) : sign > 0 ? b.l + half : b.r - half;
    let bestV = Infinity;
    let pick = { h: 0, jump: false };
    for (const jump of [false, true]) {
      for (const h of [0, -1, 1]) {
        // simula a física da alma azul em passos curtos
        const path: { x: number; y: number }[] = [];
        let p = vertical ? s.y : s.x;
        let q = vertical ? s.x : s.y;
        let vy = s.vy;
        const step = 1 / 60;
        let tt = 0;
        const ground0 = (p - groundP) * sign >= -0.5 || e.onPlat;
        if (ground0 && jump) vy = -270;
        while (tt < 0.42) {
          if (!jump && vy < -70) vy = -70;
          vy += 720 * step;
          p += vy * sign * step;
          q += h * sp * step;
          if ((p - groundP) * sign >= 0) { p = groundP; vy = 0; }
          if ((p - ceilP) * sign <= 0) { p = ceilP; vy = Math.max(0, vy); }
          if (gd === 0 && vy >= 0) {
            for (const pl of e.platforms as any[]) {
              const top = pl.y - 3;
              const px = pl.x + pl.vx * tt;
              if (p + half >= top && p + half <= top + 8 && Math.abs(q - px) <= pl.w / 2 + half * 0.4) { p = top - half; vy = 0; }
            }
          }
          tt += step;
          path.push(vertical ? { x: q, y: p } : { x: p, y: q });
        }
        const at = (t: number) => path[Math.min(path.length - 1, Math.round(t * 60))];
        const v = danger(e, (t) => clampBox(e, at(t).x, at(t).y), h !== 0 || jump) + (jump ? 0.01 : 0) + Math.abs(h) * 0.005;
        if (v < bestV) { bestV = v; pick = { h, jump }; }
      }
    }
    const awayKey = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][gd];
    if (pick.jump) e.keys.add(awayKey);
    if (vertical) {
      if (pick.h < 0) e.keys.add("ArrowLeft");
      if (pick.h > 0) e.keys.add("ArrowRight");
    } else {
      if (pick.h < 0) e.keys.add("ArrowUp");
      if (pick.h > 0) e.keys.add("ArrowDown");
    }
    return;
  }
  // vermelha e amarela
  let bestV = Infinity;
  let bi = 0;
  DIRS.forEach(([dx, dy], i) => {
    const pos = (t: number) => clampBox(e, s.x + dx * sp * t, s.y + dy * sp * t);
    const v = danger(e, pos, i !== 0) + edgePenalty(e, pos(0.3)) + (i === lastDir ? 0 : 0.015);
    if (v < bestV) { bestV = v; bi = i; }
  });
  lastDir = bi;
  const [dx, dy] = DIRS[bi];
  if (dx < -0.1) e.keys.add("ArrowLeft");
  if (dx > 0.1) e.keys.add("ArrowRight");
  if (dy < -0.1) e.keys.add("ArrowUp");
  if (dy > 0.1) e.keys.add("ArrowDown");
  if (mode === "amarela") e.keys.add("KeyZ");
}

export interface Medida {
  preset: string;
  jogo?: string;
  fase: string;
  dur: number;
  robo: number; // acertos médios no robô
  parado: number; // acertos médios parado
}

/** Roda uma fase e conta quantas vezes a alma foi acertada (1 s de invencibilidade, sem karma). */
export function medirFase(p: PresetFile, turn: SavedTurn, seed: number, bot: boolean, reacao = 7) {
  const cfg = structuredClone(p.config);
  applyTurn(cfg, turn);
  cfg.mecanica.sons = false;
  cfg.mecanica.karma = false;
  cfg.mecanica.invencivel = 1;
  cfg.mecanica.efeitos = false;
  const cv = document.createElement("canvas");
  const e = new BattleEngine(cv, { config: cfg, seed, spectator: false, playerName: "robô", hp: 9999 }) as Eng;
  e.resize();
  e.placeSoul();
  e.startAttack();
  let hits = 0;
  let last = e.hp;
  let t = 0;
  let frame = 0;
  lastDir = 0;
  // reação humana: a decisão tomada agora só vale na próxima rodada de decisão (~0,12 s depois)
  let pending: { keys: string[]; shield: number; line: number } | null = null;
  while (e.phase === "ataque" && t < 90) {
    if (bot && frame % reacao === 0) {
      const keep = { keys: [...e.keys], shield: e.soul.shield, line: e.soul.line };
      think(e);
      const next = { keys: [...e.keys], shield: e.soul.shield, line: e.soul.line };
      const use = pending ?? keep;
      e.keys.clear();
      use.keys.forEach((k) => e.keys.add(k));
      e.soul.shield = use.shield;
      e.soul.line = use.line;
      pending = next;
    }
    e.update(1 / 60);
    if (e.hp < last) hits++;
    last = e.hp;
    t += 1 / 60;
    frame++;
  }
  e.stop();
  return { hits, dur: t };
}

/** Faixa de acertos do robô a cada 10 s, por nível da luta. */
const ALVO: Record<number, [number, number]> = { 1: [0.3, 1.2], 2: [0.7, 2.0], 3: [1.3, 2.8], 4: [1.8, 3.6] };
const PARADO_MIN: Record<number, number> = { 1: 1.2, 2: 2.0, 3: 2.5, 4: 3.0 }; // parado tem que apanhar (a cada 10 s)
const GENTIL = /mole|Cansado/; // fases que são calmas de propósito

function medirMedia(p: PresetFile, turn: SavedTurn, seeds: number[]) {
  let robo = 0;
  let parado = 0;
  let dur = 0;
  for (const sd of seeds) {
    const r = medirFase(p, turn, sd, true);
    robo += r.hits;
    dur = r.dur;
    parado += medirFase(p, turn, sd, false).hits;
  }
  const n = seeds.length;
  return { robo: robo / n, parado: parado / n, dur, taxa: ((robo / n) / dur) * 10, taxaParado: ((parado / n) / dur) * 10 };
}

/**
 * Procura, fase por fase, o multiplicador de intensidade que põe o robô dentro da faixa do nível.
 * Devolve a tabela para o AJUSTE de src/presets.ts e um relatório. Os fatores saem em cima do AJUSTE que já
 * está lá (multiplique pelos valores atuais).
 */
export async function ajustarTudo(seeds = [11, 23, 37, 53], filtro?: (p: PresetFile) => boolean) {
  const tabela: Record<string, number> = {};
  const linhas: string[] = [];
  for (const p of BUILTIN_PRESETS) {
    if (filtro && !filtro(p)) continue;
    const nivel = p.nivel ?? 1;
    p.turnos.forEach((turn, idx) => {
      const base = turn.intensidade ?? 1;
      if (GENTIL.test(turn.nome)) return;
      const final = idx === p.turnos.length - 1 && p.turnos.length > 2;
      const [lo0, hi0] = ALVO[nivel];
      const lo = final ? lo0 * 1.15 : lo0;
      const hi = final ? hi0 * 1.15 : hi0;
      // o robô é perfeito com o escudo (verde) e fraco com a gravidade (azul): nesses modos o ajuste é contido
      const modos = new Set([turn.modo ?? p.config.alma.modo, ...turn.ataques.map((x) => x.modo).filter(Boolean)]);
      const [minM, maxM] = modos.has("verde") ? [0.85, 1.15] : modos.has("azul") ? [0.8, 1.3] : [0.65, 1.8];
      const mid = (lo + hi) / 2;
      const erro = (r: ReturnType<typeof medirMedia>) =>
        (r.taxa < lo ? lo - r.taxa : r.taxa > hi ? r.taxa - hi : 0) +
        Math.max(0, PARADO_MIN[nivel] - r.taxaParado) * 0.5;
      let mult = 1;
      let m = medirMedia(p, turn, seeds);
      const antes = m;
      let melhor = { mult, m, e: erro(m) };
      for (let it = 0; it < 5 && melhor.e > 0; it++) {
        const baixo = m.taxa < lo || m.taxaParado < PARADO_MIN[nivel];
        let f = Math.pow(mid / Math.max(m.taxa, 0.2), 0.5);
        if (baixo && m.taxa >= lo) f = 1.12; // robô ok, mas parado quase não apanha: mais pressão
        f = Math.max(0.75, Math.min(1.35, f));
        const next = Math.max(minM, Math.min(maxM, mult * f));
        if (Math.abs(next - mult) < 0.02) break;
        mult = next;
        m = medirMedia(p, { ...turn, intensidade: +(base * mult).toFixed(2) }, seeds);
        const e = erro(m);
        if (e < melhor.e - 0.05) melhor = { mult, m, e };
      }
      mult = melhor.mult;
      m = melhor.m;
      if (Math.abs(mult - 1) >= 0.05) tabela[`${p.nome}|${turn.nome}`] = +mult.toFixed(2);
      linhas.push(
        `${p.nome} | ${turn.nome} | nível ${nivel}${final ? "+" : ""} | robô ${antes.taxa.toFixed(1)}→${m.taxa.toFixed(1)} | parado ${antes.taxaParado.toFixed(1)}→${m.taxaParado.toFixed(1)} | ×${mult.toFixed(2)}`,
      );
    });
    await new Promise((r) => setTimeout(r, 0));
  }
  (window as any).__ajuste = { tabela, linhas };
  return { tabela, linhas };
}

export async function medirTudo(filtro?: (p: PresetFile) => boolean, seeds = [11, 23]) {
  const out: Medida[] = [];
  for (const p of BUILTIN_PRESETS) {
    if (filtro && !filtro(p)) continue;
    for (const turn of p.turnos) {
      let robo = 0;
      let parado = 0;
      let dur = 0;
      for (const sd of seeds) {
        const r = medirFase(p, turn, sd, true);
        robo += r.hits;
        dur = r.dur;
        parado += medirFase(p, turn, sd, false).hits;
      }
      out.push({ preset: p.nome, jogo: p.jogo, fase: turn.nome, dur: +dur.toFixed(1), robo: robo / seeds.length, parado: parado / seeds.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  (window as any).__balanco = out;
  return out;
}
