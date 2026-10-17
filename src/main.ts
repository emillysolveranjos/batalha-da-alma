// Painel (popover) da extensão: o mestre monta a batalha; jogadores veem o próprio HP.

import OBR, { isImage, Player } from "@owlbear-rodeo/sdk";
import {
  ATTACK_INFO,
  AttackType,
  BATTLE_KEY,
  BattleConfig,
  BattleState,
  BulletKind,
  BulletShape,
  CH_ACTION,
  CH_EVENT,
  CH_HP,
  CH_ITEMS_RESET,
  CH_REPLY,
  CONFIG_KEY,
  ActionMsg,
  describeAction,
  HP_KEY,
  MODAL_ID,
  EFEITO_INFO,
  SFX_INFO,
  SOUL_INFO,
  defaultCenario,
  SavedTurn,
  SfxName,
  SoulMode,
  defaultAttack,
  defaultConfig,
  normalizeConfig,
} from "./shared";
import { MusicPlayer, Sfx } from "./audio";
import { CH_FILE_PROGRESS, CH_FILE_PUSH, MAX_FILE_MB, ProgressMsg, fileUrl, hashFile, putFile } from "./files";
import { describeSource, fileValue, parseSource } from "./media";
import { BUILTIN_PRESETS, PRESET_FORMAT, PresetFile, parsePreset } from "./presets";
import { applyTurn as applyTurnTo, getPhaseIdx, loadLibrary, newBattleState, saveLibrary, setPhaseIdx } from "./gm";

const app = document.getElementById("app")!;
const BATTLE_URL = `${import.meta.env.BASE_URL}battle.html`;
const inOBR = OBR.isAvailable;

let cfg: BattleConfig = defaultConfig();
let battle: BattleState | null = null;
let players: Player[] = [];
let tab: "monstro" | "cenario" | "alma" | "ataques" | "sons" | "presets" | "batalha" = "batalha";
const openSecs = new Set<string>();
const closedSecs = new Set<string>();
let presetFilter: "todos" | "Undertale" | "Deltarune" | "Fangame" | "meus" = "todos";
let presetSearch = "";
let undoCfg: BattleConfig | null = null;
let presetStatus = "";
let phaseIdx = getPhaseIdx();
let audioFiles: string[] = [];
const urlMode = new Set<string>();
let sendStatus = "";
let selected = new Set<string>();
let openCards = new Set<number>();
const log: string[] = [];

const KIND_LABEL: Record<BulletKind, string> = {
  branco: "Branco — sempre fere",
  azul: "Azul — fere se você se MOVER",
  laranja: "Laranja — fere se você ficar PARADO",
  verde: "Verde — cura ao tocar",
};
const KIND_DOT: Record<BulletKind, string> = { branco: "#fff", azul: "#14a9ff", laranja: "#ffa040", verde: "#22dd22" };
const SHAPE_LABEL: Record<BulletShape, string> = {
  circulo: "Círculo",
  quadrado: "Quadrado",
  diamante: "Diamante",
  estrela: "Estrela",
  osso: "Osso",
  seta: "Seta / lança",
  emoji: "Emoji",
  imagem: "Imagem (URL)",
  espada: "Espada",
  triangulo: "Triângulo",
  estrela6: "Estrela de 6 pontas",
  crescente: "Lua crescente",
  gota: "Gota",
  rabisco: "Rabisco",
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ---------- salvar ----------
let saveTimer = 0;
function save(now = false) {
  clearTimeout(saveTimer);
  const run = () => inOBR && OBR.room.setMetadata({ [CONFIG_KEY]: cfg });
  if (now) return run();
  saveTimer = window.setTimeout(run, 400);
}

function getPath(path: string): unknown {
  return path.split(".").reduce<any>((o, k) => o?.[k], cfg);
}
function setPath(path: string, value: unknown) {
  const keys = path.split(".");
  const last = keys.pop()!;
  const obj = keys.reduce<any>((o, k) => o[k], cfg);
  obj[last] = value;
}

// ---------- campos ----------
function text(path: string, label: string, placeholder = "") {
  return `<label>${label}</label><input type="text" data-path="${path}" value="${esc(String(getPath(path) ?? ""))}" placeholder="${esc(placeholder)}">`;
}
function area(path: string, label: string, placeholder = "") {
  return `<label>${label}</label><textarea data-path="${path}" placeholder="${esc(placeholder)}">${esc(String(getPath(path) ?? ""))}</textarea>`;
}
function num(path: string, label: string, min: number, max: number, step = 1) {
  return `<div><label>${label}</label><input type="number" data-path="${path}" data-num min="${min}" max="${max}" step="${step}" value="${getPath(path)}"></div>`;
}
const fmt = (path: string, v: number) =>
  path.includes(".vol") || path.startsWith("cenario.") ? `${Math.round(v * 100)}%` : `${v.toFixed(1)}×`;
function range(path: string, label: string, min: number, max: number, step: number) {
  const v = Number(getPath(path));
  return `<div><label>${label}: <b data-out="${path}">${fmt(path, v)}</b></label><input type="range" data-path="${path}" data-num min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
}
/** Arquivos que o mestre já enviou neste navegador (para reaproveitar em outros campos). */
function uploads(): { value: string; name: string }[] {
  try {
    return JSON.parse(localStorage.getItem("batalha-uploads") || "[]");
  } catch {
    return [];
  }
}
function rememberUpload(value: string, name: string) {
  const list = uploads().filter((u) => u.value !== value);
  list.unshift({ value, name });
  try {
    localStorage.setItem("batalha-uploads", JSON.stringify(list.slice(0, 30)));
  } catch {
    /* sem armazenamento */
  }
}

function audioField(path: string, label: string, music = false) {
  const v = String(getPath(path) ?? "");
  const special: Record<string, string> = music
    ? { "": "♪ Música original (padrão)", nenhuma: "Sem música" }
    : { "": "Som padrão (sintetizado)" };
  const files = uploads();
  if (parseSource(v).kind === "arquivo" && !files.some((f) => f.value === v))
    files.unshift({ value: v, name: describeSource(v).replace(/^Arquivo: /, "") });
  const known = v in special || files.some((f) => f.value === v) || audioFiles.includes(v);
  const isUrl = urlMode.has(path) || !known;
  const opts = [
    ...Object.entries(special),
    ...files.map((f) => [f.value, `📤 ${f.name}`]),
    ...audioFiles.map((f) => [f, `📁 ${f.replace(/^audio\//, "")}`]),
    ["__url", music ? "🔗 Link (YouTube, SoundCloud, Drive, Dropbox, mp3)" : "🔗 Link (Drive, Dropbox, mp3)"],
  ];
  const cur = isUrl ? "__url" : v;
  const kind = isUrl && v ? describeSource(v) : "";
  return `<label>${label}</label>
    <div class="row"><select data-audio="${path}">${opts
      .map(([k, l]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(l)}</option>`)
      .join("")}</select>
      <button class="btn shrink" data-upload="${path}" title="Enviar arquivo do computador">📤</button>
      <button class="btn shrink" data-preview="${path}" title="Ouvir">▶</button></div>
    ${
      isUrl
        ? `<input type="text" style="margin-top:4px" data-path="${path}" data-rerender-blur value="${esc(v)}" placeholder="${
            music ? "Cole o link do YouTube, SoundCloud, Drive…" : "Link direto, Drive ou Dropbox"
          }">${kind ? `<div class="muted">Reconhecido: ${esc(kind)}</div>` : ""}`
        : ""
    }`;
}
function check(path: string, label: string) {
  return `<label class="check"><input type="checkbox" data-path="${path}" ${getPath(path) ? "checked" : ""}> ${label}</label>`;
}
function select(path: string, label: string, opts: Record<string, string>, rerender = false) {
  const v = String(getPath(path));
  return `<div><label>${label}</label><select data-path="${path}" ${rerender ? "data-rerender" : ""}>${Object.entries(opts)
    .map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(l)}</option>`)
    .join("")}</select></div>`;
}
function imageField(path: string, label: string) {
  const v = String(getPath(path) ?? "");
  return `<label>${label}</label>
    <div class="row"><input type="text" data-path="${path}" data-rerender-blur value="${esc(v)}" placeholder="https://… (png, gif, webp)">
    ${inOBR ? `<button class="btn shrink" data-token="${path}" title="Usa a imagem do token selecionado no mapa">Token</button>` : ""}</div>
    ${v ? `<img class="preview" src="${esc(v)}" alt="">` : ""}`;
}

// ---------- abas ----------
/** Seção recolhível que lembra se estava aberta entre uma renderização e outra. */
function sec(id: string, title: string, body: string, openByDefault = false) {
  const open = openSecs.has(id) || (openByDefault && !closedSecs.has(id));
  return `<details class="sec" data-sec="${id}" ${open ? "open" : ""}><summary>${title}</summary>${body}</details>`;
}

function viewMonstro() {
  return `
    ${text("monstro.nome", "Nome")}
    ${imageField("monstro.imagem", "Aparência (link da imagem ou token selecionado)")}
    ${range("monstro.escala", "Tamanho na tela", 0.3, 2, 0.1)}
    ${area("monstro.fala", "Fala no balão antes dos ataques", "Você não vai passar daqui.")}
    ${sec(
      "status",
      "Status e AGIR",
      `<div class="grid3">
        ${num("monstro.hp", "HP (0 = sem barra)", 0, 99999)}
        ${num("monstro.atk", "ATK", 0, 999)}
        ${num("monstro.def", "DEF", 0, 999)}
      </div>
      ${text("monstro.descricao", "Descrição do “Conferir”", "Parece cansado de lutar.")}
      <label>Opções do AGIR (uma por linha)</label>
      <textarea data-lines="monstro.acoes">${esc(cfg.monstro.acoes.join("\n"))}</textarea>
      ${check("monstro.poupavel", "Pode ser poupado (fica amarelo no POUPAR)")}`,
    )}
    ${sec(
      "textos",
      "Texto da caixa",
      `${text("monstro.frase", "Nos turnos seguintes ao primeiro", "* {n} te encara.")}
      <p class="muted">{n} vira o nome do monstro. Vazio = frases automáticas.</p>`,
    )}`;
}

function viewCenario() {
  const sc = cfg.cenario;
  const efeitos = EFEITO_INFO as Record<string, string>;
  const lib = loadLibrary();
  const fase = phaseIdx >= 0 ? lib[phaseIdx] : undefined;
  return `
    <div class="grid2">
      <div><label>Fundo</label><input type="color" data-path="cenario.fundoCor" value="${sc.fundoCor}"></div>
      ${select("cenario.efeito", "Efeito animado", efeitos)}
    </div>
    <div class="grid3">
      <div><label>Cor do efeito</label><input type="color" data-path="cenario.corEfeito" value="${sc.corEfeito}"></div>
      <div><label>Borda da caixa</label><input type="color" data-path="cenario.bordaCor" value="${sc.bordaCor}"></div>
      <div><label>Dentro da caixa</label><input type="color" data-path="cenario.caixaCor" value="${sc.caixaCor}"></div>
    </div>
    <div class="grid2">
      ${range("cenario.escuro", "Escuro nas bordas", 0, 0.9, 0.05)}
      ${range("cenario.tremor", "Tremor da tela", 0, 1, 0.05)}
    </div>
    ${check("mecanica.efeitos", "Clarões e aberração cromática nos ataques fortes")}
    ${imageField("monstro.fundo", "Imagem de fundo (opcional)")}
    <div class="row" style="margin-top:8px">
      <button class="btn" data-act="scene-reset">Cenário padrão</button>
      ${fase ? `<button class="btn" data-act="scene-phase" title="Grava este cenário na fase escolhida">Salvar na fase “${esc(fase.nome.split(" — ").pop() ?? "")}”</button>` : ""}
    </div>
    <p class="muted">Cada fase de um preset tem o próprio cenário: ao trocar de fase, ele muda junto.</p>`;
}

function viewAlma() {
  const modes = (Object.keys(SOUL_INFO) as SoulMode[])
    .map(
      (m) => `<div class="soul-opt ${cfg.alma.modo === m ? "on" : ""}" data-mode="${m}" title="${esc(SOUL_INFO[m].desc)}">
        <b style="color:${SOUL_INFO[m].cor}">♥ ${SOUL_INFO[m].nome}</b></div>`,
    )
    .join("");
  const color = cfg.alma.cor || SOUL_INFO[cfg.alma.modo].cor;
  return `
    <div class="souls">${modes}</div>
    <p class="muted">${esc(SOUL_INFO[cfg.alma.modo].desc)}</p>
    ${sec(
      "aparencia",
      "Aparência da alma",
      `<div class="row"><label class="shrink" style="margin:0">Cor</label>
        <input type="color" class="shrink" data-path="alma.cor" value="${color}">
        <button class="btn small shrink" data-act="cor-padrao">Cor do modo</button><span></span></div>
      ${imageField("alma.imagem", "Imagem no lugar do coração")}
      <div class="grid2">${range("alma.tamanho", "Tamanho", 0.5, 2, 0.1)}${range("alma.velocidade", "Velocidade", 0.4, 2, 0.1)}</div>`,
    )}
    ${sec(
      "regras",
      "Regras",
      `<div class="grid2">
        ${num("mecanica.hpMax", "HP máximo", 1, 999)}
        ${num("mecanica.invencivel", "Invencível após dano (s)", 0, 5, 0.1)}
        ${num("mecanica.caixaL", "Largura da caixa", 40, 600, 10)}
        ${num("mecanica.caixaA", "Altura da caixa", 40, 180, 10)}
      </div>
      ${range("mecanica.intensidade", "Intensidade geral", 0.5, 2.5, 0.1)}
      ${num("mecanica.danoAtaque", "Dano do LUTAR (acerto perfeito)", 0, 9999)}
      ${check("mecanica.karma", "Karma (KR): cada toque envenena e o HP drena")}
      ${check("mecanica.menuFinal", "Menu LUTAR / AGIR / ITEM / POUPAR no fim do turno")}
      ${check("mecanica.mostrarHitbox", "Mostrar hitboxes (para testar)")}`,
    )}
    ${sec(
      "itens",
      "Itens dos jogadores",
      `<p class="muted">Um por linha: <b>nome | cura | quantidade</b></p>
      <textarea data-items>${esc(cfg.itens.map((i) => `${i.nome} | ${i.cura} | ${i.qtd}`).join("\n"))}</textarea>`,
    )}`;
}

function viewAtaques() {
  const typeOpts = Object.fromEntries(
    (Object.keys(ATTACK_INFO) as AttackType[]).map((t) => [t, ATTACK_INFO[t].nome]),
  );
  const cards = cfg.ataques
    .map((a, i) => {
      const p = `ataques.${i}`;
      const open = openCards.has(i);
      const kindDot = a.tipoDano === "branco" ? "" : `<span class="dot" style="background:${KIND_DOT[a.tipoDano]}" title="${esc(KIND_LABEL[a.tipoDano])}"></span>`;
      return `<div class="card ${open ? "open" : ""}">
        <div class="card-head">
          <span class="num">${i + 1}</span>
          <select data-path="${p}.tipo" data-rerender title="${esc(ATTACK_INFO[a.tipo].desc)}">${Object.entries(typeOpts)
            .map(([k, l]) => `<option value="${k}" ${k === a.tipo ? "selected" : ""}>${l}</option>`)
            .join("")}</select>
          <input type="number" class="dur" data-path="${p}.duracao" data-num min="1" max="60" step="0.5" value="${a.duracao}" title="Duração (s)">
          ${kindDot}
          <button class="btn small" data-act="toggle" data-i="${i}" title="Ajustes">${open ? "▾" : "⚙"}</button>
          <button class="btn small" data-act="up" data-i="${i}" title="Subir">↑</button>
          <button class="btn small" data-act="dup" data-i="${i}" title="Duplicar">⧉</button>
          <button class="btn small" data-act="del" data-i="${i}" title="Remover">✕</button>
        </div>
        ${
          open
            ? `<div class="muted">${ATTACK_INFO[a.tipo].desc}</div>
          <div class="grid2">
            ${range(`${p}.velocidade`, "Velocidade", 0.3, 3, 0.1)}
            ${range(`${p}.densidade`, "Quantidade", 0.3, 3, 0.1)}
          </div>
          <div class="row">
            ${select(`${p}.forma`, "Aparência", SHAPE_LABEL, true)}
            <div class="shrink"><label>Cor</label><input type="color" data-path="${p}.cor" value="${a.cor || "#ffffff"}"></div>
          </div>
          ${a.forma === "emoji" ? text(`${p}.emoji`, "Emoji", "⭐") : ""}
          ${a.forma === "imagem" ? imageField(`${p}.imagem`, "Imagem do projétil") : ""}
          ${select(`${p}.tipoDano`, "Regra do dano", KIND_LABEL)}
          ${sec(
            `atk-mais-${i}`,
            "Mais",
            `<div class="grid2">
              ${num(`${p}.dano`, "Dano / cura", 0, 999)}
              ${num(`${p}.tamanho`, "Tamanho ×", 0.3, 4, 0.1)}
              ${num(`${p}.caixaL`, "Caixa: largura (0 = padrão)", 0, 600, 10)}
              ${num(`${p}.caixaA`, "Caixa: altura (0 = padrão)", 0, 180, 10)}
            </div>
            ${text(`${p}.fala`, "Fala durante este ataque")}`,
          )}`
            : ""
        }
      </div>`;
    })
    .join("");

  const lib = loadLibrary();
  const total =
    cfg.mecanica.ordem === "simultaneo"
      ? Math.max(0, ...cfg.ataques.map((x) => x.duracao))
      : cfg.ataques.reduce((n, x) => n + x.duracao, 0);
  return `
    <div class="row">
      ${select("mecanica.ordem", "Ordem", {
        sequencia: "Um depois do outro",
        simultaneo: "Todos juntos",
        aleatorio: "Sorteia um",
      })}
      <div class="shrink muted" style="padding-top:18px">${total.toFixed(1)}s</div>
    </div>
    ${cards || '<p class="muted">Nenhum ataque ainda.</p>'}
    <div class="row">
      <select id="newType">${Object.entries(typeOpts).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <button class="btn shrink" data-act="add">+ Ataque</button>
    </div>
    ${sec(
      "turnos",
      `Turnos salvos (${lib.length})`,
      `<div class="row"><input type="text" id="turnName" placeholder="Nome (ex.: Fase 2)">
        <button class="btn shrink" data-act="save-turn">Salvar atual</button></div>
      ${lib
        .map(
          (t, i) => `<div class="player"><span class="name" title="${esc(t.nome)}">${esc(t.nome)}</span>
          <span class="muted">${t.ataques.length}×</span>
          <button class="btn small" data-act="load-turn" data-i="${i}">Usar</button>
          <button class="btn small" data-act="del-turn" data-i="${i}">✕</button></div>`,
        )
        .join("")}
      ${lib.length ? '<button class="btn small" data-act="clear-turns" style="margin-top:6px">Limpar lista</button>' : ""}`,
    )}`;
}

function viewSons() {
  const sfx = (Object.keys(SFX_INFO) as SfxName[]).map((k) => audioField(`audio.sons.${k}`, SFX_INFO[k])).join("");
  return `
    ${check("mecanica.sons", "Música e efeitos sonoros ligados")}
    ${sendStatus ? `<div class="status on" id="sendStatus" style="margin-top:6px">${esc(sendStatus)}</div>` : ""}
    ${audioField("audio.musica", "Música (em loop)", true)}
    <div id="previewBox" class="hidden" style="margin-top:6px"></div>
    ${range("audio.volMusica", "Volume da música", 0, 1, 0.05)}
    ${sec("sfx", "Efeitos sonoros", `${sfx}${range("audio.volSons", "Volume dos efeitos", 0, 1, 0.05)}`)}
    ${sec(
      "ajuda-sons",
      "Como usar meus áudios",
      `<p class="muted"><b>📤 Arquivo:</b> mp3 do seu computador (até ${MAX_FILE_MB} MB). Vai para os jogadores pelo Owlbear,
      ~1 MB a cada 10 s, e cada um guarda. Deixe a sala aberta enquanto envia.</p>
      <p class="muted"><b>🔗 YouTube / SoundCloud:</b> cole o link; o player oficial aparece no canto da batalha.</p>
      <p class="muted"><b>🔗 Drive / Dropbox:</b> link de compartilhamento aberto a qualquer pessoa.</p>
      <p class="muted">Spotify não funciona (só prévias de 30 s). Use áudios que você tem direito de usar.</p>`,
    )}`;
}

function viewPresets() {
  const mine = loadMyPresets();
  const list: { p: PresetFile; src: "builtin" | "meu"; i: number }[] =
    presetFilter === "meus"
      ? mine.map((p, i) => ({ p, src: "meu", i }))
      : BUILTIN_PRESETS.map((p, i) => ({ p, src: "builtin" as const, i })).filter(
          (x) => presetFilter === "todos" || x.p.jogo === presetFilter,
        );
  const q = presetSearch.trim().toLowerCase();
  const shown = q ? list.filter((x) => `${x.p.nome} ${x.p.descricao}`.toLowerCase().includes(q)) : list;
  const filters = [
    ["todos", "Todos"],
    ["Undertale", "Undertale"],
    ["Deltarune", "Deltarune"],
    ["Fangame", "Fã"],
    ["meus", `Meus (${mine.length})`],
  ];
  const cards = shown
    .map(({ p, src, i }) => {
      const modos = [...new Set([p.config.alma.modo, ...(p.turnos.map((t) => t.modo).filter(Boolean) as SoulMode[])])];
      const hearts = modos.map((m) => `<span style="color:${SOUL_INFO[m].cor}" title="${esc(SOUL_INFO[m].nome)}">♥</span>`).join("");
      const tags = [p.jogo, `${Math.max(1, p.turnos.length)} fases`, p.config.mecanica.karma ? "KR" : ""].filter(Boolean).join(" · ");
      return `<div class="preset">
        <div class="preset-main"><b>${hearts} ${esc(p.nome)}</b><span class="muted">${esc(p.descricao)}</span>
          <span class="tag">${esc(tags)}</span></div>
        <div class="preset-actions">
          <button class="btn small go" data-act="load-preset" data-src="${src}" data-i="${i}">Carregar</button>
          ${src === "meu" ? `<button class="btn small" data-act="export-preset" data-i="${i}" title="Baixar arquivo">💾</button>
          <button class="btn small" data-act="del-preset" data-i="${i}" title="Apagar">✕</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
  return `
    ${presetStatus ? `<div class="status on">${esc(presetStatus)} ${undoCfg ? '<button class="btn small" data-act="undo-preset">Desfazer</button>' : ""}</div>` : ""}
    <div class="filters">${filters
      .map(([k, l]) => `<button data-filter="${k}" class="${presetFilter === k ? "on" : ""}">${l}</button>`)
      .join("")}</div>
    <input type="text" data-search placeholder="Buscar luta…" value="${esc(presetSearch)}">
    <div class="presets">${cards || '<p class="muted">Nenhum preset aqui ainda.</p>'}</div>
    ${sec(
      "meus",
      "Salvar e compartilhar",
      `<div class="row"><input type="text" id="presetName" placeholder="Nome do preset">
        <button class="btn shrink" data-act="save-preset">Salvar atual</button></div>
      <p class="muted">Guarda tudo (monstro, alma, cenário, sons) com os turnos salvos como fases.</p>
      <div class="row">
        <button class="btn" data-act="open-preset">📂 Abrir arquivo</button>
        <button class="btn" data-act="export-current">💾 Baixar atual</button>
      </div>
      <textarea id="presetJson" class="hidden" style="margin-top:6px;min-height:100px" readonly></textarea>`,
    )}
    <p class="muted">Só moveset (ataques, alma, fases e clima). Paródias aproximadas, sem arte ou falas dos jogos.</p>`;
}

function viewBatalha() {
  const active = !!battle?.ativo;
  const pl = players.filter((p) => p.role !== "GM");
  const rows = pl
    .map((p) => {
      const hp = typeof p.metadata[HP_KEY] === "number" ? (p.metadata[HP_KEY] as number) : cfg.mecanica.hpMax;
      const pct = Math.max(0, Math.min(100, (hp / cfg.mecanica.hpMax) * 100));
      return `<div class="player">
        <input type="checkbox" data-sel="${p.id}" ${selected.has(p.id) ? "checked" : ""} title="Participa">
        <span class="dot" style="background:${p.color}"></span>
        <span class="name">${esc(p.name)}</span>
        <div class="hpbar" title="${hp}/${cfg.mecanica.hpMax}"><div style="width:${pct}%"></div></div>
        <button class="btn small" data-hp="${p.id}" data-d="-5">−5</button>
        <button class="btn small" data-hp="${p.id}" data-d="5">+5</button>
        <button class="btn small" data-hp="${p.id}" data-d="max" title="Curar">♥</button>
      </div>`;
    })
    .join("");
  const mhp = battle?.monstroHp ?? cfg.monstro.hp;
  return `
    <div class="hero">
      <div class="hero-title">${esc(cfg.monstro.nome || "Monstro")}
        <span class="muted">${active ? `turno ${battle?.numero ?? 1}` : "fora de batalha"}</span></div>
      ${
        cfg.monstro.hp > 0
          ? `<div class="player"><div class="hpbar wide"><div style="width:${Math.max(0, Math.min(100, (mhp / cfg.monstro.hp) * 100))}%;background:#20e020"></div></div>
            <span class="muted">${mhp}/${cfg.monstro.hp}</span>
            ${active ? `<button class="btn small" data-act="mhp" data-d="-10">−10</button><button class="btn small" data-act="mhp" data-d="10">+10</button><button class="btn small" data-act="mhp" data-d="max" title="Restaurar">♥</button>` : ""}</div>`
          : ""
      }
      ${phaseSelect()}
      <button class="btn big go" data-act="start">▶ ${active ? "Próximo turno" : "Iniciar batalha"}</button>
      <div class="row">
        <button class="btn" data-act="test" title="Abre a batalha só para você, com a barra do mestre">🧪 Testar</button>
        <button class="btn" data-act="watch" ${active ? "" : "disabled"}>👁 Assistir</button>
        <button class="btn stop" data-act="end" ${active ? "" : "disabled"}>■ Encerrar</button>
      </div>
    </div>
    ${sec(
      "jogadores",
      `Jogadores (${pl.length})`,
      `${rows || '<p class="muted">Nenhum jogador conectado.</p>'}
      <p class="muted">Marque quem entra (nenhum marcado = todos).</p>
      <div class="row">
        <button class="btn" data-act="heal-all">♥ Curar todos</button>
        <button class="btn" data-act="reset-items">🎒 Repor itens</button>
      </div>`,
      true,
    )}
    ${sec(
      "acoes",
      "Ações e respostas",
      `<div class="row" style="margin-bottom:6px"><input type="text" id="replyText" placeholder="Responder na caixa (Enter)">
        <button class="btn shrink" data-act="reply">Enviar</button></div>
      <div class="log">${log.length ? log.map((l) => `<div>${esc(l)}</div>`).join("") : '<span class="muted">LUTAR / AGIR / ITEM / POUPAR aparecem aqui.</span>'}</div>`,
      true,
    )}`;
}

function phaseSelect() {
  phaseIdx = getPhaseIdx();
  const lib = loadLibrary();
  if (!lib.length) return "";
  return `<div class="row phase"><select data-phase title="Fase do próximo turno">
      <option value="-1" ${phaseIdx < 0 ? "selected" : ""}>Fase: como está nas abas</option>
      ${lib.map((t, i) => `<option value="${i}" ${i === phaseIdx ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}
    </select><button class="btn shrink" data-act="next-phase" title="Próxima fase">⏭</button></div>`;
}

function render() {
  const tabs = [
    ["batalha", "⚔ Batalha"],
    ["presets", "★ Presets"],
    ["monstro", "☻ Monstro"],
    ["cenario", "◐ Cenário"],
    ["alma", "♥ Alma"],
    ["ataques", "✦ Ataques"],
    ["sons", "♪ Sons"],
  ];
  const body =
    tab === "monstro" ? viewMonstro()
    : tab === "cenario" ? viewCenario()
    : tab === "alma" ? viewAlma()
    : tab === "ataques" ? viewAtaques()
    : tab === "sons" ? viewSons()
    : tab === "presets" ? viewPresets()
    : viewBatalha();
  const scroll = window.scrollY;
  app.innerHTML = `
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="body">${body}</div>`;
  window.scrollTo(0, scroll);
}

// ---------- eventos ----------
app.addEventListener(
  "toggle",
  (e) => {
    const d = e.target as HTMLDetailsElement;
    const id = d.dataset?.sec;
    if (!id) return;
    if (d.open) {
      openSecs.add(id);
      closedSecs.delete(id);
    } else {
      openSecs.delete(id);
      closedSecs.add(id);
    }
  },
  true,
);
app.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.search !== undefined) {
    presetSearch = el.value;
    const pos = el.selectionStart;
    render();
    const again = app.querySelector<HTMLInputElement>("[data-search]");
    again?.focus();
    if (again && pos !== null) again.setSelectionRange(pos, pos);
    return;
  }
  if (el.dataset.lines) {
    setPath(el.dataset.lines, el.value.split("\n").map((l) => l.trim()).filter(Boolean));
    save();
    return;
  }
  if (el.dataset.items !== undefined) {
    cfg.itens = el.value
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .filter((p) => p[0])
      .map(([nome, cura, qtd]) => ({ nome, cura: Number(cura) || 0, qtd: Math.max(1, Number(qtd) || 1) }));
    save();
    return;
  }
  const path = el.dataset.path;
  if (!path) return;
  let v: unknown = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.num !== undefined) v = Number(el.value) || 0;
  setPath(path, v);
  const out = app.querySelector(`[data-out="${path}"]`);
  if (out) out.textContent = fmt(path, Number(v));
  save();
});
app.addEventListener("change", (e) => {
  const el = e.target as HTMLElement;
  if (el.dataset.rerender !== undefined || el.dataset.rerenderBlur !== undefined) {
    if (el.dataset.path?.endsWith(".tipo")) {
      const i = Number(el.dataset.path.split(".")[1]);
      const tipo = (el as HTMLSelectElement).value as AttackType;
      const d = defaultAttack(tipo);
      cfg.ataques[i].forma = d.forma;
    }
    render();
  }
  if (el.dataset.audio) {
    const path = el.dataset.audio;
    const v = (el as HTMLSelectElement).value;
    if (v === "__url") {
      urlMode.add(path);
      if (audioFiles.includes(String(getPath(path))) || ["", "nenhuma"].includes(String(getPath(path)))) setPath(path, "");
    } else {
      urlMode.delete(path);
      setPath(path, v);
    }
    save();
    render();
  }
  if (el.dataset.phase !== undefined) {
    phaseIdx = Number((el as HTMLSelectElement).value);
    setPhaseIdx(phaseIdx);
    const t = loadLibrary()[phaseIdx];
    if (t) {
      applyTurn(t);
      save();
    }
    render();
    return;
  }
  if (el.dataset.sel) {
    const id = el.dataset.sel;
    (el as HTMLInputElement).checked ? selected.add(id) : selected.delete(id);
  }
});

app.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-tab],[data-act],[data-mode],[data-token],[data-hp],[data-preview],[data-upload],[data-filter]",
  );
  if (!el) return;
  if (el.dataset.preview) {
    preview(el.dataset.preview);
    return;
  }
  if (el.dataset.upload) {
    pickFile(el.dataset.upload);
    return;
  }
  if (el.dataset.filter) {
    presetFilter = el.dataset.filter as typeof presetFilter;
    render();
    return;
  }
  if (el.dataset.tab) {
    tab = el.dataset.tab as typeof tab;
    render();
    return;
  }
  if (el.dataset.mode) {
    cfg.alma.modo = el.dataset.mode as SoulMode;
    cfg.alma.cor = "";
    save();
    render();
    return;
  }
  if (el.dataset.token) {
    const url = await selectedTokenImage();
    if (url) {
      setPath(el.dataset.token, url);
      save();
      render();
    } else OBR.notification.show("Selecione um token com imagem no mapa primeiro.", "WARNING");
    return;
  }
  if (el.dataset.hp) {
    const id = el.dataset.hp;
    const p = players.find((x) => x.id === id);
    const cur = typeof p?.metadata[HP_KEY] === "number" ? (p.metadata[HP_KEY] as number) : cfg.mecanica.hpMax;
    const d = el.dataset.d!;
    setHp([id], d === "max" ? "max" : cur + Number(d));
    return;
  }
  const i = Number(el.dataset.i);
  switch (el.dataset.act) {
    case "cor-padrao":
      cfg.alma.cor = "";
      break;
    case "toggle":
      openCards.has(i) ? openCards.delete(i) : openCards.add(i);
      break;
    case "up":
      if (i > 0) [cfg.ataques[i - 1], cfg.ataques[i]] = [cfg.ataques[i], cfg.ataques[i - 1]];
      break;
    case "dup":
      cfg.ataques.splice(i + 1, 0, structuredClone(cfg.ataques[i]));
      break;
    case "del":
      cfg.ataques.splice(i, 1);
      openCards.delete(i);
      break;
    case "add": {
      const t = (document.getElementById("newType") as HTMLSelectElement).value as AttackType;
      cfg.ataques.push(defaultAttack(t));
      openCards = new Set([cfg.ataques.length - 1]);
      break;
    }
    case "save-turn": {
      const name = (document.getElementById("turnName") as HTMLInputElement).value.trim() || `Turno ${loadLibrary().length + 1}`;
      const lib = loadLibrary();
      lib.push({
        nome: name,
        fala: cfg.monstro.fala,
        ordem: cfg.mecanica.ordem,
        ataques: structuredClone(cfg.ataques),
        modo: cfg.alma.modo,
        intensidade: cfg.mecanica.intensidade,
        cenario: structuredClone(cfg.cenario),
      });
      saveLibrary(lib);
      break;
    }
    case "load-turn": {
      const t = loadLibrary()[i];
      if (t) {
        applyTurn(t);
        phaseIdx = i;
        setPhaseIdx(phaseIdx);
        if (inOBR) OBR.notification.show(`Turno "${t.nome}" carregado.`, "SUCCESS");
      }
      break;
    }
    case "del-turn": {
      const lib = loadLibrary();
      lib.splice(i, 1);
      saveLibrary(lib);
      break;
    }
    case "start":
      return startTurn();
    case "scene-reset":
      cfg.cenario = defaultCenario();
      break;
    case "scene-phase": {
      const lib = loadLibrary();
      if (phaseIdx >= 0 && lib[phaseIdx]) {
        lib[phaseIdx].cenario = structuredClone(cfg.cenario);
        saveLibrary(lib);
        notify("Cenário salvo nesta fase.", "SUCCESS");
      }
      return;
    }
    case "clear-turns":
      saveLibrary([]);
      phaseIdx = -1;
      setPhaseIdx(-1);
      break;
    case "next-phase": {
      const lib = loadLibrary();
      if (!lib.length) return;
      phaseIdx = (phaseIdx + 1) % lib.length;
      setPhaseIdx(phaseIdx);
      applyTurn(lib[phaseIdx]);
      break;
    }
    case "load-preset": {
      const p = el.dataset.src === "meu" ? loadMyPresets()[i] : BUILTIN_PRESETS[i];
      if (p) loadPreset(p, el.dataset.src === "meu");
      break;
    }
    case "undo-preset":
      if (undoCfg) {
        cfg = undoCfg;
        undoCfg = null;
        presetStatus = "Preset desfeito.";
      }
      break;
    case "save-preset": {
      const nome = (document.getElementById("presetName") as HTMLInputElement).value.trim() || cfg.monstro.nome || "Meu preset";
      const mine = loadMyPresets().filter((x) => x.nome !== nome);
      mine.unshift(currentAsPreset(nome));
      saveMyPresets(mine);
      presetFilter = "meus";
      presetStatus = `Preset "${nome}" salvo neste navegador.`;
      undoCfg = null;
      break;
    }
    case "del-preset": {
      const mine = loadMyPresets();
      mine.splice(i, 1);
      saveMyPresets(mine);
      break;
    }
    case "export-preset": {
      const p = loadMyPresets()[i];
      if (p) downloadPreset(p);
      return;
    }
    case "export-current":
      downloadPreset(currentAsPreset(cfg.monstro.nome || "preset"));
      return;
    case "open-preset":
      openPresetFile();
      return;
    case "watch":
      return openModal(BATTLE_URL);
    case "test":
      await save(true);
      return openModal(`${BATTLE_URL}?teste=1`);
    case "end":
      if (inOBR) await OBR.room.setMetadata({ [BATTLE_KEY]: { ...(battle ?? {}), ativo: false } });
      return;
    case "heal-all":
      return setHp([], "max");
    case "reply":
      return sendReply();
    case "reset-items":
      if (inOBR) {
        OBR.broadcast.sendMessage(CH_ITEMS_RESET, {}, { destination: "REMOTE" });
        OBR.notification.show("Itens dos jogadores repostos.", "SUCCESS");
      }
      return;
    case "mhp": {
      if (!inOBR || !battle?.ativo) return;
      const d = el.dataset.d!;
      const atual = battle.monstroHp ?? cfg.monstro.hp;
      const novo = d === "max" ? cfg.monstro.hp : Math.max(0, Math.min(cfg.monstro.hp, atual + Number(d)));
      await OBR.room.setMetadata({ [BATTLE_KEY]: { ...battle, monstroHp: novo } });
      return;
    }
    case "export": {
      const ta = document.getElementById("json") as HTMLTextAreaElement;
      ta.classList.remove("hidden");
      ta.value = JSON.stringify(cfg, null, 1);
      ta.select();
      try {
        await navigator.clipboard.writeText(ta.value);
        if (inOBR) OBR.notification.show("JSON copiado.", "SUCCESS");
      } catch {
        /* o usuário copia manualmente */
      }
      return;
    }
    case "import": {
      const ta = document.getElementById("json") as HTMLTextAreaElement;
      ta.classList.remove("hidden");
      ta.value = "";
      ta.placeholder = "Cole aqui o JSON exportado";
      document.getElementById("jsonApply")!.classList.remove("hidden");
      return;
    }
    case "apply-json": {
      try {
        cfg = normalizeConfig(JSON.parse((document.getElementById("json") as HTMLTextAreaElement).value));
      } catch {
        if (inOBR) OBR.notification.show("JSON inválido.", "ERROR");
        return;
      }
      break;
    }
    default:
      return;
  }
  save();
  render();
});

// ---------- enviar arquivo ----------
function pickFile(path: string) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/*,.mp3,.ogg,.wav,.m4a";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      notify(`Arquivo grande demais (máximo ${MAX_FILE_MB} MB). Tente um mp3 com qualidade menor.`, "WARNING");
      return;
    }
    const data = await f.arrayBuffer();
    const hash = await hashFile(data);
    await putFile({ hash, name: f.name, type: f.type || "audio/mpeg", data });
    const value = fileValue(hash, f.name);
    rememberUpload(value, f.name);
    urlMode.delete(path);
    setPath(path, value);
    save();
    if (inOBR) OBR.broadcast.sendMessage(CH_FILE_PUSH, { hash }, { destination: "LOCAL" });
    sendStatus = `Enviando ${f.name} para os jogadores…`;
    render();
  };
  input.click();
}

function notify(msg: string, variant: "INFO" | "WARNING" | "ERROR" | "SUCCESS" = "INFO") {
  if (inOBR) OBR.notification.show(msg, variant);
  else console.log(msg);
}

// ---------- prévia de áudio ----------
let previewMusic: MusicPlayer | null = null;
let previewTimer = 0;
function stopPreview() {
  clearTimeout(previewTimer);
  previewMusic?.stop();
  previewMusic = null;
  document.getElementById("previewBox")?.classList.add("hidden");
}
async function preview(path: string) {
  const wasPlaying = !!previewMusic;
  stopPreview();
  if (path === "audio.musica") {
    if (wasPlaying) return; // segundo clique para a prévia
    const box = document.getElementById("previewBox")!;
    box.classList.remove("hidden");
    previewMusic = new MusicPlayer();
    previewMusic.play(cfg.audio, { embedBox: box, onStatus: (m) => m && notify(m, "WARNING") });
    previewMusic.resume();
    previewTimer = window.setTimeout(stopPreview, 20000);
    return;
  }
  const src = parseSource(String(getPath(path) ?? ""));
  if (src.kind === "arquivo") await fileUrl(src.hash);
  new Sfx(true, cfg.audio).play(path.split(".").pop() as SfxName);
}

fetch(`${import.meta.env.BASE_URL}audio/lista.json`)
  .then((r) => (r.ok ? r.json() : []))
  .then((l: string[]) => {
    audioFiles = Array.isArray(l) ? l : [];
    if (tab === "sons") render();
  })
  .catch(() => {});

// ---------- ações ----------
async function selectedTokenImage(): Promise<string | null> {
  if (!inOBR) return null;
  const sel = await OBR.player.getSelection();
  if (!sel?.length) return null;
  const items = await OBR.scene.items.getItems(sel);
  const img = items.find(isImage);
  return img ? img.image.url : null;
}

async function startTurn() {
  if (!cfg.ataques.length) {
    if (inOBR) OBR.notification.show("Adicione pelo menos um ataque.", "WARNING");
    tab = "ataques";
    render();
    return;
  }
  const st: BattleState = newBattleState(cfg, battle, [...selected]);
  if (!inOBR) return;
  await OBR.room.setMetadata({ [CONFIG_KEY]: cfg, [BATTLE_KEY]: st });
  openModal(BATTLE_URL);
}

function openModal(url: string) {
  if (!inOBR) {
    window.open(url, "_blank");
    return;
  }
  OBR.modal.open({ id: MODAL_ID, url, fullScreen: true, hidePaper: true });
}

function sendReply() {
  const el = document.getElementById("replyText") as HTMLInputElement | null;
  const texto = el?.value.trim();
  if (!texto) return;
  if (inOBR) OBR.broadcast.sendMessage(CH_REPLY, { texto }, { destination: "ALL" });
  pushLog(`Mestre: ${texto}`);
  if (el) el.value = "";
}
app.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).id === "replyText" && e.key === "Enter") sendReply();
});

function setHp(alvo: string[], hp: number | "max") {
  if (!inOBR) return;
  OBR.broadcast.sendMessage(CH_HP, { alvo, hp, hpMax: cfg.mecanica.hpMax }, { destination: "REMOTE" });
}

// ---------- presets ----------
function applyTurn(t: SavedTurn) {
  applyTurnTo(cfg, t);
}

/** Carrega um preset. Os prontos mantêm sons, itens e regras dos jogadores do mestre. */
function loadPreset(p: PresetFile, full: boolean) {
  undoCfg = structuredClone(cfg);
  const pc = normalizeConfig(structuredClone(p.config));
  if (full) cfg = pc;
  else {
    cfg = {
      ...cfg,
      monstro: pc.monstro,
      alma: { ...cfg.alma, modo: pc.alma.modo },
      mecanica: {
        ...cfg.mecanica,
        caixaL: pc.mecanica.caixaL,
        caixaA: pc.mecanica.caixaA,
        ordem: pc.mecanica.ordem,
        intensidade: pc.mecanica.intensidade,
        karma: pc.mecanica.karma,
      },
      cenario: pc.cenario,
      ataques: pc.ataques,
    };
  }
  // as fases do preset entram no topo da lista de turnos salvos
  const prefix = `${p.nome} — `;
  const lib = loadLibrary().filter((t) => !t.nome.startsWith(prefix));
  saveLibrary([...p.turnos.map((t) => ({ ...structuredClone(t), nome: prefix + t.nome })), ...lib]);
  phaseIdx = p.turnos.length ? 0 : -1;
  setPhaseIdx(phaseIdx);
  presetStatus = `"${p.nome}" carregado${p.turnos.length ? ` com ${p.turnos.length} fase(s) — escolha a fase na aba Batalha` : ""}.`;
  openCards = new Set();
}

function currentAsPreset(nome: string): PresetFile {
  return {
    formato: PRESET_FORMAT,
    versao: 1,
    nome,
    descricao: `${cfg.monstro.nome} • ${cfg.ataques.length} ataque(s)`,
    config: structuredClone(cfg),
    turnos: loadLibrary(),
  };
}

function loadMyPresets(): PresetFile[] {
  try {
    const raw = JSON.parse(localStorage.getItem("batalha-presets") || "[]");
    return Array.isArray(raw) ? (raw.map(parsePreset).filter(Boolean) as PresetFile[]) : [];
  } catch {
    return [];
  }
}
function saveMyPresets(list: PresetFile[]) {
  try {
    localStorage.setItem("batalha-presets", JSON.stringify(list));
  } catch {
    notify("Não deu para salvar: o armazenamento do navegador está cheio.", "ERROR");
  }
}

function downloadPreset(p: PresetFile) {
  const json = JSON.stringify(p, null, 1);
  const ta = document.getElementById("presetJson") as HTMLTextAreaElement | null;
  if (ta) {
    ta.classList.remove("hidden");
    ta.value = json;
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${p.nome.replace(/[^\w\- ]+/g, "").trim() || "preset"}.batalha.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    /* o texto fica na caixa abaixo para copiar */
  }
  notify("Preset gerado. Se o download não começar, copie o texto da caixa.", "INFO");
}

function openPresetFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    let p: PresetFile | null = null;
    try {
      p = parsePreset(JSON.parse(await f.text()));
    } catch {
      p = null;
    }
    if (!p) {
      notify("Esse arquivo não é um preset da Batalha da Alma.", "ERROR");
      return;
    }
    const mine = loadMyPresets().filter((x) => x.nome !== p!.nome);
    mine.unshift(p);
    saveMyPresets(mine);
    loadPreset(p, true);
    presetFilter = "meus";
    save();
    render();
  };
  input.click();
}

function pushLog(line: string) {
  const t = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  log.unshift(`${t}  ${line}`);
  log.length = Math.min(log.length, 40);
  if (tab === "batalha") render();
}

// ---------- jogador ----------
async function renderPlayer() {
  const meta = await OBR.player.getMetadata();
  const room = await OBR.room.getMetadata();
  const id = await OBR.player.getId();
  const st = room[BATTLE_KEY] as BattleState | undefined;
  const c = normalizeConfig(st?.config ?? room[CONFIG_KEY]);
  const hp = typeof meta[HP_KEY] === "number" ? (meta[HP_KEY] as number) : c.mecanica.hpMax;
  const inBattle = !!st?.ativo && (!st.participantes?.length || st.participantes.includes(id));
  app.innerHTML = `
    <h1><span class="heart">♥</span> Batalha da Alma</h1>
    <div class="status ${inBattle ? "on" : ""}">${inBattle ? "● Você está numa batalha!" : "○ Nenhuma batalha para você agora"}</div>
    <h2>Seu HP</h2>
    <div class="player"><div class="hpbar" style="width:200px"><div style="width:${(hp / c.mecanica.hpMax) * 100}%"></div></div>
      <span>${hp} / ${c.mecanica.hpMax}</span></div>
    <button class="btn big go" id="openBattle" ${inBattle ? "" : "disabled"}>Abrir batalha</button>
    <h2>Controles</h2>
    <p class="muted">Setas ou WASD movem a alma. Shift deixa mais lento. Z/Espaço/Cima pulam (alma azul).
    Também dá para arrastar com o mouse ou o dedo. Se o teclado não responder, clique na tela da batalha.</p>`;
  document.getElementById("openBattle")!.onclick = () => openModal(BATTLE_URL);
}

// ---------- início ----------
async function init() {
  if (!inOBR) {
    render();
    return;
  }
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    renderPlayer();
    OBR.room.onMetadataChange(renderPlayer);
    OBR.player.onChange(renderPlayer);
    return;
  }
  const room = await OBR.room.getMetadata();
  cfg = normalizeConfig(room[CONFIG_KEY]);
  battle = (room[BATTLE_KEY] as BattleState) ?? null;
  if (battle?.participantes) selected = new Set(battle.participantes);
  players = await OBR.party.getPlayers();
  render();

  OBR.room.onMetadataChange((m) => {
    const was = JSON.stringify([battle?.ativo, battle?.monstroHp, battle?.numero]);
    battle = (m[BATTLE_KEY] as BattleState) ?? null;
    const now = JSON.stringify([battle?.ativo, battle?.monstroHp, battle?.numero]);
    if (tab === "batalha" && was !== now && !(document.activeElement instanceof HTMLTextAreaElement)) render();
  });
  OBR.party.onChange((p) => {
    players = p;
    if (tab === "batalha") render();
  });
  OBR.broadcast.onMessage(CH_ACTION, (ev) => pushLog(describeAction(ev.data as ActionMsg)));
  OBR.broadcast.onMessage(CH_EVENT, (ev) => {
    const d = ev.data as { tipo: string; nome: string };
    if (d.tipo === "morte") pushLog(`💔 A alma de ${d.nome} se partiu.`);
  });
  OBR.broadcast.onMessage(CH_FILE_PROGRESS, (ev) => {
    const d = ev.data as ProgressMsg;
    if (!d.sending) return;
    sendStatus =
      d.done >= d.total
        ? "✓ Áudio enviado para os jogadores conectados."
        : `Enviando áudio para os jogadores… ${Math.round((d.done / d.total) * 100)}%`;
    const el = document.getElementById("sendStatus");
    if (el) el.textContent = sendStatus;
    else if (tab === "sons") render();
  });
}

if (inOBR) OBR.onReady(init);
else init();
