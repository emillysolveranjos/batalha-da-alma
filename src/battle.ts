// Página da batalha (abre como modal em tela cheia no Owlbear Rodeo).

import OBR from "@owlbear-rodeo/sdk";
import { BattleEngine, ChoiceResult, H, MenuData, W } from "./engine";
import { MusicHost, MusicPlayer } from "./audio";
import { CH_FILE_PROGRESS, CH_FILE_READY, CH_FILE_REQ, ProgressMsg, fileUrl } from "./files";
import { parseSource } from "./media";
import { advancePhase, newBattleState } from "./gm";
import {
  AttackType,
  BATTLE_KEY,
  BattleConfig,
  BattleState,
  CH_ACTION,
  CH_EVENT,
  CH_HP,
  CH_REPLY,
  CH_SOUL,
  CONFIG_KEY,
  HP_KEY,
  ITEMS_KEY,
  MODAL_ID,
  ActionMsg,
  describeAction,
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
// fora do Owlbear (demonstração) também funciona como teste sozinho
const isTest = params.has("teste") || !OBR.isAvailable;

let engine: BattleEngine | null = null;
const music = new MusicPlayer();
let musicKey = "";
let me = { id: "local", name: "Jogador", color: "#ff4444", gm: false };
let currentTurn = "";
let pendingChoice: ChoiceResult | null = null;
let monsterHp = 0;
let monsterHpMax = 0;
let turnNumber = 1;
let usedItems: Record<string, number> = {};
let testCfg: BattleConfig | null = null;
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

// balão com máquina de escrever
let speechTimer = 0;
function showSpeech(text: string) {
  clearInterval(speechTimer);
  bubble.style.display = text ? "block" : "none";
  bubble.textContent = "";
  placeBubble();
  if (!text) return;
  let i = 0;
  speechTimer = window.setInterval(() => {
    i++;
    bubble.textContent = text.slice(0, i);
    if (i % 2 === 0 && text[i - 1]?.trim()) engine?.sfx.play("texto");
    if (i >= text.length) clearInterval(speechTimer);
  }, 38);
}

/** Golpe do LUTAR: corte, tremida, número de dano e barra de vida do monstro. */
function fightFx(dano: number, crit: boolean, miss: boolean) {
  const img = monsterEl.querySelector<HTMLElement>("img, .placeholder");
  const slash = $("slash");
  const dmg = $("dmg");
  const bar = $("mhp");
  const fill = bar.querySelector<HTMLElement>("div")!;
  const top = monsterEl.offsetTop + monsterEl.offsetHeight / 2;
  slash.style.top = `${top - 50}px`;
  dmg.style.top = `${Math.max(4, top - 70)}px`;
  bar.style.top = `${monsterEl.offsetTop + monsterEl.offsetHeight + 2}px`;
  if (!miss) {
    slash.classList.remove("go");
    void slash.offsetWidth;
    slash.classList.add("go");
  }
  window.setTimeout(() => {
    dmg.textContent = miss ? "ERROU" : String(dano);
    dmg.style.color = miss ? "#c0c0c0" : crit ? "#ffff40" : "#ff3030";
    dmg.classList.remove("go");
    void dmg.offsetWidth;
    dmg.classList.add("go");
    if (miss) return;
    img?.classList.remove("hurt");
    void img?.offsetWidth;
    img?.classList.add("hurt");
    if (monsterHpMax > 0) {
      fill.style.transition = "none";
      fill.style.width = `${(monsterHp / monsterHpMax) * 100}%`;
      bar.classList.add("show");
      monsterHp = Math.max(0, monsterHp - dano);
      requestAnimationFrame(() => {
        fill.style.transition = "width 0.8s ease-out";
        fill.style.width = `${(monsterHp / monsterHpMax) * 100}%`;
      });
      window.setTimeout(() => bar.classList.remove("show"), 1800);
    }
  }, miss ? 0 : 350);
}

const FLAVOR = [
  "* {n} não tira os olhos de você.",
  "* {n} se prepara para atacar.",
  "* O ar fica pesado.",
  "* {n} respira fundo.",
];

function buildMenu(cfg: BattleConfig): MenuData {
  const nome = cfg.monstro.nome || "Monstro";
  const frase =
    turnNumber <= 1
      ? `* ${nome} bloqueia o caminho!`
      : (cfg.monstro.frase || FLAVOR[turnNumber % FLAVOR.length]).replace(/\{n\}/g, nome);
  return {
    monstro: { nome, atk: cfg.monstro.atk, def: cfg.monstro.def, descricao: cfg.monstro.descricao, poupavel: cfg.monstro.poupavel },
    acoes: cfg.monstro.acoes.filter((a) => a.trim()),
    itens: cfg.itens
      .filter((i) => i.nome.trim())
      .map((i) => ({ nome: i.nome, cura: i.cura, restante: Math.max(0, i.qtd - (usedItems[i.nome] ?? 0)) })),
    danoBase: cfg.mecanica.danoAtaque,
    frase,
  };
}

function helpText(mode: SoulMode, spectator: boolean) {
  if (spectator) return "Você está assistindo. As almas dos jogadores aparecem translúcidas.";
  const base = SOUL_INFO[mode].desc;
  return `${base}  •  Controle: analógico/direcional move, A pula/confirma, B devagar.  •  Mouse/dedo: arraste.`;
}

function startEngine(cfg: BattleConfig, seed: number, spectator: boolean, hp: number) {
  engine?.stop();
  note.style.display = "none";
  pendingChoice = null;
  cfg.mecanica.sons = cfg.mecanica.sons && !muted;
  engine = new BattleEngine(canvas, {
    config: cfg,
    seed,
    spectator,
    playerName: me.name,
    hp,
    menu: buildMenu(cfg),
    waitText: isTest ? "* (Teste) Responda na barra acima, ou Z / ▶ para continuar." : undefined,
    onFight: fightFx,
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
      if (choice.escolha === "ITEM" && choice.opcao) {
        usedItems[choice.opcao] = (usedItems[choice.opcao] ?? 0) + 1;
        if (OBR.isAvailable && !isTest) OBR.player.setMetadata({ [ITEMS_KEY]: usedItems });
      }
      if (choice.escrever) {
        pendingChoice = choice;
        note.style.display = "flex";
        noteInput.value = "";
        noteInput.placeholder = choice.escolha === "ITEM" ? "Que item você usa? — Enter envia" : "O que você faz? — Enter envia";
        noteInput.focus();
      } else sendAction(choice, "");
    },
    onSpeech: showSpeech,
    onGesture: () => music.resume(),
    onConfirmIdle: () => {
      if (pendingChoice) sendChoice();
      else if (isTest) testNewTurn(false);
    },
  });
  // a música só reinicia se o mestre trocou a faixa ou o volume
  const key = JSON.stringify([cfg.audio.musica, cfg.audio.volMusica, cfg.mecanica.sons]);
  if (key !== musicKey) {
    musicKey = key;
    if (cfg.mecanica.sons) music.play(cfg.audio, musicHost);
    else music.stop();
  }
  preloadSfx(cfg);
  music.setMuted(muted);
  setupScene(cfg);
  $("help").textContent = helpText(cfg.alma.modo, spectator);
  engine.start();
  if (!OBR.isAvailable) (window as unknown as { engine: BattleEngine | null }).engine = engine; // depuração
  layout();
  checkFocus();
}

// ---------- barra do mestre (assistindo ou testando) ----------
const gmInfo = $("gmInfo");
const gmReply = $<HTMLInputElement>("gmReply");

function showGmBar() {
  $("gmbar").classList.remove("hidden");
  $("help").classList.add("hidden");
  if (isTest) $("gmEnd").textContent = "✕ Fechar teste";
}

/** Teste sozinho: começa outro turno localmente (mesmos ataques ou próxima fase). */
function testNewTurn(nextPhase: boolean) {
  if (!testCfg) return;
  const cfg = structuredClone(testCfg);
  if (nextPhase) {
    const nome = advancePhase(cfg);
    if (!nome) {
      gmInfo.textContent = "Nenhuma fase salva — carregue um preset ou salve turnos.";
      return;
    }
    testCfg = structuredClone(cfg);
    gmInfo.textContent = `Fase: ${nome}`;
  }
  turnNumber++;
  const hp = engine && engine.hp > 0 ? engine.hp : cfg.mecanica.hpMax;
  startEngine(cfg, Math.floor(Math.random() * 1e9), false, hp);
}

/** Mestre na batalha de verdade: grava o novo turno para todos. */
async function gmNewTurn(nextPhase: boolean) {
  const room = await OBR.room.getMetadata();
  const cfg = normalizeConfig(room[CONFIG_KEY]);
  const st = room[BATTLE_KEY] as BattleState | undefined;
  if (nextPhase) {
    const nome = advancePhase(cfg);
    if (!nome) {
      gmInfo.textContent = "Nenhuma fase salva — carregue um preset ou salve turnos.";
      return;
    }
    gmInfo.textContent = `Fase: ${nome}`;
  }
  await OBR.room.setMetadata({ [CONFIG_KEY]: cfg, [BATTLE_KEY]: newBattleState(cfg, st, st?.participantes ?? []) });
}

function sendReply() {
  const texto = gmReply.value.trim();
  if (!texto) return;
  gmReply.value = "";
  if (OBR.isAvailable && !isTest) OBR.broadcast.sendMessage(CH_REPLY, { texto }, { destination: "ALL" });
  else engine?.showReply(texto);
}
gmReply.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendReply();
  e.stopPropagation();
});
$("gmNext").onclick = () => (isTest || !OBR.isAvailable ? testNewTurn(false) : gmNewTurn(false));
$("gmPhase").onclick = () => (isTest || !OBR.isAvailable ? testNewTurn(true) : gmNewTurn(true));
$("gmEnd").onclick = async () => {
  if (isTest || !OBR.isAvailable) {
    music.stop();
    if (OBR.isAvailable) OBR.modal.close(MODAL_ID);
    return;
  }
  const room = await OBR.room.getMetadata();
  const st = room[BATTLE_KEY] as BattleState | undefined;
  if (st) await OBR.room.setMetadata({ [BATTLE_KEY]: { ...st, ativo: false } });
};

// ---------- arquivos de áudio do mestre ----------
const statusEl = $("status");
function setStatus(msg: string) {
  statusEl.textContent = msg;
  statusEl.style.display = msg ? "block" : "none";
}
function requestFile(hash: string) {
  if (OBR.isAvailable && !isTest) OBR.broadcast.sendMessage(CH_FILE_REQ, { hash }, { destination: "REMOTE" });
}
const musicHost: MusicHost = { embedBox: $("embed"), onStatus: setStatus, onNeedFile: requestFile };

/** Deixa os efeitos enviados pelo mestre prontos (ou pede os que faltam). */
function preloadSfx(cfg: BattleConfig) {
  for (const v of Object.values(cfg.audio.sons)) {
    const s = parseSource(v);
    if (s.kind === "arquivo") fileUrl(s.hash).then((u) => u || requestFile(s.hash));
  }
}

function sendAction(c: ChoiceResult, texto: string) {
  const msg: ActionMsg = { nome: me.name, ...c, texto };
  delete (msg as { escrever?: boolean }).escrever;
  if (OBR.isAvailable && !isTest) OBR.broadcast.sendMessage(CH_ACTION, msg, { destination: "REMOTE" });
  else if (OBR.isAvailable) OBR.notification.show(`(teste) ${c.escolha}${c.opcao ? ` — ${c.opcao}` : ""}${texto ? `: ${texto}` : ""}`);
}

function sendChoice() {
  if (!pendingChoice) return;
  const text = noteInput.value.trim();
  sendAction(pendingChoice, text);
  if (engine) engine.setText(`* ${text ? `"${text.slice(0, 60)}"` : `Você escolheu ${pendingChoice.escolha}.`}\n* Aguardando o mestre...`);
  pendingChoice = null;
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

  OBR.broadcast.onMessage(CH_FILE_READY, (ev) => {
    const hash = (ev.data as { hash: string }).hash;
    fileUrl(hash).then(() => music.fileArrived(hash));
  });
  OBR.broadcast.onMessage(CH_FILE_PROGRESS, (ev) => {
    const d = ev.data as ProgressMsg;
    if (d.sending || d.done >= d.total) return;
    setStatus(`Baixando áudio do mestre… ${Math.round((d.done / d.total) * 100)}%`);
  });

  const items = meta[ITEMS_KEY];
  if (items && typeof items === "object") usedItems = { ...(items as Record<string, number>) };
  OBR.player.onChange((p) => {
    const it = p.metadata[ITEMS_KEY];
    usedItems = it && typeof it === "object" ? { ...(it as Record<string, number>) } : {};
  });

  const savedHp = (cfg: BattleConfig) => {
    const v = meta[HP_KEY];
    return typeof v === "number" ? Math.min(v, cfg.mecanica.hpMax) : cfg.mecanica.hpMax;
  };

  OBR.broadcast.onMessage(CH_REPLY, (ev) => engine?.showReply(String((ev.data as { texto: string }).texto || "")));

  if (isTest) {
    const room = await OBR.room.getMetadata();
    const cfg = normalizeConfig(room[CONFIG_KEY]);
    testCfg = structuredClone(cfg);
    showGmBar();
    monsterHpMax = monsterHp = cfg.monstro.hp;
    usedItems = {};
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
    const cfg0 = normalizeConfig(st.config);
    monsterHpMax = cfg0.monstro.hp;
    monsterHp = st.monstroHp ?? monsterHpMax;
    if (st.turno === currentTurn) return;
    currentTurn = st.turno;
    turnNumber = st.numero ?? 1;
    const cfg = cfg0;
    const inBattle = !st.participantes?.length || st.participantes.includes(me.id);
    const spectator = me.gm || !inBattle;
    if (me.gm) showGmBar();
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
  if (me.gm) {
    OBR.broadcast.onMessage(CH_ACTION, (ev) => {
      gmInfo.textContent = describeAction(ev.data as ActionMsg);
    });
  }
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
  if (params.has("rapido")) cfg.ataques.forEach((a) => (a.duracao = 1));
  monsterHpMax = monsterHp = cfg.monstro.hp;
  testCfg = structuredClone(cfg);
  showGmBar();
  me.name = "Jogador";
  startEngine(cfg, 12345, params.has("assistir"), cfg.mecanica.hpMax);
}

if (OBR.isAvailable) OBR.onReady(runInOwlbear);
else runDemo();
