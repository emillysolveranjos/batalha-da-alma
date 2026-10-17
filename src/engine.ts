// Motor da batalha: alma, ataques, colisão e desenho. Não depende do Owlbear.

import {
  AttackConfig,
  AttackType,
  BattleConfig,
  BulletKind,
  BulletShape,
  KIND_COLOR,
  SOUL_INFO,
  defaultCenario,
  SoulMode,
  mulberry32,
} from "./shared";
import { Sfx, unlockAudio } from "./audio";

export const W = 640;
export const H = 480;
const BOX_CY = 300;
const MENU_BOX = { w: 570, h: 130 };
const FONT = "VT323, monospace";

type Phase = "intro" | "fala" | "ataque" | "menu" | "sub" | "lutar" | "lutarRes" | "escolhido" | "fim" | "morto";

/** Dados do menu LUTAR / AGIR / ITEM / POUPAR (vêm da configuração do mestre). */
export interface MenuData {
  monstro: { nome: string; atk: number; def: number; descricao: string; poupavel: boolean; esquiva?: number };
  acoes: string[];
  itens: { nome: string; cura: number; restante: number }[];
  danoBase: number;
  frase: string; // texto da caixa no começo do turno
}

export interface ChoiceResult {
  escolha: "LUTAR" | "AGIR" | "ITEM" | "POUPAR";
  opcao?: string;
  precisao?: number; // 0-100
  dano?: number;
  critico?: boolean;
  esquivou?: boolean;
  cura?: number;
  escrever?: boolean; // o jogador quer descrever a ação com as próprias palavras
}

interface SubOption {
  label: string;
  color?: string;
  run: () => void;
}

const WRITE_LABEL = "✎ Outra coisa…";

interface Style {
  forma: BulletShape;
  cor: string;
  emoji: string;
  img: HTMLImageElement | null;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rw?: number; // se definido: hitbox retangular rw x rh, girada por ang
  rh?: number;
  ang: number;
  spin: number;
  face: boolean; // aponta para a direção do movimento
  kind: BulletKind;
  dano: number;
  style: Style;
  life: number;
  maxLife: number;
  warn: number; // > 0: só aviso, sem dano (lasers)
  fadeAt: number; // para lasers: some depois de ficar ativo por esse tempo
  bounce: boolean;
  ay?: number; // gravidade própria (projéteis em arco)
  look?: BeamLook; // aparência do feixe/estaca quando ativo
  cone?: { half: number; len: number }; // feixe em cone saindo de (x, y) na direção ang
  burstAt?: number; // estoura depois deste tempo de vida
  burstN?: number;
  burstSp?: number;
  burstForma?: BulletShape;
  hold?: { t: number; vx: number; vy: number }; // fica parado até t, depois sai com essa velocidade
  orbit?: { cx: number; cy: number; r: number; w: number; until: number; sp: number; track: number };
  deco?: "anel"; // só enfeite, não machuca
  warnColor?: string; // aviso em linha fina contínua dessa cor
  cor?: string; // cor própria (ex.: lança amarela)
  flip?: { cx: number; cy: number; done: boolean }; // lança que dá a volta
  warnRed?: boolean; // aviso em linha vermelha contínua
  pivot?: { x: number; y: number; len: number }; // feixe preso a um ponto, girando
  burstY?: number;
  beam?: boolean;
  dead?: boolean;
}

type BeamLook = "feixe" | "osso" | "espinhos" | "corte" | "cristal";

interface Cannon {
  x: number;
  y: number;
  sx: number; // de onde entra
  sy: number;
  tx: number; // onde para
  ty: number;
  ang: number;
  fixedAng?: number; // mira fixa (senão acompanha a alma)
  t: number;
  enter: number;
  charge: number;
  fire: number;
  width: number;
  fired: boolean;
  run: Running;
  size: number;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  vx: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Running {
  cfg: AttackConfig;
  t: number;
  timers: Record<string, number>;
  rng: () => number;
  style: Style;
  data: Record<string, number>;
}

interface PlanItem {
  cfg: AttackConfig;
  start: number;
  end: number;
  idx: number;
}

export interface OtherSoul {
  x: number;
  y: number;
  name: string;
  color: string;
  dead: boolean;
  seen: number;
}

export interface EngineOptions {
  config: BattleConfig;
  seed: number;
  spectator: boolean;
  playerName: string;
  hp: number;
  onHp?: (hp: number) => void;
  onDeath?: () => void;
  onChoice?: (choice: ChoiceResult) => void;
  onFight?: (dano: number, critico: boolean, errou: boolean, esquivou: boolean) => void; // animação no monstro
  menu?: MenuData;
  waitText?: string; // linha mostrada depois da escolha (padrão: aguardando o mestre)
  onSoul?: (x: number, y: number, dead: boolean) => void;
  onSpeech?: (text: string) => void;
  onConfirmIdle?: () => void; // confirmar enquanto espera o mestre (ex.: enviar a nota com o controle)
  onGesture?: () => void; // qualquer tecla/clique/botão: usado para destravar o áudio
  onArena?: (on: boolean) => void; // arena sem caixa: esconder o monstro
}

const imageCache = new Map<string, HTMLImageElement>();
export function loadImage(url: string): HTMLImageElement | null {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imageCache.set(url, img);
  }
  return img;
}

// ---------- coração em pixel ----------
const HEART = [
  ".XXX...XXX.",
  "XXXXX.XXXXX",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  ".XXXXXXXXX.",
  "..XXXXXXX..",
  "...XXXXX...",
  "....XXX....",
  ".....X.....",
];
const heartCache = new Map<string, HTMLCanvasElement>();
function heartSprite(color: string): HTMLCanvasElement {
  let c = heartCache.get(color);
  if (!c) {
    c = document.createElement("canvas");
    c.width = 11;
    c.height = 10;
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    HEART.forEach((row, y) =>
      [...row].forEach((ch, x) => ch === "X" && g.fillRect(x, y, 1, 1)),
    );
    heartCache.set(color, c);
  }
  return c;
}

const emojiCache = new Map<string, HTMLCanvasElement>();
function emojiSprite(emoji: string, color: string, px: number): HTMLCanvasElement {
  const size = Math.max(6, Math.round(px));
  const key = `${emoji}|${color}|${size}`;
  let c = emojiCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = Math.ceil(size * 1.4);
    const g = c.getContext("2d")!;
    g.font = `${size}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(emoji, c.width / 2, c.height / 2);
    if (emojiCache.size > 300) emojiCache.clear();
    emojiCache.set(key, c);
  }
  return c;
}

// ---------- padrões de ataque ----------
type Pattern = (a: Running, dt: number, g: BattleEngine) => void;

function every(a: Running, key: string, interval: number, dt: number, fn: () => void) {
  interval = Math.max(0.03, interval);
  a.timers[key] = (a.timers[key] ?? interval * 0.6) + dt;
  while (a.timers[key] >= interval) {
    a.timers[key] -= interval;
    fn();
  }
}

const PATTERNS: Record<string, Pattern> & Partial<Record<AttackType, Pattern>> = {
  chuva(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.22 / D, dt, () => {
      g.spawn(a, {
        x: b.l + a.rng() * b.w,
        y: b.t - 12,
        vx: (a.rng() - 0.5) * 20,
        vy: (90 + a.rng() * 60) * S,
        r: 6 * Z,
      });
    });
  },

  lateral(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.95 / D, dt, () => {
      const side = (a.data.side = ((a.data.side ?? 0) + 1) % 2);
      const gap = 40 * g.soulScale + 8 * Z;
      const gy = b.t + gap / 2 + a.rng() * (b.h - gap);
      const step = 15 * Z;
      for (let y = b.t + step / 2; y < b.b; y += step) {
        if (Math.abs(y - gy) < gap / 2) continue;
        g.spawn(a, {
          x: side ? b.l - 10 : b.r + 10,
          y,
          vx: (side ? 130 : -130) * S,
          vy: 0,
          r: 6 * Z,
        });
      }
    });
  },

  ossos(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.8 / D, dt, () => {
      const fromLeft = a.rng() < 0.35;
      const vx = (fromLeft ? 150 : -150) * S;
      const x = fromLeft ? b.l - 10 : b.r + 10;
      const bw = 10 * Z;
      if (g.mode === "azul") {
        // ossos baixos para pular por cima (e às vezes um no teto)
        const h = 18 + a.rng() * 34;
        g.spawnRect(a, x, b.b - h / 2, bw, h, vx, 0);
        if (a.rng() < 0.3) {
          const h2 = b.h - h - 60;
          if (h2 > 8) g.spawnRect(a, x, b.t + h2 / 2, bw, h2, vx, 0);
        }
      } else {
        const gap = 44 * g.soulScale;
        const gy = b.t + gap / 2 + 6 + a.rng() * (b.h - gap - 12);
        const top = gy - gap / 2 - b.t;
        const bot = b.b - (gy + gap / 2);
        if (top > 2) g.spawnRect(a, x, b.t + top / 2, bw, top, vx, 0);
        if (bot > 2) g.spawnRect(a, x, b.b - bot / 2, bw, bot, vx, 0);
      }
    });
  },

  anel(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.7 / D, dt, () => {
      const n = 18;
      const holeAt = Math.floor(a.rng() * n);
      const R = 170;
      const sp = 75 * S;
      const cx = g.soul.x;
      const cy = g.soul.y;
      for (let i = 0; i < n; i++) {
        if ((i - holeAt + n) % n < 3) continue;
        const ang = (i / n) * Math.PI * 2;
        g.spawn(a, {
          x: cx + Math.cos(ang) * R,
          y: cy + Math.sin(ang) * R,
          vx: -Math.cos(ang) * sp,
          vy: -Math.sin(ang) * sp,
          r: 6 * Z,
          maxLife: (2 * R) / sp,
        });
      }
    });
  },

  espiral(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.11 / D, dt, () => {
      const arms = 3;
      const base = a.t * 1.5 * S;
      for (let k = 0; k < arms; k++) {
        const ang = base + (k * Math.PI * 2) / arms;
        g.spawn(a, {
          x: b.cx,
          y: b.cy,
          vx: Math.cos(ang) * 85 * S,
          vy: Math.sin(ang) * 85 * S,
          r: 5 * Z,
        });
      }
    });
  },

  mirado(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.6 / D, dt, () => {
      const p = perimeterPoint(b, a.rng(), 14);
      const dx = g.soul.x - p.x;
      const dy = g.soul.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      g.spawn(a, { x: p.x, y: p.y, vx: (dx / d) * 160 * S, vy: (dy / d) * 160 * S, r: 6 * Z, face: true });
    });
  },

  laser(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 1.5 / D, dt, () => {
      const vertical = a.rng() < 0.5;
      const aimed = a.rng() < 0.6;
      const width = 20 * Z;
      const len = Math.max(b.w, b.h) + 80;
      const warn = 0.85 / Math.sqrt(S);
      if (vertical) {
        const x = aimed ? g.soul.x : b.l + a.rng() * b.w;
        g.spawnBeam(a, x, b.cy, width, len, warn);
      } else {
        const y = aimed ? g.soul.y : b.t + a.rng() * b.h;
        g.spawnBeam(a, b.cx, y, len, width, warn);
      }
    });
  },

  ricochete(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    const launch = () => {
      const ang = a.rng() * Math.PI * 2;
      g.spawn(a, {
        x: b.l + 10 + a.rng() * (b.w - 20),
        y: b.t + 10,
        vx: Math.cos(ang) * 110 * S,
        vy: Math.abs(Math.sin(ang)) * 110 * S + 20,
        r: 7 * Z,
        bounce: true,
        maxLife: a.cfg.duracao - a.t,
      });
    };
    if (!a.data.init) {
      a.data.init = 1;
      for (let i = 0; i < 2 + Math.round(2 * D); i++) launch();
    }
    every(a, "s", 2.5 / D, dt, launch);
  },

  tunel(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    const vy = 100 * S;
    const rowH = 10;
    every(a, "s", rowH / vy, dt, () => {
      const gap = Math.max(30 * g.soulScale, 75 - 14 * (D - 1)) * Math.max(1, g.soulScale);
      const gx = b.cx + Math.sin(a.t * 1.3 * S) * (b.w / 2 - gap / 2 - 4);
      const lw = gx - gap / 2 - (b.l - 4);
      const rw = b.r + 4 - (gx + gap / 2);
      if (lw > 1) g.spawnRect(a, b.l - 4 + lw / 2, b.t - rowH, lw, rowH + 1, 0, vy, true);
      if (rw > 1) g.spawnRect(a, b.r + 4 - rw / 2, b.t - rowH, rw, rowH + 1, 0, vy, true);
    });
    void Z;
  },

  explosao(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.9 / D, dt, () => {
      g.spawn(a, {
        x: b.l + 15 + a.rng() * (b.w - 30),
        y: b.t - 12,
        vx: 0,
        vy: 110 * S,
        r: 9 * Z,
        burstY: b.t + 25 + a.rng() * Math.max(10, b.h - 60),
      });
    });
  },

  flechas(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.7 / D, dt, () => {
      const dir = Math.floor(a.rng() * 4);
      const dist = g.mode === "verde" ? 210 : Math.max(b.w, b.h) / 2 + 20;
      const dx = [0, 1, 0, -1][dir];
      const dy = [-1, 0, 1, 0][dir];
      g.spawn(a, {
        x: b.cx + dx * dist,
        y: b.cy + dy * dist,
        vx: -dx * 120 * S,
        vy: -dy * 120 * S,
        r: 6 * Z,
        face: true,
        maxLife: (dist * 2) / (120 * S),
      });
    });
  },
};

let intensity = 1;
const CHOREO: Record<
  "cerco" | "cruz" | "ponteiro" | "cortina" | "grade" | "plataformas" | "giratorio" | "corte" | "deriva" | "lancas" | "vortice",
  Pattern
> = {
  cerco(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 3.2 / D, dt, () => {
      const b = g.box;
      const n = 5 + Math.round(D * 2);
      const R = Math.max(b.w, b.h) / 2 + 75;
      const base = a.rng() * Math.PI * 2;
      const dirSpin = a.rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const ang = base + dirSpin * (i / n) * Math.PI * 2;
        g.spawnCannon(a, {
          tx: b.cx + Math.cos(ang) * R,
          ty: b.cy + Math.sin(ang) * R,
          enter: 0.3 + i * 0.05,
          charge: (0.7 + i * 0.16) / Math.sqrt(S),
          width: 24 * Z,
        });
      }
    });
  },

  cruz(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.6 / D, dt, () => {
      const b = g.box;
      const s = g.soul;
      const c = 0.8 / Math.sqrt(S);
      const diag = (a.data.n = (a.data.n ?? 0) + 1) % 2 === 0;
      if (!diag) {
        g.spawnCannon(a, { tx: s.x, ty: b.t - 55, fixedAng: Math.PI / 2, charge: c, width: 22 * Z });
        g.spawnCannon(a, { tx: b.l - 55, ty: s.y, fixedAng: 0, charge: c + 0.12, width: 22 * Z });
      } else {
        g.spawnCannon(a, { tx: b.l - 45, ty: b.t - 45, charge: c, width: 22 * Z });
        g.spawnCannon(a, { tx: b.r + 45, ty: b.t - 45, charge: c + 0.12, width: 22 * Z });
        if (D > 1.2) g.spawnCannon(a, { tx: b.cx, ty: b.b + 60, charge: c + 0.24, width: 22 * Z });
      }
    });
  },

  ponteiro(a, _dt, g) {
    const { S, D, Z } = params(a);
    if (a.data.init) return;
    a.data.init = 1;
    const b = g.box;
    const n = D >= 1.5 ? 3 : D >= 1.1 ? 2 : 1;
    const len = Math.hypot(b.w, b.h);
    const spin = 1.05 * S * (a.rng() < 0.5 ? 1 : -1);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      g.spawn(a, {
        x: b.cx + Math.cos(ang) * (len / 2),
        y: b.cy + Math.sin(ang) * (len / 2),
        vx: 0,
        vy: 0,
        r: len / 2,
        rw: len,
        rh: 14 * Z,
        ang,
        spin,
        warn: 0.9,
        fadeAt: Math.max(1, a.cfg.duracao - a.t - 0.2),
        maxLife: a.cfg.duracao - a.t + 0.2,
        beam: true,
        look: "feixe",
        pivot: { x: b.cx, y: b.cy, len },
      });
    }
  },

  cortina(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.7 / D, dt, () => {
      const b = g.box;
      const left = (a.data.n = (a.data.n ?? 0) + 1) % 2 === 1;
      const kind = a.cfg.tipoDano === "branco" ? "azul" : a.cfg.tipoDano;
      const n = 6 + Math.round(D * 2);
      for (let i = 0; i < n; i++) {
        g.spawn(a, {
          x: left ? b.l - 10 - i * 11 * Z : b.r + 10 + i * 11 * Z,
          y: b.cy,
          vx: (left ? 1 : -1) * 175 * S,
          vy: 0,
          r: b.h / 2,
          rw: 7 * Z,
          rh: b.h + 20,
          ang: 0,
          kind,
        });
      }
    });
  },

  grade(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.3 / D, dt, () => {
      const b = g.box;
      const cols = clamp(Math.round(b.w / 34), 4, 10);
      const off = a.rng() * (b.w / cols);
      const gap = 46 * g.soulScale;
      const warn = 0.5 / Math.sqrt(S);
      for (let i = 0; i < cols; i++) {
        const x = b.l + off + (i * b.w) / cols;
        if (x > b.r - 4) continue;
        const gy = b.t + gap / 2 + 4 + a.rng() * (b.h - gap - 8);
        const top = gy - gap / 2 - b.t;
        const bot = b.b - (gy + gap / 2);
        if (top > 4) g.spawnBeam(a, x, b.t + top / 2, 10 * Z, top, warn, 0, "osso", 0.65);
        if (bot > 4) g.spawnBeam(a, x, b.b - bot / 2, 10 * Z, bot, warn, 0, "osso", 0.65);
      }
    });
  },

  plataformas(a, dt, g) {
    const { S, D } = params(a);
    const b = g.box;
    if (!a.data.init) {
      a.data.init = 1;
      g.modeOverride = "azul";
      g.gravDir = 0;
      // chão de espinhos (depois de um aviso) até o fim do ataque
      g.spawnBeam(a, b.cx, b.b - 8, b.w + 8, 16, 1.1, 0, "espinhos", Math.max(1, a.cfg.duracao - a.t - 1.3));
      const py = b.t + b.h * 0.72;
      g.platforms.push({ x: g.soul.x, y: py, w: 64, vx: 0 });
      // a alma começa em cima da primeira plataforma
      g.soul.y = py - 3 - 8 * g.soulScale;
      g.soul.vy = 0;
      g.onPlat = true;
    }
    every(a, "s", 1.25 / D, dt, () => {
      const left = a.rng() < 0.5;
      const y = b.t + b.h * (a.rng() < 0.5 ? 0.5 : 0.72);
      g.platforms.push({ x: left ? b.l - 40 : b.r + 40, y, w: 56, vx: (left ? 1 : -1) * 55 * S });
    });
  },

  giratorio(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.55 / D, dt, () => {
      const b = g.box;
      const p = perimeterPoint(b, a.rng(), 40);
      const tx = g.soul.x + (a.rng() - 0.5) * 50;
      const ty = g.soul.y + (a.rng() - 0.5) * 50;
      const d = Math.hypot(tx - p.x, ty - p.y) || 1;
      g.spawn(a, {
        x: p.x,
        y: p.y,
        vx: ((tx - p.x) / d) * 150 * S,
        vy: ((ty - p.y) / d) * 150 * S,
        r: 20 * Z,
        rw: 9 * Z,
        rh: 40 * Z,
        ang: a.rng() * Math.PI,
        spin: (a.rng() < 0.5 ? -1 : 1) * (5 + a.rng() * 3),
        maxLife: 6,
      });
    });
  },

  corte(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.42 / D, dt, () => {
      const ang = a.rng() * Math.PI;
      const x = g.soul.x + (a.rng() - 0.5) * 60;
      const y = g.soul.y + (a.rng() - 0.5) * 60;
      const bm = g.spawnBeam(a, x, y, 900, 7 * Z, 0.55 / Math.sqrt(S), ang, "corte", 0.12);
      bm.warnRed = true;
    });
  },

  lancas(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.62 / D, dt, () => {
      const b = g.box;
      const dir = Math.floor(a.rng() * 4);
      const dist = g.mode === "verde" ? 230 : Math.max(b.w, b.h) / 2 + 30;
      const dx = [0, 1, 0, -1][dir];
      const dy = [-1, 0, 1, 0][dir];
      const yellow = a.rng() < 0.3;
      const sp = 135 * S;
      g.spawn(a, {
        x: b.cx + dx * dist,
        y: b.cy + dy * dist,
        vx: -dx * sp,
        vy: -dy * sp,
        r: 6 * Z,
        face: true,
        maxLife: (dist * 3) / sp,
        cor: yellow ? "#ffe14a" : undefined,
        flip: yellow ? { cx: b.cx, cy: b.cy, done: false } : undefined,
      });
    });
  },

  vortice(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    g.pull = { x: b.cx, y: b.cy, f: 50 * S, t: 0.2 };
    every(a, "s", 0.13 / D, dt, () => {
      for (let k = 0; k < 2; k++) {
        const th = a.t * 1.8 + k * Math.PI;
        const R = 230;
        const inward = 75 * S;
        const tang = 95 * S;
        g.spawn(a, {
          x: b.cx + Math.cos(th) * R,
          y: b.cy + Math.sin(th) * R,
          vx: -Math.cos(th) * inward - Math.sin(th) * tang,
          vy: -Math.sin(th) * inward + Math.cos(th) * tang,
          r: 6 * Z,
          maxLife: 4.5 / S,
        });
      }
    });
  },

  deriva(a, dt, g) {
    const { D } = params(a);
    every(a, "s", 1.6 / D, dt, () => {
      const maxX = Math.max(0, (600 - g.boxW) / 2 - 10);
      const minY = 212 - (BOX_CY - g.boxH / 2);
      const maxY = 388 - (BOX_CY + g.boxH / 2);
      g.boxOffTarget = { x: (a.rng() * 2 - 1) * maxX, y: minY + a.rng() * Math.max(0, maxY - minY) };
    });
  },
};

/** Padrões inspirados no fangame "Kaizo Knight" (feitos do zero, sem nada do jogo). */
const KAIZO: Record<string, Pattern> = {
  crescente(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.85 / D, dt, () => {
      const b = g.box;
      const fromRight = (a.data.n = (a.data.n ?? 0) + 1) % 3 !== 0;
      const gap = 46 * g.soulScale;
      const gy = b.t + gap / 2 + a.rng() * Math.max(1, b.h - gap);
      // a lua cobre a altura da caixa menos o vão (duas metades)
      const top = gy - gap / 2 - b.t;
      const bot = b.b - (gy + gap / 2);
      const x = fromRight ? b.r + 40 : b.l - 40;
      const vx = (fromRight ? -1 : 1) * 240 * S;
      if (top > 6) g.spawn(a, { x, y: b.t + top / 2, vx, vy: 0, r: top / 2, rw: 16 * Z, rh: top, ang: fromRight ? 0 : Math.PI });
      if (bot > 6) g.spawn(a, { x, y: b.b - bot / 2, vx, vy: 0, r: bot / 2, rw: 16 * Z, rh: bot, ang: fromRight ? 0 : Math.PI });
    });
  },

  estocada(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.25 / D, dt, () => {
      const y = g.soul.y + (a.rng() - 0.5) * 10;
      const bm = g.spawnBeam(a, W / 2, y, W + 200, 30 * Z, 0.7 / Math.sqrt(S), 0, "feixe", 0.35);
      bm.warnColor = "#ffffff";
    });
  },

  rabisco(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.0 / D, dt, () => {
      const b = g.box;
      const left = a.rng() < 0.5;
      const gap = 44 * g.soulScale;
      const gy = b.t + gap / 2 + a.rng() * Math.max(1, b.h - gap);
      const top = gy - gap / 2 - b.t;
      const bot = b.b - (gy + gap / 2);
      const x = left ? b.l - 12 : b.r + 12;
      const vx = (left ? 1 : -1) * 120 * S;
      if (top > 4) g.spawnRect(a, x, b.t + top / 2, 14 * Z, top, vx, 0);
      if (bot > 4) g.spawnRect(a, x, b.b - bot / 2, 14 * Z, bot, vx, 0);
    });
  },

  nevasca(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.09 / D, dt, () => {
      g.spawn(a, { x: b.l - 40 + a.rng() * (b.w + 80), y: b.t - 10, vx: 25 + a.rng() * 20, vy: (60 + a.rng() * 60) * S, r: 4.5 * Z, spin: 2, maxLife: 8 });
    });
    every(a, "c", 1.7 / D, dt, () => {
      const x = clamp(g.soul.x + (a.rng() - 0.5) * 40, b.l + 10, b.r - 10);
      const h = b.h * (0.5 + a.rng() * 0.3);
      g.spawnBeam(a, x, b.b - h / 2, 22 * Z, h, 0.7 / Math.sqrt(S), 0, "cristal", 0.55);
    });
  },

  xazul(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.3 / D, dt, () => {
      const b = g.box;
      const d = Math.atan2(b.h, b.w);
      const len = Math.hypot(b.w, b.h) + 160;
      for (const ang of [d, -d]) {
        const bm = g.spawnBeam(a, b.cx, b.cy, len, 22 * Z, 0.6 / Math.sqrt(S), ang, "feixe", 0.8);
        bm.kind = "azul";
      }
      // corte branco que chega quando o azul some
      const vert = a.rng() < 0.5;
      const bm = g.spawnBeam(a, vert ? g.soul.x : b.cx, vert ? b.cy : g.soul.y, len, 16 * Z, 1.5 / Math.sqrt(S), vert ? Math.PI / 2 : 0, "corte", 0.15);
      bm.warnRed = true;
    });
  },

  espada(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.0 / D, dt, () => {
      const b = g.box;
      const x = g.soul.x;
      const hold = 0.55 / Math.sqrt(S);
      const w = g.spawnBeam(a, x, b.cy, 3, b.h + 120, hold, 0, "corte", 0.001);
      w.warnColor = "#ffffff";
      g.spawn(a, { x, y: b.t - 55, vx: 0, vy: 0, r: 45 * Z, rw: 14 * Z, rh: 95 * Z, ang: 0, hold: { t: hold, vx: 0, vy: 560 * S } });
    });
  },

  pinos(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.5 / D, dt, () => {
      const b = g.box;
      const side = Math.floor(a.rng() * 4);
      const n = 5 + Math.round(D);
      const holdT = 0.75 / Math.sqrt(S);
      const sp = 260 * S;
      const skip = Math.floor(a.rng() * n);
      for (let i = 0; i < n; i++) {
        if (i === skip) continue;
        const f = (i + 0.5) / n;
        const p =
          side === 0 ? { x: b.l + f * b.w, y: b.t + 6, vx: 0, vy: sp }
          : side === 1 ? { x: b.r - 6, y: b.t + f * b.h, vx: -sp, vy: 0 }
          : side === 2 ? { x: b.l + f * b.w, y: b.b - 6, vx: 0, vy: -sp }
          : { x: b.l + 6, y: b.t + f * b.h, vx: sp, vy: 0 };
        g.spawn(a, { x: p.x, y: p.y, vx: 0, vy: 0, r: 6 * Z, face: false, ang: Math.atan2(p.vy, p.vx), hold: { t: holdT, vx: p.vx, vy: p.vy } });
      }
    });
  },

  estrelaazul(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.5 / D, dt, () => {
      const b = g.box;
      const n = 5;
      const base = a.rng() * Math.PI;
      const len = Math.hypot(b.w, b.h) + 200;
      for (let i = 0; i < n; i++) {
        const blue = g.spawnBeam(a, b.cx, b.cy, len, 14 * Z, 0.5 / Math.sqrt(S), base + (i * Math.PI) / n, "feixe", 0.55);
        blue.kind = "azul";
        const white = g.spawnBeam(a, b.cx, b.cy, len, 12 * Z, 1.15 / Math.sqrt(S), base + ((i + 0.5) * Math.PI) / n, "feixe", 0.3);
        white.warnColor = "#ffffff";
      }
    });
  },

  cone(a, dt, g) {
    const { S, D } = params(a);
    every(a, "s", 1.9 / D, dt, () => {
      const b = g.box;
      const right = a.rng() < 0.5;
      const ox = right ? b.r + 140 : b.l - 140;
      const oy = g.soul.y + (a.rng() - 0.5) * 30;
      const ang = Math.atan2(g.soul.y - oy, g.soul.x - ox);
      g.spawn(a, {
        x: ox, y: oy, vx: 0, vy: 0, r: 1, ang,
        cone: { half: 0.24, len: 900 },
        beam: true, look: "feixe",
        warn: 0.8 / Math.sqrt(S), fadeAt: 0.8 / Math.sqrt(S) + 0.45, maxLife: 0.8 / Math.sqrt(S) + 0.7,
      });
    });
  },

  estilhacos(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.2 / D, dt, () => {
      const b = g.box;
      const cx = b.l - 30 + a.rng() * (b.w + 60);
      const cy = b.t - 30 + a.rng() * (b.h + 60);
      const n = 10;
      const off = a.rng() * Math.PI;
      for (let i = 0; i < n; i++) {
        const ang = off + (i / n) * Math.PI * 2;
        g.spawn(a, { x: cx, y: cy, vx: Math.cos(ang) * 130 * S, vy: Math.sin(ang) * 130 * S, r: 6 * Z, face: true, maxLife: 5 });
      }
    });
  },

  bolhas(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.1 / D, dt, () => {
      const b = g.box;
      const n = clamp(Math.round(b.w / 60), 2, 6);
      for (let i = 0; i < n; i++) {
        g.spawn(a, {
          x: b.l + ((i + 0.5) * b.w) / n, y: b.t + 26, vx: 0, vy: 0, r: 13 * Z,
          burstAt: 0.9 / Math.sqrt(S), burstN: 10, burstSp: 115 * S, burstForma: "gota", maxLife: 3,
        });
      }
    });
  },

  muralha(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 2.4 / D, dt, () => {
      const left = (a.data.n = (a.data.n ?? 0) + 1) % 2 === 1;
      const step = 13 * Z;
      const slots = Math.floor(b.h / step);
      const hole = Math.floor(a.rng() * Math.max(1, slots - 3)) + 1;
      for (let i = 0; i < slots; i++) {
        if (i >= hole && i < hole + 3) continue;
        g.spawn(a, { x: left ? b.l - 30 : b.r + 30, y: b.t + step / 2 + i * step, vx: (left ? 1 : -1) * 95 * S, vy: 0, r: 20, rw: 42 * Z, rh: 6 * Z, ang: left ? 0 : Math.PI });
      }
    });
    every(a, "d", 0.7 / D, dt, () => {
      const y = g.soul.y;
      const hold = 0.45 / Math.sqrt(S);
      const w = g.spawnBeam(a, W / 2, y, W + 100, 2, hold, 0, "corte", 0.001);
      w.warnColor = "#3b6bff";
      g.spawn(a, { x: b.r + 30, y, vx: 0, vy: 0, r: 16 * Z, rw: 34 * Z, rh: 6 * Z, ang: Math.PI, hold: { t: hold, vx: -420 * S, vy: 0 } });
    });
  },

  guilhotina(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.45 / D, dt, () => {
      const b = g.box;
      const cols = clamp(Math.round(b.w / 30), 4, 12);
      const holdT = 0.65 / Math.sqrt(S);
      const free = Math.floor(a.rng() * cols);
      for (let i = 0; i < cols; i++) {
        if (Math.abs(i - free) <= 0) continue;
        if (a.rng() < 0.25) continue;
        g.spawn(a, { x: b.l + ((i + 0.5) * b.w) / cols, y: b.t + 24, vx: 0, vy: 0, r: 22, rw: 8 * Z, rh: 44 * Z, ang: 0, hold: { t: holdT, vx: 0, vy: 430 * S } });
      }
    });
  },

  teia(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.8 / D, dt, () => {
      const b = g.box;
      const ang = 0.55 + a.rng() * 0.35;
      const n = 3 + Math.round(D);
      const span = Math.hypot(b.w, b.h);
      const off = a.rng();
      for (const sgn of [1, -1]) {
        for (let i = 0; i < n; i++) {
          const t = ((i + off) / n - 0.5) * span;
          const nx = -Math.sin(sgn * ang);
          const ny = Math.cos(sgn * ang);
          const bm = g.spawnBeam(a, b.cx + nx * t, b.cy + ny * t, span + 300, 7 * Z, 0.75 / Math.sqrt(S), sgn * ang, "corte", 0.14);
          bm.warnRed = true;
        }
      }
    });
  },

  mira(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 1.45 / D, dt, () => {
      const x = g.soul.x;
      const y = g.soul.y;
      const w = 0.75 / Math.sqrt(S);
      for (const ang of [0, Math.PI / 2]) {
        const bm = g.spawnBeam(a, x, y, 900, 18 * Z, w, ang, "feixe", 0.3);
        bm.warnColor = "#ff3040";
      }
      g.spawn(a, { x, y, vx: 0, vy: 0, r: 18, deco: "anel", maxLife: w });
    });
  },

  orbita(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.4 / D, dt, () => {
      const n = 6 + Math.round(D * 2);
      const R = 85;
      const base = a.rng() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const th = base + (i / n) * Math.PI * 2;
        g.spawn(a, {
          x: g.soul.x + Math.cos(th) * R, y: g.soul.y + Math.sin(th) * R, vx: 0, vy: 0,
          r: 16, rw: 32 * Z, rh: 7 * Z, ang: th + Math.PI,
          orbit: { cx: g.soul.x, cy: g.soul.y, r: R, w: 2.2 * S * (a.rng() < 0.5 ? 1 : -1), until: 1.2 / Math.sqrt(S), sp: 300 * S, track: 0.85 / Math.sqrt(S) },
          maxLife: 4,
        });
      }
    });
  },

  visaodupla(_a, _dt, g) {
    g.doubleT = 0.2;
  },

  arena(_a, _dt, g) {
    g.arenaT = 0.2;
  },

  galaxia(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.3 / D, dt, () => {
      const b = g.box;
      const arms = 5;
      const base = a.t * 0.75 * S;
      for (let k = 0; k < arms; k++) {
        const ang = base + (k * Math.PI * 2) / arms;
        g.spawn(a, { x: b.cx, y: b.cy, vx: Math.cos(ang) * 85 * S, vy: Math.sin(ang) * 85 * S, r: 10 * Z, spin: 2.5, maxLife: 9 });
      }
    });
  },

  constelacao(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 0.95 / D, dt, () => {
      const b = g.box;
      const step = 70;
      const off = (a.data.n = (a.data.n ?? 0) + 1) % 2 ? 0 : step / 2;
      const skip = Math.floor(a.rng() * (b.w / step));
      let i = 0;
      for (let x = b.l + off + 10; x < b.r; x += step, i++) {
        if (i === skip) continue;
        g.spawn(a, { x, y: b.t - 15, vx: 0, vy: 75 * S, r: 11 * Z, spin: 2, maxLife: 12 });
      }
    });
  },
};

const EXTRA: Record<"canhao" | "arco" | "estacas" | "varredura" | "fios" | "pancada", Pattern> = {
  pancada(a, dt, g) {
    const { S, D, Z } = params(a);
    every(a, "s", 2.4 / D, dt, () => {
      const dir = Math.floor(a.rng() * 4);
      g.slam(dir);
      const b = g.box;
      const th = 22 * Z;
      const warn = 0.6 / Math.sqrt(S);
      if (dir === 0) g.spawnBeam(a, b.cx, b.b - th / 2, b.w + 8, th, warn, 0, "espinhos");
      if (dir === 2) g.spawnBeam(a, b.cx, b.t + th / 2, b.w + 8, th, warn, 0, "espinhos");
      if (dir === 1) g.spawnBeam(a, b.l + th / 2, b.cy, th, b.h + 8, warn, 0, "espinhos");
      if (dir === 3) g.spawnBeam(a, b.r - th / 2, b.cy, th, b.h + 8, warn, 0, "espinhos");
    });
  },

  canhao(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 1.5 / D, dt, () => {
      const o = perimeterPoint(b, a.rng(), 60);
      g.spawnCannon(a, { tx: o.x, ty: o.y, charge: 0.8 / Math.sqrt(S), width: 26 * Z });
    });
  },

  arco(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.45 / D, dt, () => {
      const left = a.rng() < 0.5;
      g.spawn(a, {
        x: left ? b.l - 10 : b.r + 10,
        y: b.b - 10 - a.rng() * b.h * 0.3,
        vx: (left ? 1 : -1) * (60 + a.rng() * 90) * S,
        vy: -(190 + a.rng() * 110) * S,
        ay: 330 * S * S,
        r: 6 * Z,
        maxLife: 8,
      });
    });
  },

  estacas(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.85 / D, dt, () => {
      const x = a.rng() < 0.6 ? g.soul.x : b.l + a.rng() * b.w;
      const h = b.h * (0.45 + a.rng() * 0.25);
      const top = a.rng() < 0.25;
      g.spawnBeam(a, x, top ? b.t + h / 2 : b.b - h / 2, 14 * Z, h, 0.6 / Math.sqrt(S), 0, "osso");
    });
  },

  varredura(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 1.3 / D, dt, () => {
      const left = a.rng() < 0.5;
      const n = (a.data.n = (a.data.n ?? 0) + 1);
      const kind = a.cfg.tipoDano === "branco" ? (n % 2 ? "azul" : "laranja") : a.cfg.tipoDano;
      g.spawn(a, {
        x: left ? b.l - 10 : b.r + 10,
        y: b.cy,
        vx: (left ? 1 : -1) * 150 * S,
        vy: 0,
        r: b.h / 2,
        rw: 12 * Z,
        rh: b.h + 20,
        ang: 0,
        kind,
      });
    });
  },

  fios(a, dt, g) {
    const { S, D, Z } = params(a);
    const b = g.box;
    every(a, "s", 0.5 / D, dt, () => {
      const i = Math.floor(a.rng() * 3);
      const left = a.rng() < 0.5;
      g.spawn(a, { x: left ? b.l - 10 : b.r + 10, y: g.lineY(i), vx: (left ? 1 : -1) * 120 * S, vy: 0, r: 7 * Z });
    });
  },
};
Object.assign(PATTERNS, EXTRA, CHOREO, KAIZO);

function params(a: Running) {
  return {
    S: Math.max(0.1, a.cfg.velocidade * intensity),
    D: Math.max(0.1, a.cfg.densidade * intensity),
    Z: Math.max(0.2, a.cfg.tamanho),
  };
}

function perimeterPoint(b: BoxRect, u: number, pad: number) {
  const pw = b.w + pad * 2;
  const ph = b.h + pad * 2;
  let d = u * (pw * 2 + ph * 2);
  const l = b.l - pad;
  const t = b.t - pad;
  if (d < pw) return { x: l + d, y: t };
  d -= pw;
  if (d < ph) return { x: l + pw, y: t + d };
  d -= ph;
  if (d < pw) return { x: l + pw - d, y: t + ph };
  d -= pw;
  return { x: l, y: t + ph - d };
}

interface BoxRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  l: number;
  r: number;
  t: number;
  b: number;
}

function rect(cx: number, cy: number, w: number, h: number): BoxRect {
  return { cx, cy, w, h, l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
}

// ---------- motor ----------
export class BattleEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cfg: BattleConfig;
  opt: EngineOptions;
  sfx: Sfx;

  phase: Phase = "intro";
  phaseT = 0;
  attackT = 0;
  plan: PlanItem[] = [];
  running = new Map<number, Running>();
  totalAttack = 0;

  boxW = MENU_BOX.w;
  boxH = MENU_BOX.h;
  box: BoxRect = rect(W / 2, BOX_CY, MENU_BOX.w, MENU_BOX.h);

  bullets: Bullet[] = [];
  cannons: Cannon[] = [];
  platforms: Platform[] = [];
  onPlat = false;
  flash = 0; // clarão branco na tela
  chroma = 0; // aberração cromática temporária
  lastFilter = "";
  boxOff = { x: 0, y: 0 };
  pull: { x: number; y: number; f: number; t: number } | null = null;
  doubleT = 0; // visão dupla ativa
  arenaT = 0; // arena sem caixa ativa
  arenaOn = false;
  shots: { x: number; y: number }[] = [];
  shotCd = 0;
  kr = 0; // karma acumulado
  krT = 0;
  sceneT = 0;
  motes: { x: number; y: number; v: number; s: number; p: number }[] = [];
  boxOffTarget = { x: 0, y: 0 };
  soul = { x: W / 2, y: BOX_CY, vx: 0, vy: 0, moving: false, line: 1, shield: 0 };
  hp: number;
  invuln = 0;
  shake = 0;
  deadT = 0;
  others = new Map<string, OtherSoul>();

  keys = new Set<string>();
  padKeys = new Set<string>();
  pointer: { x: number; y: number } | null = null;
  menuSel = 0;
  subOpts: SubOption[] = [];
  subSel = 0;
  fight = { x: 0, acc: 0, dano: 0, crit: false, miss: false, dodged: false };
  ending = 0; // > 0: ataques acabando (projéteis somem aos poucos)
  shards: Shard[] = [];
  displayHp = 0;
  text = "";
  textShown = 0;
  textAcc = 0;
  textPause = 0;
  lastSpeech = "";
  sendT = 0;

  scale = 1;
  dpr = 1;
  raf = 0;
  last = 0;
  disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opt: EngineOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opt = opt;
    this.cfg = opt.config;
    this.hp = opt.hp;
    this.sfx = new Sfx(this.cfg.mecanica.sons, this.cfg.audio);
    intensity = Math.max(0.3, this.cfg.mecanica.intensidade || 1);
    this.displayHp = this.hp;
    this.buildPlan();
    this.setText(this.opt.menu?.frase || `* ${this.cfg.monstro.nome || "Algo"} bloqueia o caminho!`);
    this.bindInput();
  }

  modeOverride: SoulMode | null = null; // a pancada transforma a alma em azul até o fim do turno
  gravDir = 0; // 0 baixo, 1 esquerda, 2 cima, 3 direita

  get mode(): SoulMode {
    return this.modeOverride ?? this.cfg.alma.modo;
  }

  /** Pancada: gravidade para a direção dada e a alma é arremessada contra a parede. */
  slam(dir: number) {
    if (!this.alive) return;
    this.modeOverride = "azul";
    this.gravDir = dir;
    this.soul.vy = 700;
    this.sfx.play("selecionar");
  }
  get scene() {
    return this.cfg.cenario ?? defaultCenario();
  }
  get soulScale() {
    return Math.max(0.5, this.cfg.alma.tamanho);
  }
  get soulColor() {
    return this.cfg.alma.cor || SOUL_INFO[this.mode].cor;
  }
  get alive() {
    return !this.opt.spectator && this.hp > 0;
  }

  buildPlan() {
    const atks = this.cfg.ataques;
    const rng = mulberry32(this.opt.seed);
    let list: { cfg: AttackConfig; idx: number }[] = atks.map((cfg, idx) => ({ cfg, idx }));
    if (this.cfg.mecanica.ordem === "aleatorio" && list.length) {
      list = [list[Math.floor(rng() * list.length)]];
    }
    let t = 0;
    for (const it of list) {
      const dur = Math.max(1, it.cfg.duracao);
      if (this.cfg.mecanica.ordem === "simultaneo") {
        this.plan.push({ ...it, start: 0, end: dur });
        t = Math.max(t, dur);
      } else {
        this.plan.push({ ...it, start: t, end: t + dur });
        t += dur;
      }
    }
    this.totalAttack = t;
  }

  // ----- ciclo -----
  start() {
    this.resize();
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  resize() {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.scale = Math.min(cw / W, ch / H);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(W * this.scale * this.dpr);
    this.canvas.height = Math.round(H * this.scale * this.dpr);
    this.canvas.style.width = `${W * this.scale}px`;
    this.canvas.style.height = `${H * this.scale}px`;
  }

  setText(t: string) {
    this.text = t;
    this.textShown = 0;
    this.textAcc = 0;
    this.textPause = 0;
  }

  get textDone() {
    return this.textShown >= this.text.length;
  }

  /** Máquina de escrever com pausas na pontuação. */
  typeText(dt: number) {
    if (this.textDone) return;
    if (this.textPause > 0) {
      this.textPause -= dt;
      return;
    }
    this.textAcc += dt * 32;
    while (this.textAcc >= 1 && !this.textDone) {
      this.textAcc -= 1;
      const ch = this.text[this.textShown++];
      if (ch && ch.trim() && this.textShown % 2 === 0) this.sfx.play("texto");
      if (".!?".includes(ch) && this.text[this.textShown] !== ch) {
        this.textPause = 0.22;
        this.textAcc = 0;
        break;
      }
      if (ch === ",") {
        this.textPause = 0.1;
        this.textAcc = 0;
        break;
      }
    }
  }

  get speechText() {
    return (this.cfg.monstro.fala || "").trim();
  }

  startAttack() {
    this.setPhase("ataque");
    this.text = "";
  }

  setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
  }

  update(dt: number) {
    this.phaseT += dt;
    this.pollGamepads();
    this.typeText(dt);
    this.displayHp += (this.hp - this.displayHp) * (1 - Math.pow(0.002, dt));

    // caixa anima até o tamanho alvo
    let tw = MENU_BOX.w;
    let th = MENU_BOX.h;
    if (this.phase === "ataque" || this.phase === "fala") {
      tw = 0;
      th = 0;
      for (const it of this.plan) {
        if (this.attackT >= it.start && this.attackT < it.end) {
          tw = Math.max(tw, it.cfg.caixaL || this.cfg.mecanica.caixaL);
          th = Math.max(th, it.cfg.caixaA || this.cfg.mecanica.caixaA);
        }
      }
      if (!tw) {
        tw = this.cfg.mecanica.caixaL;
        th = this.cfg.mecanica.caixaA;
      }
      if (this.mode === "verde") {
        tw = 90;
        th = 90;
      }
    }
    const arena = this.phase === "ataque" && this.ending <= 0 && this.arenaT > 0;
    if (arena !== this.arenaOn) {
      this.arenaOn = arena;
      this.opt.onArena?.(arena);
    }
    if (arena) {
      tw = W - 24;
      th = H - 24;
    }
    tw = clamp(tw, 40, arena ? W - 20 : 600);
    th = clamp(th, 40, arena ? H - 20 : 180);
    const k = 1 - Math.pow(0.0005, dt);
    this.boxW += (tw - this.boxW) * k;
    this.boxH += (th - this.boxH) * k;
    if (this.phase !== "ataque" || this.ending > 0) this.boxOffTarget = { x: 0, y: 0 };
    if (arena) this.boxOffTarget = { x: 0, y: H / 2 - BOX_CY };
    this.arenaT = Math.max(0, this.arenaT - dt);
    this.doubleT = Math.max(0, this.doubleT - dt);
    const ko = 1 - Math.pow(0.02, dt);
    this.boxOff.x += (this.boxOffTarget.x - this.boxOff.x) * ko;
    this.boxOff.y += (this.boxOffTarget.y - this.boxOff.y) * ko;
    this.box = rect(W / 2 + this.boxOff.x, BOX_CY + this.boxOff.y, this.boxW, this.boxH);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.sceneT += dt;
    if (this.pull) {
      this.pull.t -= dt;
      if (this.pull.t <= 0 || this.phase !== "ataque") this.pull = null;
    }
    // karma: o HP vai drenando aos poucos (nunca mata sozinho)
    if (this.kr > 0 && (this.phase === "ataque" || this.phase === "fala")) {
      this.krT += dt;
      while (this.krT >= 0.3 && this.kr > 0) {
        this.krT -= 0.3;
        this.kr--;
        if (this.hp > 1) {
          this.hp--;
          this.opt.onHp?.(this.hp);
        }
      }
    } else if (this.phase !== "ataque") {
      this.kr = 0;
      this.krT = 0;
    }
    this.chroma = Math.max(0, this.chroma - dt);

    if (this.phase === "intro" && this.textDone && this.phaseT > 1.2 + this.text.length * 0.012) this.endIntro();
    if (this.phase === "fala" && this.phaseT > Math.max(1.6, this.speechText.length * 0.055 + 1.2)) this.startAttack();

    if (this.phase === "lutar") {
      const b = this.box;
      this.fight.x += ((b.w - 20) / 1.35) * dt;
      if (this.fight.x > b.r - 10) this.fightStop(true);
    }
    if (this.phase === "lutarRes" && this.phaseT > 1.5) this.finishFight();

    if (this.phase === "ataque" && this.ending > 0) {
      this.ending -= dt;
      if (this.ending <= 0) {
        this.bullets = [];
        this.cannons = [];
        this.platforms = [];
        this.endTurn();
      }
    } else if (this.phase === "ataque") {
      this.attackT += dt;
      for (const it of this.plan) {
        if (this.attackT >= it.start && this.attackT < it.end) {
          let a = this.running.get(it.idx * 1000 + it.start);
          if (!a) {
            const style: Style = {
              forma: it.cfg.forma,
              cor: it.cfg.cor || "#ffffff",
              emoji: it.cfg.emoji || "⭐",
              img: it.cfg.forma === "imagem" ? loadImage(it.cfg.imagem) : null,
            };
            a = {
              cfg: it.cfg,
              t: 0,
              timers: {},
              rng: mulberry32(this.opt.seed + 7919 * (it.idx + 1) + Math.round(it.start * 100)),
              style,
              data: {},
            };
            this.running.set(it.idx * 1000 + it.start, a);
          }
          a.t += dt;
          PATTERNS[it.cfg.tipo]?.(a, dt, this);
        }
      }
      if (this.attackT >= this.totalAttack + 0.2) this.ending = 0.4;
    }

    if (this.phase === "ataque" || this.phase === "morto" || this.phase === "fala") {
      this.updateSoul(dt);
      this.updateBullets(dt);
    }
    if (this.phase === "morto") {
      if (this.deadT > 0.9 && !this.shards.length) {
        const s = this.soul;
        for (let i = 0; i < 6; i++)
          this.shards.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 120 });
      }
      for (const sh of this.shards) {
        sh.vy += 300 * dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
      }
      if (this.deadT > 2.6 && !this.text) this.setText("* Sua alma se partiu...\n* Aguarde o mestre.");
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === "morto") this.deadT += dt;

    // fala do monstro
    let speech = "";
    if (this.phase === "fala") speech = this.speechText;
    if (this.phase === "ataque" && this.ending <= 0) {
      for (const it of this.plan)
        if (this.attackT >= it.start && this.attackT < it.end && it.cfg.fala) speech = it.cfg.fala;
    }
    if (speech !== this.lastSpeech) {
      this.lastSpeech = speech;
      this.opt.onSpeech?.(speech);
    }

    // envia posição da alma para os outros
    this.sendT -= dt;
    if (this.sendT <= 0 && !this.opt.spectator && ["ataque", "morto", "fala"].includes(this.phase)) {
      this.sendT = 0.1;
      this.opt.onSoul?.(this.soul.x, this.soul.y, this.hp <= 0);
    }
    const now = performance.now();
    for (const [id, o] of this.others) if (now - o.seen > 3000) this.others.delete(id);
  }

  endIntro() {
    this.placeSoul();
    if (this.speechText) {
      this.setPhase("fala");
      this.text = "";
    } else this.startAttack();
  }

  pendingReply = "";

  /** Resposta do mestre na caixa de texto (se chegar no meio do ataque, aparece no fim). */
  showReply(t: string) {
    const clean = t.trim();
    if (!clean) return;
    const txt = clean.startsWith("*") ? clean : `* ${clean}`;
    if (["intro", "fala", "ataque", "lutar", "lutarRes"].includes(this.phase)) {
      this.pendingReply = txt;
      return;
    }
    if (this.phase === "sub") this.setPhase("menu");
    this.setText(txt);
  }

  endTurn() {
    if (this.hp <= 0 && !this.opt.spectator) return;
    const reply = this.pendingReply;
    this.pendingReply = "";
    if (this.cfg.mecanica.menuFinal && !this.opt.spectator) {
      this.setPhase("menu");
      this.setText(reply || "* O que você vai fazer?");
    } else {
      this.setPhase("fim");
      this.setText(reply || (this.opt.spectator ? "* Turno encerrado. Escolha o próximo passo." : "* O turno acabou."));
    }
  }

  placeSoul() {
    const b = this.box;
    const s = this.soul;
    s.vx = s.vy = 0;
    const fb = rect(W / 2, BOX_CY, this.targetW(), this.targetH());
    s.x = fb.cx;
    if (this.mode === "vermelha") s.y = fb.cy + fb.h * 0.25;
    else if (this.mode === "azul") s.y = fb.b - 10;
    else if (this.mode === "roxa") s.line = 1, (s.y = fb.cy);
    else s.y = fb.cy;
    void b;
  }

  targetW() {
    if (this.mode === "verde") return 90;
    const it = this.plan[0];
    return clamp((it && it.cfg.caixaL) || this.cfg.mecanica.caixaL, 40, 600);
  }
  targetH() {
    if (this.mode === "verde") return 90;
    const it = this.plan[0];
    return clamp((it && it.cfg.caixaA) || this.cfg.mecanica.caixaA, 40, 180);
  }

  /** Lê controles (Gamepad API) e os converte nas mesmas "teclas" do teclado. */
  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set<string>();
    let analogX = 0;
    let analogY = 0;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = (i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      const dead = 0.3;
      if (Math.abs(ax) > Math.abs(analogX) && Math.abs(ax) > dead) analogX = ax;
      if (Math.abs(ay) > Math.abs(analogY) && Math.abs(ay) > dead) analogY = ay;
      // direcional: botões 12-15 no mapeamento padrão; eixos 6/7 em muitos controles genéricos
      let up = btn(12), down = btn(13), left = btn(14), right = btn(15);
      if (p.mapping !== "standard") {
        // controles genéricos costumam mandar o direcional nos eixos 6/7; compara com a posição de repouso
        const rest = (this.axisRest[p.index] ??= [...p.axes]);
        const hx = (p.axes[6] ?? 0) - (rest[6] ?? 0);
        const hy = (p.axes[7] ?? 0) - (rest[7] ?? 0);
        if (hx < -0.5) left = true;
        if (hx > 0.5) right = true;
        if (hy < -0.5) up = true;
        if (hy > 0.5) down = true;
      }
      if (up || ay < -0.5) now.add("ArrowUp");
      if (down || ay > 0.5) now.add("ArrowDown");
      if (left || ax < -0.5) now.add("ArrowLeft");
      if (right || ax > 0.5) now.add("ArrowRight");
      if (btn(0) || btn(3) || btn(9)) now.add("KeyZ"); // A / Y / Start: confirmar e pular
      if (btn(1) || btn(2) || btn(4) || btn(5) || btn(6) || btn(7)) now.add("KeyX"); // B / X / gatilhos: devagar
    }
    for (const c of now) if (!this.padKeys.has(c)) this.keyPress(c);
    this.padKeys = now;
    this.analog = { x: analogX, y: analogY };
  }
  analog = { x: 0, y: 0 };
  axisRest: Record<number, number[]> = {};

  input() {
    const k = { has: (c: string) => this.keys.has(c) || this.padKeys.has(c) };
    let x = 0;
    let y = 0;
    if (k.has("ArrowLeft") || k.has("KeyA")) x -= 1;
    if (k.has("ArrowRight") || k.has("KeyD")) x += 1;
    if (k.has("ArrowUp") || k.has("KeyW")) y -= 1;
    if (k.has("ArrowDown") || k.has("KeyS")) y += 1;
    // analógico: movimento proporcional à inclinação
    if (x === 0 && y === 0 && (this.analog.x || this.analog.y)) {
      x = this.analog.x;
      y = this.analog.y;
    }
    if (this.pointer && x === 0 && y === 0) {
      const dx = this.pointer.x - this.soul.x;
      const dy = this.pointer.y - this.soul.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const f = Math.min(1, d / 20);
        x = (dx / d) * f;
        y = (dy / d) * f;
      }
    }
    const slow = k.has("ShiftLeft") || k.has("ShiftRight") || k.has("KeyX");
    const up = k.has("ArrowUp") || k.has("KeyW");
    const down = k.has("ArrowDown") || k.has("KeyS");
    const left = k.has("ArrowLeft") || k.has("KeyA");
    const right = k.has("ArrowRight") || k.has("KeyD");
    const action = k.has("KeyZ") || k.has("Space");
    return { x, y, slow, up, down, left, right, action };
  }

  updateSoul(dt: number) {
    if (!this.alive) return;
    const s = this.soul;
    const b = this.box;
    const half = 8 * this.soulScale;
    const sp = 150 * Math.max(0.2, this.cfg.alma.velocidade);
    const inp = this.input();
    const ox = s.x;
    const oy = s.y;

    if (this.mode === "vermelha" || this.mode === "amarela") {
      const len = Math.hypot(inp.x, inp.y);
      const m = len > 1 ? 1 / len : 1;
      const f = sp * (inp.slow ? 0.5 : 1);
      s.x += inp.x * m * f * dt;
      s.y += inp.y * m * f * dt;
    } else if (this.mode === "azul") {
      // gravidade em qualquer das 4 direções; s.vy = velocidade no sentido da gravidade
      const gd = this.gravDir;
      const vertical = gd === 0 || gd === 2;
      const sign = gd === 0 || gd === 3 ? 1 : -1;
      const gx = vertical ? 0 : sign;
      const gy = vertical ? sign : 0;
      const pointerAway =
        !!this.pointer && ((this.pointer.x - s.x) * -gx + (this.pointer.y - s.y) * -gy) > 20;
      const away = [inp.up, inp.right, inp.down, inp.left][gd] || inp.action || pointerAway;
      const f = sp * (inp.slow ? 0.5 : 1);
      if (vertical) s.x += clamp(inp.x, -1, 1) * f * dt;
      else s.y += clamp(inp.y, -1, 1) * f * dt;
      const groundP = vertical ? (sign > 0 ? b.b - half : b.t + half) : sign > 0 ? b.r - half : b.l + half;
      const ceilP = vertical ? (sign > 0 ? b.t + half : b.b - half) : sign > 0 ? b.l + half : b.r - half;
      let p = vertical ? s.y : s.x;
      const prevP = p;
      const ground = (p - groundP) * sign >= -0.5 || this.onPlat;
      if (ground && away) s.vy = -270;
      if (!away && s.vy < -70) s.vy = -70;
      s.vy += 720 * dt;
      p += s.vy * sign * dt;
      if ((p - groundP) * sign >= 0) {
        if (s.vy > 450) this.shake = 0.15; // impacto da pancada
        p = groundP;
        s.vy = 0;
      }
      if ((p - ceilP) * sign <= 0) {
        p = ceilP;
        s.vy = Math.max(0, s.vy);
      }
      // plataformas (só com gravidade para baixo)
      this.onPlat = false;
      if (gd === 0 && s.vy >= 0) {
        for (const pl of this.platforms) {
          const top = pl.y - 3;
          if (prevP + half <= top + 2 && p + half >= top && Math.abs(s.x - pl.x) <= pl.w / 2 + half * 0.4) {
            p = top - half;
            s.vy = 0;
            s.x += pl.vx * dt;
            this.onPlat = true;
            break;
          }
        }
      }
      if (vertical) s.y = p;
      else s.x = p;
    } else if (this.mode === "verde") {
      s.x = b.cx;
      s.y = b.cy;
      if (this.pointer) {
        const dx = this.pointer.x - s.x;
        const dy = this.pointer.y - s.y;
        if (Math.hypot(dx, dy) > 10)
          s.shield = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      }
    } else if (this.mode === "roxa") {
      s.x += clamp(inp.x, -1, 1) * sp * (inp.slow ? 0.5 : 1) * dt;
      if (this.pointer) s.line = clamp(Math.round(((this.pointer.y - b.t) / b.h) * 4 - 1), 0, 2);
      const ly = this.lineY(s.line);
      s.y += (ly - s.y) * (1 - Math.pow(0.000001, dt));
    }

    // alma amarela: atira para cima
    this.shotCd -= dt;
    if (this.mode === "amarela" && (inp.action || !!this.pointer) && this.shotCd <= 0 && this.phase === "ataque") {
      this.shots.push({ x: s.x, y: s.y - 10 });
      this.shotCd = 0.18;
      this.sfx.play("texto");
    }
    // vórtice puxando a alma
    if (this.pull && (this.mode === "vermelha" || this.mode === "amarela")) {
      const dx = this.pull.x - s.x;
      const dy = this.pull.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        s.x += (dx / d) * this.pull.f * dt;
        s.y += (dy / d) * this.pull.f * dt;
      }
    }
    s.x = clamp(s.x, b.l + half, b.r - half);
    s.y = clamp(s.y, b.t + half, b.b - half);
    s.moving = Math.hypot(s.x - ox, s.y - oy) > 0.3;
  }

  lineY(i: number) {
    return this.box.t + (this.box.h * (i + 1)) / 4;
  }

  spawn(a: Running, p: Partial<Bullet> & { x: number; y: number; vx: number; vy: number; r: number }): Bullet {
    const u: Bullet = {
      ang: Math.atan2(p.vy, p.vx),
      spin: a.cfg.forma === "estrela" ? 4 : 0,
      face: false,
      kind: a.cfg.tipoDano,
      dano: a.cfg.dano,
      style: a.style,
      life: 0,
      maxLife: 30,
      warn: 0,
      fadeAt: 0,
      bounce: false,
      ...p,
    };
    this.bullets.push(u);
    return u;
  }

  spawnRect(a: Running, x: number, y: number, w: number, h: number, vx: number, vy: number, plain = false) {
    this.spawn(a, {
      x, y, vx, vy,
      r: Math.max(w, h) / 2,
      rw: w,
      rh: h,
      ang: 0,
      spin: 0,
      style: plain && a.style.forma === "osso" ? { ...a.style, forma: "quadrado" } : a.style,
    });
  }

  spawnBeam(
    a: Running,
    x: number,
    y: number,
    w: number,
    h: number,
    warn: number,
    ang = 0,
    look: BeamLook = "feixe",
    active = 0.45,
  ): Bullet {
    return this.spawn(a, {
      x, y, vx: 0, vy: 0,
      r: Math.max(w, h) / 2,
      rw: w,
      rh: h,
      ang,
      spin: 0,
      warn,
      fadeAt: warn + active,
      maxLife: warn + active + 0.25,
      beam: true,
      look,
    });
  }

  /** Canhão visível: entra, mira, carrega, dispara um feixe e sai. */
  spawnCannon(a: Running, o: { tx: number; ty: number; fixedAng?: number; enter?: number; charge: number; width: number }) {
    const b = this.box;
    const out = Math.atan2(o.ty - b.cy, o.tx - b.cx);
    const sx = o.tx + Math.cos(out) * 160;
    const sy = o.ty + Math.sin(out) * 160;
    this.cannons.push({
      x: sx, y: sy, sx, sy, tx: o.tx, ty: o.ty,
      ang: o.fixedAng ?? Math.atan2(this.soul.y - o.ty, this.soul.x - o.tx),
      fixedAng: o.fixedAng,
      t: 0,
      enter: o.enter ?? 0.3,
      charge: Math.max(0.3, o.charge),
      fire: 0.45,
      width: o.width,
      fired: false,
      run: a,
      size: Math.max(0.8, o.width / 24),
    });
    if (this.cannons.length < 3) this.sfx.fx("carga");
  }

  updateCannons(dt: number) {
    for (const c of this.cannons) {
      c.t += dt;
      const e = Math.min(1, c.t / c.enter);
      const ease = 1 - Math.pow(1 - e, 3);
      const aimUntil = c.enter + c.charge - 0.28;
      if (c.fixedAng === undefined && c.t < aimUntil)
        c.ang = Math.atan2(this.soul.y - c.y, this.soul.x - c.x);
      else if (c.fixedAng !== undefined) c.ang = c.fixedAng;
      const fireAt = c.enter + c.charge;
      if (c.t < fireAt) {
        c.x = c.sx + (c.tx - c.sx) * ease;
        c.y = c.sy + (c.ty - c.sy) * ease;
      } else {
        if (!c.fired) {
          c.fired = true;
          const len = 1000;
          const ox = c.tx + Math.cos(c.ang) * 22 * c.size;
          const oy = c.ty + Math.sin(c.ang) * 22 * c.size;
          this.spawnBeam(c.run, ox + Math.cos(c.ang) * (len / 2), oy + Math.sin(c.ang) * (len / 2), len, c.width, 0, c.ang, "feixe", c.fire);
          this.sfx.fx("disparo");
          if (this.cfg.mecanica.efeitos) {
            this.shake = Math.max(this.shake, 0.12);
            this.flash = Math.min(0.5, this.flash + 0.18);
            this.chroma = 0.3;
          }
        }
        // recuo durante o disparo e saída para trás depois
        const k = c.t - fireAt;
        const back = k < c.fire ? 6 * c.size : 6 * c.size + (k - c.fire) * 420;
        c.x = c.tx - Math.cos(c.ang) * back;
        c.y = c.ty - Math.sin(c.ang) * back;
      }
    }
    this.cannons = this.cannons.filter((c) => c.t < c.enter + c.charge + c.fire + 0.6);
  }

  drawCannon(c: Cannon) {
    const g = this.ctx;
    const fireAt = c.enter + c.charge;
    const charging = c.t >= c.enter * 0.6 && c.t < fireAt;
    const prog = clamp((c.t - c.enter) / c.charge, 0, 1);
    const open = c.t >= fireAt ? 1 : prog * 0.5;
    const col = KIND_COLOR[c.run.cfg.tipoDano] ?? (c.run.cfg.cor || "#ffffff");
    const out = c.t > fireAt + c.fire ? clamp(1 - (c.t - fireAt - c.fire) / 0.6, 0, 1) : 1;
    g.save();
    g.globalAlpha = out;
    // linha de mira enquanto carrega
    if (charging && Math.floor(c.t * 14) % 2 === 0) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.ang);
      g.strokeStyle = col;
      g.globalAlpha = 0.25 + prog * 0.45;
      g.lineWidth = 1 + prog * 2;
      g.setLineDash([10, 6]);
      g.beginPath();
      g.moveTo(22 * c.size, 0);
      g.lineTo(900, 0);
      g.stroke();
      g.restore();
    }
    g.translate(c.x, c.y);
    g.rotate(c.ang);
    g.scale(c.size, c.size);
    g.lineJoin = "round";
    g.lineWidth = 2.5;
    g.strokeStyle = "#000";
    g.fillStyle = "#f4f4f4";
    // corpo: losango alongado com aletas atrás
    g.beginPath();
    g.moveTo(-20, 0);
    g.lineTo(-10, -13);
    g.lineTo(8, -11);
    g.lineTo(14, 0);
    g.lineTo(8, 11);
    g.lineTo(-10, 13);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-14, -9);
    g.lineTo(-26, -17);
    g.lineTo(-20, -4);
    g.moveTo(-14, 9);
    g.lineTo(-26, 17);
    g.lineTo(-20, 4);
    g.fill();
    g.stroke();
    // garras da frente (abrem para disparar)
    for (const sgn of [-1, 1]) {
      g.save();
      g.rotate(sgn * open * 0.45);
      g.beginPath();
      g.moveTo(6, sgn * 4);
      g.lineTo(26, sgn * 9);
      g.lineTo(22, sgn * 14);
      g.lineTo(4, sgn * 12);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    // núcleo brilhando
    g.shadowColor = col;
    g.shadowBlur = 6 + prog * 14;
    g.fillStyle = col;
    g.beginPath();
    g.arc(0, 0, 4 + prog * 2.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  updateBullets(dt: number) {
    this.updateCannons(dt);
    for (const pl of this.platforms) pl.x += pl.vx * dt;
    this.platforms = this.platforms.filter((pl) => pl.x > this.box.l - 120 && pl.x < this.box.r + 120);
    if (this.ending > 0) this.cannons = [];
    // tiros da alma amarela
    for (const sh of this.shots) sh.y -= 430 * dt;
    this.shots = this.shots.filter((sh) => sh.y > this.box.t - 10);
    const b = this.box;
    const s = this.soul;
    const hr = 4.5 * this.soulScale;
    const add: Bullet[] = [];
    for (const u of this.bullets) {
      u.life += dt;
      u.warn -= dt;
      if (u.hold) {
        if (u.life >= u.hold.t) {
          u.vx = u.hold.vx;
          u.vy = u.hold.vy;
          u.hold = undefined;
        } else {
          u.vx = 0;
          u.vy = 0;
        }
      }
      if (u.orbit) {
        const o = u.orbit;
        if (u.life < o.track) {
          o.cx = s.x;
          o.cy = s.y;
        }
        if (u.life < o.until) {
          const th = Math.atan2(u.y - o.cy, u.x - o.cx) + o.w * dt;
          u.x = o.cx + Math.cos(th) * o.r;
          u.y = o.cy + Math.sin(th) * o.r;
          u.ang = th + Math.PI;
          u.vx = u.vy = 0;
        } else {
          u.vx = Math.cos(u.ang) * o.sp;
          u.vy = Math.sin(u.ang) * o.sp;
          u.orbit = undefined;
        }
      }
      if (u.ay) u.vy += u.ay * dt;
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      u.ang += u.spin * dt;
      if (u.face) u.ang = Math.atan2(u.vy, u.vx);
      if (u.flip && !u.flip.done && Math.hypot(u.x - u.flip.cx, u.y - u.flip.cy) < 105) {
        u.flip.done = true;
        u.x = 2 * u.flip.cx - u.x;
        u.y = 2 * u.flip.cy - u.y;
        u.vx = -u.vx;
        u.vy = -u.vy;
      }
      if (u.pivot) {
        u.x = u.pivot.x + Math.cos(u.ang) * (u.pivot.len / 2);
        u.y = u.pivot.y + Math.sin(u.ang) * (u.pivot.len / 2);
      }
      if (u.bounce) {
        if (u.x < b.l + u.r) { u.x = b.l + u.r; u.vx = Math.abs(u.vx); }
        if (u.x > b.r - u.r) { u.x = b.r - u.r; u.vx = -Math.abs(u.vx); }
        if (u.y < b.t + u.r) { u.y = b.t + u.r; u.vy = Math.abs(u.vy); }
        if (u.y > b.b - u.r) { u.y = b.b - u.r; u.vy = -Math.abs(u.vy); }
      }
      if ((u.burstY !== undefined && u.y >= u.burstY) || (u.burstAt !== undefined && u.life >= u.burstAt)) {
        u.dead = true;
        const n = u.burstN ?? 8;
        const sp = u.burstSp ?? Math.hypot(u.vx, u.vy) * 0.9 + 30;
        const style = u.burstForma ? { ...u.style, forma: u.burstForma } : u.style;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + u.life;
          add.push({ ...u, burstY: undefined, burstAt: undefined, dead: false, r: u.r * 0.55, life: 0, style,
            face: !!u.burstForma, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, maxLife: 6 });
        }
        if (u.burstAt !== undefined) this.sfx.play("escudo");
        continue;
      }
      if (u.life > u.maxLife) u.dead = true;
      if (u.x < -300 || u.x > W + 300 || u.y < -300 || u.y > H + 300) u.dead = true;
      if (u.dead || !this.alive || u.warn > 0 || this.ending > 0 || u.deco) continue;
      if (u.beam && u.life > u.fadeAt) continue;
      if (u.beam && u.look === "feixe" && -u.warn < 0.04) continue; // o feixe ainda está abrindo

      // tiros da alma amarela destroem projéteis redondos
      if (this.shots.length && !u.beam && u.rw === undefined) {
        const hit = this.shots.findIndex((sh) => Math.abs(sh.x - u.x) < u.r + 3 && Math.abs(sh.y - u.y) < u.r + 6);
        if (hit >= 0) {
          this.shots.splice(hit, 1);
          u.dead = true;
          this.sfx.play("escudo");
          continue;
        }
      }
      // escudo da alma verde
      if (this.mode === "verde" && !u.beam) {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const [dx, dy] = dirs[s.shield];
        const cx = s.x + dx * 20;
        const cy = s.y + dy * 20;
        const px = -dy;
        const py = dx;
        const d = distToSegment(u.x, u.y, cx - px * 16, cy - py * 16, cx + px * 16, cy + py * 16);
        if (d < Math.min(u.r, 10) + 3) {
          u.dead = true;
          this.sfx.play("escudo");
          continue;
        }
      }

      if (!this.hits(u, s.x, s.y, hr)) continue;
      if (u.kind === "verde") {
        u.dead = true;
        this.hp = Math.min(this.cfg.mecanica.hpMax, this.hp + u.dano);
        this.sfx.play("cura");
        this.opt.onHp?.(this.hp);
        continue;
      }
      if (u.kind === "azul" && !s.moving) continue;
      if (u.kind === "laranja" && s.moving) continue;
      if (this.invuln > 0) continue;
      if (this.cfg.mecanica.karma) {
        // karma: 1 de dano por toque, quase sem invencibilidade, e o resto vira veneno
        this.hp = Math.max(0, this.hp - 1);
        this.kr = Math.min(40, this.kr + Math.max(1, u.dano));
        this.invuln = 0.05;
        this.shake = Math.max(this.shake, 0.08);
      } else {
        this.hp = Math.max(0, this.hp - u.dano);
        this.invuln = this.cfg.mecanica.invencivel;
        this.shake = 0.2;
      }
      this.sfx.play("dano");
      this.opt.onHp?.(this.hp);
      if (this.hp <= 0) {
        this.sfx.play("morte");
        this.setPhase("morto");
        this.text = "";
        this.deadT = 0;
        this.shards = [];
        this.opt.onDeath?.();
        this.opt.onSoul?.(s.x, s.y, true);
      }
    }
    this.bullets = this.bullets.filter((u) => !u.dead).concat(add);
  }

  hits(u: Bullet, x: number, y: number, hr: number) {
    if (u.cone) {
      const dx = x - u.x;
      const dy = y - u.y;
      const d = Math.hypot(dx, dy);
      if (d > u.cone.len) return false;
      let da = Math.atan2(dy, dx) - u.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) < u.cone.half + Math.asin(Math.min(1, hr / Math.max(hr, d)));
    }
    if (u.rw !== undefined && u.rh !== undefined) {
      const c = Math.cos(-u.ang);
      const sn = Math.sin(-u.ang);
      const lx = (x - u.x) * c - (y - u.y) * sn;
      const ly = (x - u.x) * sn + (y - u.y) * c;
      const qx = clamp(lx, -u.rw / 2, u.rw / 2);
      const qy = clamp(ly, -u.rh / 2, u.rh / 2);
      return Math.hypot(lx - qx, ly - qy) < hr;
    }
    return Math.hypot(u.x - x, u.y - y) < hr + u.r * 0.85;
  }

  // ----- entrada -----
  bindInput() {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.keyPress(e.code);
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    const toLocal = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const pdown = (e: PointerEvent) => {
      const p = toLocal(e);
      unlockAudio();
      this.opt.onGesture?.();
      if (this.phase === "menu") {
        const i = this.buttonAt(p.x, p.y);
        if (i >= 0) {
          this.menuSel = i;
          this.choose();
        }
        return;
      }
      if (this.phase === "sub") {
        const i = this.subAt(p.x, p.y);
        if (i >= 0) {
          this.subSel = i;
          this.subOpts[i].run();
        } else if (this.buttonAt(p.x, p.y) >= 0) {
          this.menuSel = this.buttonAt(p.x, p.y);
          this.choose();
        }
        return;
      }
      if (this.phase === "lutar") {
        this.fightStop(false);
        return;
      }
      if (this.phase === "intro" && this.textDone) {
        this.endIntro();
        return;
      }
      if (this.phase === "ataque" || this.phase === "fala") {
        this.pointer = p;
        this.canvas.setPointerCapture(e.pointerId);
      }
    };
    const pmove = (e: PointerEvent) => {
      const p = toLocal(e);
      if (this.pointer) this.pointer = p;
      if (this.phase === "menu") {
        const i = this.buttonAt(p.x, p.y);
        if (i >= 0 && i !== this.menuSel) { this.menuSel = i; this.sfx.play("texto"); }
      }
      if (this.phase === "sub") {
        const i = this.subAt(p.x, p.y);
        if (i >= 0 && i !== this.subSel) { this.subSel = i; this.sfx.play("texto"); }
      }
    };
    const pup = () => (this.pointer = null);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.canvas.addEventListener("pointerdown", pdown);
    this.canvas.addEventListener("pointermove", pmove);
    window.addEventListener("pointerup", pup);
    const rs = () => this.resize();
    window.addEventListener("resize", rs);
    this.disposers.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      this.canvas.removeEventListener("pointerdown", pdown);
      this.canvas.removeEventListener("pointermove", pmove);
      window.removeEventListener("pointerup", pup);
      window.removeEventListener("resize", rs);
    });
  }

  keyPress(code: string) {
    const s = this.soul;
    unlockAudio();
    this.opt.onGesture?.();
    if (["escolhido", "fim", "morto"].includes(this.phase) && (code === "KeyZ" || code === "Enter")) this.opt.onConfirmIdle?.();
    const confirm = code === "KeyZ" || code === "Enter" || code === "Space";
    const back = code === "KeyX" || code === "Escape" || code === "Backspace";
    if ((this.phase === "ataque" || this.phase === "fala") && this.alive) {
      if (this.mode === "verde") {
        const map: Record<string, number> = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
        if (code in map) s.shield = map[code];
      } else if (this.mode === "roxa") {
        if (code === "ArrowUp" || code === "KeyW") s.line = Math.max(0, s.line - 1);
        if (code === "ArrowDown" || code === "KeyS") s.line = Math.min(2, s.line + 1);
      }
    }
    if (this.phase === "intro" && confirm && this.textDone) return this.endIntro();
    if (this.phase === "fala" && confirm && this.phaseT > 0.5) return this.startAttack();
    if (this.phase === "menu") {
      if (code === "ArrowLeft" || code === "KeyA") { this.menuSel = (this.menuSel + 3) % 4; this.sfx.play("texto"); }
      if (code === "ArrowRight" || code === "KeyD") { this.menuSel = (this.menuSel + 1) % 4; this.sfx.play("texto"); }
      if (confirm) this.choose();
      return;
    }
    if (this.phase === "sub") {
      const n = this.subOpts.length;
      const move = (d: number) => {
        const i = this.subSel + d;
        if (i >= 0 && i < n) {
          this.subSel = i;
          this.sfx.play("texto");
        }
      };
      if (code === "ArrowLeft" || code === "KeyA") move(-1);
      if (code === "ArrowRight" || code === "KeyD") move(1);
      if (code === "ArrowUp" || code === "KeyW") move(-2);
      if (code === "ArrowDown" || code === "KeyS") move(2);
      if (confirm) this.subOpts[this.subSel]?.run();
      if (back) {
        this.setPhase("menu");
        this.setText("* O que você vai fazer?");
        this.textShown = this.text.length;
      }
      return;
    }
    if (this.phase === "lutar" && confirm) return this.fightStop(false);
    if (!this.textDone && (code === "KeyX" || code === "Enter")) this.textShown = this.text.length;
  }

  // ----- menu LUTAR / AGIR / ITEM / POUPAR -----
  get menuData(): MenuData {
    return (
      this.opt.menu ?? {
        monstro: { nome: this.cfg.monstro.nome, atk: 1, def: 0, descricao: "", poupavel: false },
        acoes: ["Conferir"],
        itens: [],
        danoBase: 10,
        frase: "",
      }
    );
  }

  openSub(opts: SubOption[]) {
    this.subOpts = opts;
    this.subSel = 0;
    this.setPhase("sub");
    this.text = "";
  }

  choose() {
    this.sfx.play("selecionar");
    const m = this.menuData;
    const nome = m.monstro.nome || "Monstro";
    switch (this.menuSel) {
      case 0:
        this.openSub([{ label: nome, run: () => this.startFight() }]);
        break;
      case 1:
        this.openSub([
          ...m.acoes.map((a) => ({
            label: a,
            run: () => {
              if (a.trim().toLowerCase() === "conferir") {
                const desc = m.monstro.descricao ? `\n* ${m.monstro.descricao}` : "";
                this.finish({ escolha: "AGIR", opcao: a }, `* ${nome.toUpperCase()} - ATK ${m.monstro.atk} DEF ${m.monstro.def}${desc}`);
              } else this.finish({ escolha: "AGIR", opcao: a }, `* Você escolheu "${a}".`);
            },
          })),
          { label: WRITE_LABEL, color: "#aaaaaa", run: () => this.finish({ escolha: "AGIR", escrever: true }, "* Descreva o que você faz.") },
        ]);
        break;
      case 2: {
        const itens = m.itens.filter((i) => i.restante > 0);
        this.openSub([
          ...itens.map((it) => ({
            label: `${it.nome}${it.restante > 1 ? ` x${it.restante}` : ""}`,
            run: () => this.useItem(it),
          })),
          { label: WRITE_LABEL, color: "#aaaaaa", run: () => this.finish({ escolha: "ITEM", escrever: true }, "* Que item você usa?") },
        ]);
        break;
      }
      case 3:
        this.openSub([
          { label: "Poupar", color: m.monstro.poupavel ? "#ffff00" : undefined, run: () => this.finish({ escolha: "POUPAR", opcao: "Poupar" }, `* Você poupou ${nome}.`) },
          { label: "Fugir", run: () => this.finish({ escolha: "POUPAR", opcao: "Fugir" }, "* Você tenta fugir...") },
        ]);
        break;
    }
  }

  useItem(it: { nome: string; cura: number; restante: number }) {
    it.restante--;
    const max = this.cfg.mecanica.hpMax;
    const antes = this.hp;
    this.hp = Math.min(max, this.hp + it.cura);
    const ganhou = this.hp - antes;
    this.sfx.play("cura");
    this.opt.onHp?.(this.hp);
    const res = this.hp >= max ? "* Seu HP está no máximo!" : `* Você recuperou ${ganhou} HP!`;
    this.finish({ escolha: "ITEM", opcao: it.nome, cura: ganhou }, `* Você usou ${it.nome}.\n${res}`);
  }

  /** Envia a escolha ao mestre e mostra o texto de espera. */
  finish(c: ChoiceResult, msg: string) {
    this.sfx.play("selecionar");
    this.setPhase("escolhido");
    this.setText(c.escrever ? msg : `${msg}\n${this.opt.waitText ?? "* Aguardando o mestre..."}`);
    this.opt.onChoice?.(c);
  }

  startFight() {
    this.setPhase("lutar");
    this.text = "";
    this.fight = { x: this.box.l + 10, acc: 0, dano: 0, crit: false, miss: false, dodged: false };
  }

  fightStop(miss: boolean) {
    const b = this.box;
    const m = this.menuData;
    const acc = miss ? 0 : Math.max(0, 1 - Math.abs(this.fight.x - b.cx) / (b.w / 2 - 10));
    const crit = !miss && acc > 0.96;
    // o monstro pode desviar do golpe (chance definida pelo mestre)
    const dodged = !miss && Math.random() * 100 < (m.monstro.esquiva ?? 0);
    let dano = miss || dodged ? 0 : Math.round(m.danoBase * (0.25 + 0.75 * acc) * (crit ? 1.5 : 1)) - m.monstro.def;
    dano = Math.max(miss || dodged ? 0 : 1, dano);
    this.fight = { ...this.fight, acc, dano, crit: crit && !dodged, miss, dodged };
    this.sfx.play(miss || dodged ? "texto" : "dano");
    this.setPhase("lutarRes");
    this.opt.onFight?.(dano, crit && !dodged, miss, dodged);
  }

  finishFight() {
    const f = this.fight;
    const nome = this.menuData.monstro.nome || "Monstro";
    const msg = f.miss
      ? `* Você errou o golpe!`
      : f.dodged
        ? `* ${nome} desviou do seu golpe!`
        : `* Você atacou ${nome}${f.crit ? " - CRÍTICO" : ""}!\n* ${f.dano} de dano (precisão ${Math.round(f.acc * 100)}%).`;
    this.finish(
      { escolha: "LUTAR", opcao: nome, precisao: Math.round(f.acc * 100), dano: f.dano, critico: f.crit, esquivou: f.dodged || undefined },
      msg,
    );
  }

  subRect(i: number) {
    const b = this.box;
    const col = i % 2;
    const row = Math.floor(i / 2);
    return { x: b.l + 30 + col * (b.w / 2), y: b.t + 22 + row * 32, w: b.w / 2 - 40, h: 30 };
  }

  subAt(x: number, y: number) {
    for (let i = 0; i < this.subOpts.length; i++) {
      const r = this.subRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y - 4 && y <= r.y + r.h) return i;
    }
    return -1;
  }

  buttonAt(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const bx = 40 + i * 145;
      if (x >= bx && x <= bx + 120 && y >= 428 && y <= 470) return i;
    }
    return -1;
  }

  // ----- desenho -----
  draw() {
    const g = this.ctx;
    const k = this.scale * this.dpr;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);

    const sc = this.scene;
    const quake = (this.shake > 0 ? 6 : 0) + (this.phase === "ataque" ? sc.tremor * 5 : sc.tremor * 2);
    if (quake > 0) g.translate((Math.random() - 0.5) * quake, (Math.random() - 0.5) * quake);
    this.drawScene();

    const b = this.box;
    // caixa
    g.fillStyle = sc.caixaCor;
    g.fillRect(b.l, b.t, b.w, b.h);
    g.strokeStyle = sc.bordaCor;
    g.lineWidth = 4;
    g.strokeRect(b.l - 2, b.t - 2, b.w + 4, b.h + 4);

    // texto dentro da caixa (quebra de linha automática)
    if (this.text && this.phase !== "ataque" && this.phase !== "fala") {
      g.fillStyle = "#fff";
      g.font = `26px ${FONT}`;
      g.textBaseline = "top";
      g.textAlign = "left";
      const lines = wrapText(g, this.text, b.w - 50);
      let left = Math.floor(this.textShown);
      lines.slice(0, 4).forEach((line, i) => {
        const part = line.slice(0, Math.max(0, left));
        left -= line.length + 1;
        g.fillText(part, b.l + 22, b.t + 16 + i * 28);
      });
    }

    if (this.phase === "sub") this.drawSub();
    if (this.phase === "lutar" || this.phase === "lutarRes") this.drawFight();

    if (this.phase === "ataque" || this.phase === "morto" || this.phase === "fala") {
      // fios da alma roxa
      if (this.mode === "roxa") {
        g.strokeStyle = "#8a2be2";
        g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const y = this.lineY(i);
          g.beginPath();
          g.moveTo(b.l, y);
          g.lineTo(b.r, y);
          g.stroke();
        }
      }
      g.save();
      if (this.mode !== "verde") {
        g.beginPath();
        g.rect(b.l, b.t, b.w, b.h);
        g.clip();
      }
      const fadeOut = this.ending > 0 ? Math.max(0, this.ending / 0.4) : 1;
      const big = (u: Bullet) => u.beam && (u.look === "feixe" || u.look === "corte");
      for (const u of this.bullets) {
        if (big(u)) continue;
        g.globalAlpha = Math.min(1, u.life / 0.12) * fadeOut;
        this.drawBullet(u);
      }
      // visão dupla: um fantasma deslocado de tudo (não machuca)
      if (this.doubleT > 0) {
        const off = 14 * Math.sin(this.sceneT * 1.7);
        g.save();
        g.translate(off, -off * 0.3);
        for (const u of this.bullets) {
          if (big(u)) continue;
          g.globalAlpha = 0.32 * fadeOut;
          this.drawBullet(u);
        }
        g.restore();
      }
      g.globalAlpha = 1;
      // plataformas
      for (const pl of this.platforms) {
        g.fillStyle = "#1f8f3a";
        g.fillRect(pl.x - pl.w / 2, pl.y - 3, pl.w, 6);
        g.fillStyle = "#4dff7a";
        g.fillRect(pl.x - pl.w / 2, pl.y - 3, pl.w, 2);
      }
      g.restore();
      // feixes e cortes atravessam a tela inteira
      for (const u of this.bullets) {
        if (!big(u)) continue;
        g.globalAlpha = fadeOut;
        this.drawBullet(u);
      }
      g.globalAlpha = 1;
      for (const c of this.cannons) this.drawCannon(c);

      g.fillStyle = "#ffe14a";
      for (const sh of this.shots) g.fillRect(sh.x - 1.5, sh.y - 5, 3, 9);
      for (const o of this.others.values()) this.drawOther(o);
      if (!this.opt.spectator) this.drawSoul();
    }

    if (this.arenaOn) {
      // brilho do inimigo no meio da arena
      const grd = g.createRadialGradient(b.cx, b.cy, 4, b.cx, b.cy, 120);
      grd.addColorStop(0, "rgba(255,255,255,0.55)");
      grd.addColorStop(1, "rgba(120,150,255,0)");
      g.fillStyle = grd;
      g.fillRect(b.cx - 120, b.cy - 120, 240, 240);
    }
    if (this.flash > 0) {
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = `rgba(255,255,255,${this.flash})`;
      g.fillRect(0, 0, W, H);
    }
    this.drawHud();
    g.setTransform(1, 0, 0, 1, 0, 0);
    // aberração cromática nas fases intensas e nos disparos
    const intense = this.cfg.mecanica.efeitos && this.phase === "ataque" && (this.chroma > 0 || this.cfg.mecanica.intensidade >= 1.4);
    const filter = intense
      ? "drop-shadow(2px 0 0 rgba(255,0,70,0.55)) drop-shadow(-2px 0 0 rgba(0,220,255,0.55))"
      : "";
    if (filter !== this.lastFilter) {
      this.lastFilter = filter;
      this.canvas.style.filter = filter;
    }
  }

  drawSub() {
    const g = this.ctx;
    g.save();
    g.font = `26px ${FONT}`;
    g.textBaseline = "top";
    g.textAlign = "left";
    this.subOpts.forEach((o, i) => {
      const r = this.subRect(i);
      g.fillStyle = o.color ?? "#fff";
      g.fillText(`* ${o.label}`, r.x + 22, r.y);
      if (i === this.subSel) g.drawImage(heartSprite(this.soulColor), r.x, r.y + 6, 16, 14);
    });
    g.restore();
  }

  /** Alvo do LUTAR: elipses concêntricas e uma barra que corre da esquerda para a direita. */
  drawFight() {
    const g = this.ctx;
    const b = this.box;
    g.save();
    const rx = b.w / 2 - 12;
    const ry = b.h / 2 - 12;
    const rings = ["#1f3a5f", "#2c5d8f", "#3f86c6", "#7fc1ff"];
    rings.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(b.cx, b.cy, rx * (1 - i * 0.24), ry * (1 - i * 0.18), 0, 0, Math.PI * 2);
      g.fill();
    });
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(b.cx, b.t + 8);
    g.lineTo(b.cx, b.b - 8);
    g.stroke();
    // marcas de distância
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 1; i <= 4; i++) {
      const dx = (rx / 5) * i;
      g.fillRect(b.cx - dx - 1, b.cy - 4, 2, 8);
      g.fillRect(b.cx + dx - 1, b.cy - 4, 2, 8);
    }
    const blink = this.phase === "lutarRes" && Math.floor(this.phaseT * 10) % 2 === 0;
    g.fillStyle = blink ? "#000" : "#fff";
    g.strokeStyle = "#000";
    g.lineWidth = 2;
    g.fillRect(this.fight.x - 6, b.t + 6, 12, b.h - 12);
    g.strokeRect(this.fight.x - 6, b.t + 6, 12, b.h - 12);
    g.restore();
  }

  bulletColor(u: Bullet) {
    return KIND_COLOR[u.kind] ?? u.cor ?? u.style.cor;
  }

  /** Fundo animado do cenário (desenhado antes da caixa). */
  drawScene() {
    const g = this.ctx;
    const sc = this.scene;
    const t = this.sceneT;
    if (!this.cfg.monstro.fundo) {
      g.fillStyle = sc.fundoCor;
      g.fillRect(-20, -20, W + 40, H + 40);
    }
    const col = sc.corEfeito;
    g.save();
    if (sc.efeito === "pulso") {
      const a = 0.16 + 0.12 * Math.sin(t * 2.4);
      const grd = g.createRadialGradient(W / 2, BOX_CY, 20, W / 2, BOX_CY, 360);
      grd.addColorStop(0, hexA(col, a));
      grd.addColorStop(1, hexA(col, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    } else if (sc.efeito === "grade") {
      g.strokeStyle = hexA(col, 0.22);
      g.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const y = (i * 36 + t * 28) % (H + 36);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
    } else if (sc.efeito === "estatica") {
      for (let i = 0; i < 160; i++) {
        g.fillStyle = hexA(col, Math.random() * 0.35);
        g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 1);
      }
      const band = (t * 120) % (H + 40);
      g.fillStyle = hexA(col, 0.06);
      g.fillRect(0, band - 20, W, 14);
    } else if (sc.efeito !== "nenhum") {
      if (!this.motes.length) {
        for (let i = 0; i < 60; i++)
          this.motes.push({ x: Math.random() * W, y: Math.random() * H, v: 10 + Math.random() * 40, s: 1 + Math.random() * 2.5, p: Math.random() * 6 });
      }
      for (const m of this.motes) {
        if (sc.efeito === "estrelas") {
          g.fillStyle = hexA(col, 0.25 + 0.5 * Math.abs(Math.sin(t * 1.5 + m.p)));
          g.fillRect(m.x, m.y * 0.85, m.s, m.s);
          continue;
        }
        const speed = sc.efeito === "chamas" ? m.v * 1.8 : m.v;
        const y = (m.y - t * speed) % H;
        const yy = y < 0 ? y + H : y;
        const wob = Math.sin(t * 2 + m.p) * (sc.efeito === "chamas" ? 6 : 3);
        const alpha = sc.efeito === "chamas" ? (yy / H) * 0.8 : 0.35;
        g.fillStyle = hexA(col, alpha);
        g.fillRect(m.x + wob, yy, m.s, sc.efeito === "chamas" ? m.s * 2 : m.s);
      }
    }
    if (sc.escuro > 0) {
      const grd = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, sc.escuro)})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  drawBullet(u: Bullet) {
    const g = this.ctx;
    const col = this.bulletColor(u);
    g.save();
    g.translate(u.x, u.y);

    if (u.deco === "anel") {
      const k = Math.min(1, u.life / Math.max(0.01, u.maxLife));
      g.strokeStyle = "#ff3040";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, u.r * (1.6 - k * 0.6), 0, Math.PI * 2);
      g.stroke();
      g.restore();
      return;
    }
    if (u.cone) {
      g.rotate(u.ang);
      const L = u.cone.len;
      const hw = Math.tan(u.cone.half) * L;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(L, -hw);
      g.lineTo(L, hw);
      g.closePath();
      if (u.warn > 0) {
        if (Math.floor(u.life * 12) % 2 === 0) {
          g.strokeStyle = "rgba(255,255,255,0.7)";
          g.lineWidth = 2;
          g.setLineDash([8, 6]);
          g.stroke();
        }
      } else {
        const fade = u.life > u.fadeAt ? 1 - (u.life - u.fadeAt) / 0.25 : 1;
        const grd = g.createLinearGradient(0, 0, L, 0);
        grd.addColorStop(0, `rgba(255,255,255,${0.95 * Math.max(0, fade)})`);
        grd.addColorStop(1, `rgba(170,190,255,${0.55 * Math.max(0, fade)})`);
        g.fillStyle = grd;
        g.shadowColor = "#aabbff";
        g.shadowBlur = 20;
        g.fill();
      }
      g.restore();
      return;
    }
    if (u.beam) {
      g.rotate(u.ang);
      const rw = u.rw!;
      const rh = u.rh!;
      if (u.warn > 0) {
        if (u.warnColor) {
          g.strokeStyle = u.warnColor;
          g.globalAlpha *= 0.5 + 0.4 * (Math.floor(u.life * 16) % 2);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(-rw / 2, 0);
          g.lineTo(rw / 2, 0);
          g.stroke();
        } else if (u.warnRed) {
          g.strokeStyle = `rgba(255,40,40,${0.45 + 0.4 * (Math.floor(u.life * 16) % 2)})`;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(-rw / 2, 0);
          g.lineTo(rw / 2, 0);
          g.stroke();
        } else if (Math.floor(u.life * 12) % 2 === 0) {
          g.strokeStyle = u.look === "feixe" ? col : "rgba(255,255,255,0.8)";
          g.lineWidth = 2;
          g.setLineDash([6, 4]);
          g.strokeRect(-rw / 2, -rh / 2, rw, rh);
        }
      } else {
        const age = -u.warn;
        const fade = u.life > u.fadeAt ? 1 - (u.life - u.fadeAt) / 0.25 : 1;
        g.globalAlpha *= Math.max(0, fade);
        if (u.look === "osso") {
          g.fillStyle = col;
          drawBone(g, rw, rh);
        } else if (u.look === "espinhos") {
          g.fillStyle = col;
          const along = rw >= rh;
          const len = along ? rw : rh;
          const th = along ? rh : rw;
          const rise = Math.min(1, age / 0.08);
          for (let p = -len / 2 + 6; p < len / 2; p += 11) {
            g.save();
            if (along) g.translate(p, (th * (1 - rise)) / 2);
            else g.translate((th * (1 - rise)) / 2, p);
            drawBone(g, along ? 7 : th * rise, along ? th * rise : 7);
            g.restore();
          }
        } else if (u.look === "cristal") {
          // espinho de cristal subindo
          const rise = Math.min(1, age / 0.1);
          const hh = rh * rise;
          g.translate(0, rh / 2);
          g.fillStyle = "#dff6ff";
          g.strokeStyle = "#7fd4ff";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(-rw / 2, 0);
          g.lineTo(-rw * 0.15, -hh * 0.7);
          g.lineTo(0, -hh);
          g.lineTo(rw * 0.2, -hh * 0.6);
          g.lineTo(rw / 2, 0);
          g.closePath();
          g.fill();
          g.stroke();
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, -hh);
          g.stroke();
        } else if (u.look === "corte") {
          g.shadowColor = "#ff4040";
          g.shadowBlur = 10;
          g.fillStyle = "#ffffff";
          g.fillRect(-rw / 2, -rh / 2, rw, rh);
        } else {
          // feixe: abre rápido, pulsa e fecha
          const open = Math.min(1, age / 0.08);
          const pulse = 1 + Math.sin(age * 40) * 0.06;
          const hh = rh * open * pulse * Math.max(0.2, fade);
          g.shadowColor = col;
          g.shadowBlur = 16;
          g.fillStyle = col;
          g.fillRect(-rw / 2, -hh / 2, rw, hh);
          g.shadowBlur = 0;
          g.fillStyle = "#fff";
          g.fillRect(-rw / 2, -hh * 0.3, rw, hh * 0.6);
        }
      }
      g.restore();
      return;
    }

    g.rotate(u.ang);
    if (u.kind !== "branco" && (u.style.forma === "imagem" || u.style.forma === "emoji")) {
      g.shadowColor = col;
      g.shadowBlur = 10;
    }
    g.fillStyle = col;
    g.strokeStyle = col;
    const r = u.r;
    const isRect = u.rw !== undefined;
    const rw = u.rw ?? r * 2;
    const rh = u.rh ?? r * 2;

    switch (u.style.forma) {
      case "imagem": {
        const img = u.style.img;
        if (img && img.complete && img.naturalWidth) {
          if (isRect) g.drawImage(img, -rw / 2, -rh / 2, rw, rh);
          else g.drawImage(img, -r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
        } else {
          g.beginPath();
          g.arc(0, 0, r, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case "emoji": {
        // emoji pré-desenhado em cache (desenhar texto a cada quadro é caro)
        const px = isRect ? Math.max(rw, rh) : r * 2.4;
        const spr = emojiSprite(u.style.emoji, col, px);
        g.drawImage(spr, -spr.width / 2, -spr.height / 2);
        break;
      }
      case "osso":
        if (isRect) drawBone(g, rw, rh);
        else drawBone(g, r * 3, r * 1.2);
        break;
      case "seta":
        if (isRect) g.fillRect(-rw / 2, -rh / 2, rw, rh);
        else {
          g.fillRect(-r * 1.6, -r * 0.25, r * 2.2, r * 0.5);
          g.beginPath();
          g.moveTo(r * 1.6, 0);
          g.lineTo(r * 0.4, -r * 0.8);
          g.lineTo(r * 0.4, r * 0.8);
          g.closePath();
          g.fill();
        }
        break;
      case "quadrado":
        g.fillRect(-rw / 2, -rh / 2, rw, rh);
        break;
      case "espada": {
        const along = !isRect || rw >= rh;
        const len = isRect ? Math.max(rw, rh) : r * 3.2;
        const th = isRect ? Math.min(rw, rh) : r * 0.9;
        if (!along) g.rotate(Math.PI / 2);
        drawSword(g, len, th, col);
        break;
      }
      case "triangulo":
        g.beginPath();
        g.moveTo(r * 1.4, 0);
        g.lineTo(-r * 0.9, -r * 0.9);
        g.lineTo(-r * 0.9, r * 0.9);
        g.closePath();
        g.fill();
        break;
      case "estrela6": {
        g.beginPath();
        for (let i = 0; i < 12; i++) {
          const rr = i % 2 ? r * 0.55 : r * 1.25;
          const a = (i / 12) * Math.PI * 2;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.fillStyle = "#1a2040";
        g.beginPath();
        g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "crescente": {
        const hh = isRect ? rh / 2 : r;
        const ww = isRect ? rw : r;
        // rastro
        const baseAlpha = g.globalAlpha;
        for (let k = 3; k >= 0; k--) {
          g.globalAlpha = baseAlpha * (k === 0 ? 1 : 0.18);
          g.save();
          g.translate(k * 10, 0);
          g.beginPath();
          g.ellipse(0, 0, ww * 1.6, hh, 0, -Math.PI / 2, Math.PI / 2, true);
          g.ellipse(ww * 0.9, 0, ww * 0.9, hh * 0.92, 0, Math.PI / 2, -Math.PI / 2, false);
          g.closePath();
          g.fill();
          g.restore();
        }
        break;
      }
      case "gota":
        g.beginPath();
        g.moveTo(r * 1.6, 0);
        g.quadraticCurveTo(0, -r, -r * 0.8, 0);
        g.quadraticCurveTo(0, r, r * 1.6, 0);
        g.fill();
        break;
      case "rabisco": {
        g.lineWidth = Math.max(2, (isRect ? Math.min(rw, rh) : r) * 0.25);
        g.lineJoin = "round";
        const along = isRect && rh > rw;
        const len = isRect ? Math.max(rw, rh) : r * 2;
        const amp = (isRect ? Math.min(rw, rh) : r) / 2;
        g.beginPath();
        for (let p = -len / 2, i = 0; p <= len / 2; p += 6, i++) {
          const q = (i % 2 ? 1 : -1) * amp;
          if (along) g.lineTo(q, p);
          else g.lineTo(p, q);
        }
        g.stroke();
        break;
      }
      case "diamante":
        if (isRect) g.fillRect(-rw / 2, -rh / 2, rw, rh);
        else {
          g.beginPath();
          g.moveTo(0, -r * 1.2);
          g.lineTo(r, 0);
          g.lineTo(0, r * 1.2);
          g.lineTo(-r, 0);
          g.closePath();
          g.fill();
        }
        break;
      case "estrela":
        if (isRect) g.fillRect(-rw / 2, -rh / 2, rw, rh);
        else {
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const rr = i % 2 ? r * 0.55 : r * 1.3;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
        }
        break;
      default:
        if (isRect) g.fillRect(-rw / 2, -rh / 2, rw, rh);
        else {
          g.beginPath();
          g.arc(0, 0, r, 0, Math.PI * 2);
          g.fill();
        }
    }
    g.restore();

    if (this.cfg.mecanica.mostrarHitbox) {
      g.save();
      g.strokeStyle = "#ff00ff";
      g.lineWidth = 1;
      g.translate(u.x, u.y);
      if (isRect) {
        g.rotate(u.ang);
        g.strokeRect(-rw / 2, -rh / 2, rw, rh);
      } else {
        g.beginPath();
        g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
  }

  drawSoul() {
    const g = this.ctx;
    const s = this.soul;
    const size = 16 * this.soulScale;
    if (this.phase === "morto") {
      if (this.deadT > 0.9) {
        g.fillStyle = this.soulColor;
        for (const sh of this.shards) {
          if (sh.y > H + 20) continue;
          g.fillRect(Math.round(sh.x), Math.round(sh.y), 3, 3);
          g.fillRect(Math.round(sh.x) + 3, Math.round(sh.y) + 3, 2, 2);
        }
        return;
      }
      const spr = heartSprite(this.soulColor);
      const sp = Math.min(1, this.deadT * 3) * 6;
      g.save();
      g.beginPath();
      g.rect(s.x - size, s.y - size, size, size * 2);
      g.clip();
      g.drawImage(spr, s.x - size / 2 - sp, s.y - size / 2 + this.deadT * 4, size, size * (10 / 11));
      g.restore();
      g.save();
      g.beginPath();
      g.rect(s.x, s.y - size, size, size * 2);
      g.clip();
      g.drawImage(spr, s.x - size / 2 + sp, s.y - size / 2 + this.deadT * 4, size, size * (10 / 11));
      g.restore();
      return;
    }
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) {
      // pisca durante a invencibilidade
    } else {
      const img = loadImage(this.cfg.alma.imagem);
      if (img && img.complete && img.naturalWidth) g.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
      else if (this.mode === "amarela") {
        g.save();
        g.translate(s.x, s.y);
        g.scale(1, -1);
        g.drawImage(heartSprite(this.soulColor), -size / 2, -size * 0.45, size, size * (10 / 11));
        g.restore();
      } else g.drawImage(heartSprite(this.soulColor), s.x - size / 2, s.y - size * 0.45, size, size * (10 / 11));
    }
    if (this.mode === "verde") {
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const [dx, dy] = dirs[s.shield];
      const cx = s.x + dx * 20;
      const cy = s.y + dy * 20;
      g.strokeStyle = "#3b6bff";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx + dy * 16, cy - dx * 16);
      g.lineTo(cx - dy * 16, cy + dx * 16);
      g.stroke();
      g.strokeStyle = "rgba(22,198,12,0.6)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(s.x, s.y, 26, 0, Math.PI * 2);
      g.stroke();
    }
    if (this.cfg.mecanica.mostrarHitbox) {
      g.strokeStyle = "#00ffff";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(s.x, s.y, 4.5 * this.soulScale, 0, Math.PI * 2);
      g.stroke();
    }
  }

  drawOther(o: OtherSoul) {
    if (o.dead) return;
    const g = this.ctx;
    const size = 16 * this.soulScale;
    g.save();
    g.globalAlpha = 0.45;
    g.drawImage(heartSprite(o.color), o.x - size / 2, o.y - size * 0.45, size, size * (10 / 11));
    g.globalAlpha = 0.8;
    g.fillStyle = o.color;
    g.font = `14px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "bottom";
    g.fillText(o.name, o.x, o.y - size * 0.55);
    g.restore();
  }

  drawHud() {
    const g = this.ctx;
    g.save();
    if (this.arenaOn) g.globalAlpha = 0.45;
    g.textBaseline = "middle";
    g.font = `24px ${FONT}`;
    g.fillStyle = "#fff";
    const name = this.opt.spectator ? "MESTRE" : this.opt.playerName.toUpperCase().slice(0, 12);
    g.fillText(name, 40, 405);
    if (!this.opt.spectator) {
      g.fillText("LV 1", 200, 405);
      g.font = `16px ${FONT}`;
      g.fillText("HP", 270, 405);
      const max = this.cfg.mecanica.hpMax;
      const bw = Math.min(120, 30 + max * 1.2);
      g.fillStyle = "#c00";
      g.fillRect(295, 395, bw, 20);
      g.fillStyle = "#ff0";
      const hpW = bw * Math.max(0, Math.min(1, this.displayHp / max));
      g.fillRect(295, 395, hpW, 20);
      if (this.cfg.mecanica.karma) {
        const krW = Math.min(hpW, bw * (this.kr / max));
        g.fillStyle = "#ff2bd6";
        g.fillRect(295 + hpW - krW, 395, krW, 20);
        g.fillStyle = "#fff";
        g.font = `16px ${FONT}`;
        g.fillText("KR", 300 + bw, 405);
      }
      g.fillStyle = this.kr > 0 ? "#ff2bd6" : "#fff";
      g.font = `24px ${FONT}`;
      g.fillText(`${this.hp} / ${max}`, (this.cfg.mecanica.karma ? 324 : 305) + bw, 405);
    } else {
      g.font = `20px ${FONT}`;
      g.fillStyle = "#aaa";
      g.fillText("(assistindo)", 130, 405);
    }

    const labels = ["LUTAR", "AGIR", "ITEM", "POUPAR"];
    if (this.arenaOn) {
      g.restore();
      return;
    }
    const active = this.phase === "menu";
    const chosen = ["sub", "lutar", "lutarRes"].includes(this.phase);
    for (let i = 0; i < 4; i++) {
      const bx = 40 + i * 145;
      const sel = (active || chosen) && i === this.menuSel;
      const col = sel ? "#ffff00" : active ? "#ff7f27" : "#7a4a1d";
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.strokeRect(bx, 430, 120, 40);
      g.fillStyle = col;
      g.font = `26px ${FONT}`;
      g.textAlign = "left";
      if (sel && active) g.drawImage(heartSprite(this.soulColor), bx + 8, 442, 18, 16);
      else drawButtonIcon(g, i, bx + 8, 440, col);
      g.fillText(labels[i], bx + 34, 451);
    }
    g.restore();
  }
}

function drawButtonIcon(g: CanvasRenderingContext2D, i: number, x: number, y: number, col: string) {
  g.save();
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineWidth = 2;
  if (i === 0) {
    // espada
    g.fillRect(x + 9, y, 3, 14);
    g.fillRect(x + 4, y + 13, 13, 3);
    g.fillRect(x + 9, y + 16, 3, 4);
  } else if (i === 1) {
    // balão de fala
    g.strokeRect(x + 2, y + 2, 16, 11);
    g.fillRect(x + 5, y + 13, 3, 5);
  } else if (i === 2) {
    // bolsa
    g.fillRect(x + 3, y + 6, 15, 13);
    g.strokeRect(x + 7, y + 1, 7, 6);
  } else {
    // X
    g.beginPath();
    g.moveTo(x + 3, y + 3);
    g.lineTo(x + 17, y + 17);
    g.moveTo(x + 17, y + 3);
    g.lineTo(x + 3, y + 17);
    g.stroke();
  }
  g.restore();
}

/** Espada deitada no eixo x, ponta para +x. */
function drawSword(g: CanvasRenderingContext2D, len: number, th: number, col: string) {
  const blade = len * 0.72;
  const x0 = -len / 2 + len * 0.28;
  g.save();
  g.fillStyle = col;
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, -th / 2);
  g.lineTo(x0 + blade - th, -th / 2);
  g.lineTo(x0 + blade, 0);
  g.lineTo(x0 + blade - th, th / 2);
  g.lineTo(x0, th / 2);
  g.closePath();
  g.fill();
  g.stroke();
  // guarda e cabo
  g.fillRect(x0 - th * 0.5, -th * 1.4, th * 0.6, th * 2.8);
  g.fillRect(-len / 2, -th * 0.3, len * 0.28 - th * 0.5, th * 0.6);
  g.restore();
}

function drawBone(g: CanvasRenderingContext2D, w: number, h: number) {
  const vertical = h >= w;
  const len = vertical ? h : w;
  const thick = vertical ? w : h;
  const shaft = thick * 0.55;
  const knob = thick * 0.42;
  g.save();
  if (!vertical) g.rotate(Math.PI / 2);
  g.fillRect(-shaft / 2, -len / 2 + knob, shaft, len - knob * 2);
  for (const sy of [-len / 2 + knob, len / 2 - knob]) {
    g.beginPath();
    g.arc(-thick * 0.22, sy, knob, 0, Math.PI * 2);
    g.arc(thick * 0.22, sy, knob, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** "#rrggbb" + alfa -> rgba() */
function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex) ?? ["", "ff", "ff", "ff"];
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${Math.max(0, Math.min(1, a))})`;
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxW && line) {
        out.push(line);
        line = `  ${word}`;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
