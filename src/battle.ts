// Página da batalha (abre como modal em tela cheia no Owlbear Rodeo).

import OBR from "@owlbear-rodeo/sdk";
import { BattleEngine, H, W } from "./engine";
import { MusicPlayer } from "./audio";
import {
  AttackType,
  BATTLE_KEY,
  BattleConfig,
  BattleState,
  CH_ACTION,
  CH_EVENT,
  CH_HP,
  CH_SOUL,
  CONFIG_KEY,
  HP_KEY,
  MODAL_ID,
  SOUL_INFO,
  SoulMode,
  defaultAttack,
  defaultConfig,
  normalizeConfig,
} from "./shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("canvas");
const stage = $("stage");
const layer = $("layer");
const monsterEl = $("monster");
const bubble = $("bubble");
const focusEl = $("focus");
const note = $("note");
const noteInput = $<HTMLInputElement>("noteInput");
const params = new URLSearchParams(location.search);
const isTest = params.has("teste");

let engine: BattleEngine | null = null;
const music = new MusicPlayer();
let musicKey = "";
let me = { id: "local", name: "Jogador", color: "#ff4444", gm: false };
let currentTurn = "";
let pendingChoice = "";
let muted = false;
try {
  muted = localStorage.getItem("batalha-mute") === "1";
} catch {
  /* sem armazenamento */
}

function layout() {
  if (!engine) return;
  const s = engine.scale;
  stage.style.width = `${W * s}px`;
  stage.style.height = `${H * s}px`;
  layer.style.width = `${W}px`;
  layer.style.height = `${H}px`;
  layer.style.transformOrigin = "0 0";
  layer.style.transform = `scale(${s})`;
}
window.addEventListener("resize", layout);

function setupScene(cfg: BattleConfig) {
  document.getElementById("bg")!.style.backgroundImage = cfg.monstro.fundo ? `url("${cfg.monstro.fundo}")` : "";
  monsterEl.style.top = "6px";
  monsterEl.style.height = "202px";
  monsterEl.style.justifyContent = "flex-end";
  monsterEl.innerHTML = "";
  const esc = Math.max(0.3, Math.min(2, cfg.monstro.escala || 1));
  if (cfg.monstro.imagem) {
    const img = document.createElement("img");
    img.src = cfg.monstro.imagem;
    img.style.maxHeight = `${Math.min(200, 160 * esc)}px`;
    img.style.maxWidth = `${Math.min(360, 260 * esc)}px`;
    img.onload = placeBubble;
    monsterEl.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.style.fontSize = "64px";
    ph.textContent = "( ° ‿ ° )";
    monsterEl.appendChild(ph);
  }
  const name = document.createElement("div");
  name.style.fontSize = "18px";
  name.style.opacity = "0.7";
  name.textContent = cfg.monstro.nome;
  monsterEl.appendChild(name);
  placeBubble();
}

function placeBubble() {
  const w = monsterEl.getBoundingClientRect().width / (engine?.scale || 1);
  bubble.style.left = `${Math.min(W - 230, W / 2 + w / 2 + 18)}px`;
  bubble.style.top = "36px";
  bubble.style.maxWidth = "210px";
}

function showSpeech(text: string) {
  bubble.style.display = text ? "block" : "none";
  bubble.textContent = text;
  placeBubble();
}

function helpText(mode: SoulMode, spectator: boolean) {
  if (spectator) return "Você está assistindo. As almas dos jogadores aparecem translúcidas.";
  const base = SOUL_INFO[mode].desc;
  return `${base}  •  Controle: analógico/direcional move, A pula/confirma, B devagar.  •  Mouse/dedo: arraste.`;
}

function startEngine(cfg: BattleConfig, seed: number, spectator: boolean, hp: number) {
  engine?.stop();
  note.style.display = "none";
  pendingChoice = "";
  cfg.mecanica.sons = cfg.mecanica.sons && !muted;
  engine = new BattleEngine(canvas, {
    config: cfg,
    seed,
    spectator,
    playerName: me.name,
    hp,
    onHp: (v) => {
      if (OBR.isAvailable && !isTest) OBR.player.setMetadata({ [HP_KEY]: v });
    },
    onDeath: () => {
      if (OBR.isAvailable && !isTest)
        OBR.broadcast.sendMessage(CH_EVENT, { tipo: "morte", nome: me.name }, { destination: "REMOTE" });
    },
    onSoul: (x, y, dead) => {
      if (OBR.isAvailable && !isTest)
        OBR.broadcast.sendMessage(
          CH_SOUL,
          { id: me.id, name: me.name, color: me.color, x, y, dead },
          { destination: "REMOTE" },
        );
    },
    onChoice: (choice) => {
      pendingChoice = choice;
      note.style.display = "flex";
      noteInput.value = "";
      noteInput.focus();
    },
    onSpeech: showSpeech,
    onGesture: () => music.resume(),
    onConfirmIdle: () => {
      if (pendingChoice) sendChoice();
    },
  });
  // a música só reinicia se o mestre trocou a faixa ou o volume
  const key = JSON.stringify([cfg.audio.musica, cfg.audio.volMusica, cfg.mecanica.sons]);
  if (key !== musicKey) {
    musicKey = key;
    if (cfg.mecanica.sons) music.play(cfg.audio);
    else music.stop();
  }
  music.setMuted(muted);
  setupScene(cfg);
  $("help").textContent = helpText(cfg.alma.modo, spectator);
  engine.start();
  layout();
  checkFocus();
}

function sendChoice() {
  if (!pendingChoice) return;
  const text = noteInput.value.trim();
  if (OBR.isAvailable && !isTest) {
    OBR.broadcast.sendMessage(CH_ACTION, { nome: me.name, escolha: pendingChoice, texto: text }, { destination: "REMOTE" });
  } else if (OBR.isAvailable) {
    OBR.notification.show(`(teste) ${pendingChoice}${text ? ": " + text : ""}`);
  }
  if (engine) engine.setText(`* Você escolheu ${pendingChoice}.${text ? `\n* "${text.slice(0, 40)}"` : ""}\n* Aguardando o mestre...`);
  pendingChoice = "";
  note.style.display = "none";
  window.focus();
}
$("noteSend").onclick = sendChoice;
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChoice();
  e.stopPropagation();
});

// foco do teclado: dentro do Owlbear o iframe precisa ser clicado
const hasGamepad = () => [...(navigator.getGamepads?.() ?? [])].some((p) => p?.connected);
function checkFocus() {
  const needs = engine && !engine.opt.spectator && !document.hasFocus() && !hasGamepad();
  focusEl.style.display = needs ? "flex" : "none";
}
window.addEventListener("focus", checkFocus);
window.addEventListener("blur", checkFocus);
window.addEventListener("gamepadconnected", () => {
  checkFocus();
  music.resume();
});
focusEl.onclick = () => {
  music.resume();
  window.focus();
  canvas.focus();
  focusEl.style.display = "none";
};

$("mute").textContent = muted ? "♪̸" : "♪";
$("mute").onclick = () => {
  muted = !muted;
  try {
    localStorage.setItem("batalha-mute", muted ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
  $("mute").textContent = muted ? "♪̸" : "♪";
  if (engine) engine.sfx.on = !muted && engine.cfg.mecanica.sons;
  music.setMuted(muted);
  music.resume();
};
$("close").onclick = () => {
  music.stop();
  if (OBR.isAvailable) OBR.modal.close(MODAL_ID);
  else engine?.stop();
};

// ---------- dentro do Owlbear ----------
async function runInOwlbear() {
  const [id, name, color, role, meta] = await Promise.all([
    OBR.player.getId(),
    OBR.player.getName(),
    OBR.player.getColor(),
    OBR.player.getRole(),
    OBR.player.getMetadata(),
  ]);
  me = { id, name, color, gm: role === "GM" };

  const savedHp = (cfg: BattleConfig) => {
    const v = meta[HP_KEY];
    return typeof v === "number" ? Math.min(v, cfg.mecanica.hpMax) : cfg.mecanica.hpMax;
  };

  if (isTest) {
    const room = await OBR.room.getMetadata();
    const cfg = normalizeConfig(room[CONFIG_KEY]);
    startEngine(cfg, Math.floor(Math.random() * 1e9), false, cfg.mecanica.hpMax);
    return;
  }

  const apply = (room: Record<string, unknown>) => {
    const st = room[BATTLE_KEY] as BattleState | undefined;
    if (!st || !st.ativo) {
      music.stop();
      OBR.modal.close(MODAL_ID);
      return;
    }
    if (st.turno === currentTurn) return;
    currentTurn = st.turno;
    const cfg = normalizeConfig(st.config);
    const inBattle = !st.participantes?.length || st.participantes.includes(me.id);
    const spectator = me.gm || !inBattle;
    const hp = engine && !engine.opt.spectator ? Math.min(engine.hp, cfg.mecanica.hpMax) : savedHp(cfg);
    startEngine(cfg, st.seed, spectator, hp);
  };
  apply(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(apply);

  OBR.broadcast.onMessage(CH_SOUL, (ev) => {
    const d = ev.data as { id: string; name: string; color: string; x: number; y: number; dead: boolean };
    if (!engine || d.id === me.id) return;
    engine.others.set(d.id, { ...d, seen: performance.now() });
  });
  OBR.broadcast.onMessage(CH_HP, (ev) => {
    const d = ev.data as { alvo: string[]; hp: number | "max" };
    if (!engine || engine.opt.spectator) return;
    if (d.alvo.length && !d.alvo.includes(me.id)) return;
    engine.hp = d.hp === "max" ? engine.cfg.mecanica.hpMax : Math.max(0, Math.min(engine.cfg.mecanica.hpMax, d.hp));
  });
}

// ---------- fora do Owlbear: modo demonstração para testar no navegador ----------
function runDemo() {
  const cfg = defaultConfig();
  cfg.monstro.nome = "Boneco de Treino";
  cfg.monstro.fala = "* Isto é só um teste.";
  const modo = params.get("modo") as SoulMode | null;
  if (modo && modo in SOUL_INFO) cfg.alma.modo = modo;
  const only = params.get("ataque") as AttackType | null;
  cfg.ataques = only
    ? [{ ...defaultAttack(only), duracao: 12 }]
    : (["chuva", "ossos", "laser", "anel"] as AttackType[]).map((t) => ({ ...defaultAttack(t), duracao: 5 }));
  if (params.has("hitbox")) cfg.mecanica.mostrarHitbox = true;
  me.name = "Jogador";
  startEngine(cfg, 12345, params.has("assistir"), cfg.mecanica.hpMax);
  // acesso para depuração no console do navegador
  (window as unknown as { engine: BattleEngine | null }).engine = engine;
}

if (OBR.isAvailable) OBR.onReady(runInOwlbear);
else runDemo();
