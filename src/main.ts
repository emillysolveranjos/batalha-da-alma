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
  CONFIG_KEY,
  HP_KEY,
  MODAL_ID,
  SFX_INFO,
  SOUL_INFO,
  SavedTurn,
  SfxName,
  SoulMode,
  defaultAttack,
  defaultConfig,
  normalizeConfig,
  resolveAudioUrl,
} from "./shared";
import { ChipMusic, Sfx } from "./audio";

const app = document.getElementById("app")!;
const BATTLE_URL = `${import.meta.env.BASE_URL}battle.html`;
const inOBR = OBR.isAvailable;

let cfg: BattleConfig = defaultConfig();
let battle: BattleState | null = null;
let players: Player[] = [];
let tab: "monstro" | "alma" | "ataques" | "sons" | "batalha" = "batalha";
let audioFiles: string[] = [];
const urlMode = new Set<string>();
let selected = new Set<string>();
let openCards = new Set<number>([0]);
const log: string[] = [];

const KIND_LABEL: Record<BulletKind, string> = {
  branco: "Branco — sempre fere",
  azul: "Azul — fere se você se MOVER",
  laranja: "Laranja — fere se você ficar PARADO",
  verde: "Verde — cura ao tocar",
};
const SHAPE_LABEL: Record<BulletShape, string> = {
  circulo: "Círculo",
  quadrado: "Quadrado",
  diamante: "Diamante",
  estrela: "Estrela",
  osso: "Osso",
  seta: "Seta / lança",
  emoji: "Emoji",
  imagem: "Imagem (URL)",
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
const fmt = (path: string, v: number) => (path.includes(".vol") ? `${Math.round(v * 100)}%` : `${v.toFixed(1)}×`);
function range(path: string, label: string, min: number, max: number, step: number) {
  const v = Number(getPath(path));
  return `<div><label>${label}: <b data-out="${path}">${fmt(path, v)}</b></label><input type="range" data-path="${path}" data-num min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
}
function audioField(path: string, label: string, music = false) {
  const v = String(getPath(path) ?? "");
  const special: Record<string, string> = music
    ? { "": "♪ Música original (padrão)", nenhuma: "Sem música" }
    : { "": "Som padrão (sintetizado)" };
  const isUrl = urlMode.has(path) || (!(v in special) && !audioFiles.includes(v));
  const opts = [
    ...Object.entries(special).map(([k, l]) => [k, l]),
    ...audioFiles.map((f) => [f, `📁 ${f.replace(/^audio\//, "")}`]),
    ["__url", "🔗 Link (URL)…"],
  ];
  const cur = isUrl ? "__url" : v;
  return `<label>${label}</label>
    <div class="row"><select data-audio="${path}">${opts
      .map(([k, l]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(l)}</option>`)
      .join("")}</select><button class="btn shrink" data-preview="${path}" title="Ouvir">▶</button></div>
    ${isUrl ? `<input type="text" style="margin-top:4px" data-path="${path}" value="${esc(v)}" placeholder="https://…/arquivo.mp3">` : ""}`;
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
function viewMonstro() {
  return `
    ${text("monstro.nome", "Nome do monstro / personagem")}
    ${imageField("monstro.imagem", "Aparência (URL da imagem ou token selecionado)")}
    ${range("monstro.escala", "Tamanho na tela", 0.3, 2, 0.1)}
    ${area("monstro.fala", "Fala no balão", "* Você não vai passar daqui.")}
    ${imageField("monstro.fundo", "Fundo da batalha (opcional)")}
    <p class="muted">Dica: selecione um token no mapa e clique em <b>Token</b> para usar a arte dele.</p>`;
}

function viewAlma() {
  const modes = (Object.keys(SOUL_INFO) as SoulMode[])
    .map(
      (m) => `<div class="soul-opt ${cfg.alma.modo === m ? "on" : ""}" data-mode="${m}">
        <b style="color:${SOUL_INFO[m].cor}">♥ ${SOUL_INFO[m].nome}</b><span class="muted">${SOUL_INFO[m].desc}</span></div>`,
    )
    .join("");
  const color = cfg.alma.cor || SOUL_INFO[cfg.alma.modo].cor;
  return `
    <h2>Mecânica da alma</h2>
    <div class="souls">${modes}</div>
    <h2>Aparência da alma</h2>
    <div class="row"><label class="shrink" style="margin:0">Cor</label>
      <input type="color" class="shrink" data-path="alma.cor" value="${color}">
      <button class="btn small shrink" data-act="cor-padrao">Cor do modo</button><span></span></div>
    ${imageField("alma.imagem", "Imagem no lugar do coração (opcional)")}
    <div class="grid2">${range("alma.tamanho", "Tamanho", 0.5, 2, 0.1)}${range("alma.velocidade", "Velocidade", 0.4, 2, 0.1)}</div>
    <h2>Regras</h2>
    <div class="grid2">
      ${num("mecanica.hpMax", "HP máximo", 1, 999)}
      ${num("mecanica.invencivel", "Invencível após dano (s)", 0, 5, 0.1)}
      ${num("mecanica.caixaL", "Largura da caixa", 40, 600, 10)}
      ${num("mecanica.caixaA", "Altura da caixa", 40, 180, 10)}
    </div>
    ${range("mecanica.intensidade", "Intensidade geral (fases do chefe)", 0.5, 2.5, 0.1)}
    ${check("mecanica.menuFinal", "Mostrar LUTAR / AGIR / ITEM / POUPAR no fim do turno")}
    ${check("mecanica.sons", "Efeitos sonoros")}
    ${check("mecanica.mostrarHitbox", "Mostrar hitboxes (para testar)")}`;
}

function viewAtaques() {
  const typeOpts = Object.fromEntries(
    (Object.keys(ATTACK_INFO) as AttackType[]).map((t) => [t, ATTACK_INFO[t].nome]),
  );
  const cards = cfg.ataques
    .map((a, i) => {
      const p = `ataques.${i}`;
      const open = openCards.has(i);
      return `<div class="card">
        <div class="card-head">
          <span class="num">${i + 1}</span>
          <select data-path="${p}.tipo" data-rerender>${Object.entries(typeOpts)
            .map(([k, l]) => `<option value="${k}" ${k === a.tipo ? "selected" : ""}>${l}</option>`)
            .join("")}</select>
          <button class="btn small" data-act="toggle" data-i="${i}">${open ? "▾" : "▸"}</button>
          <button class="btn small" data-act="up" data-i="${i}" title="Subir">↑</button>
          <button class="btn small" data-act="dup" data-i="${i}" title="Duplicar">⧉</button>
          <button class="btn small" data-act="del" data-i="${i}" title="Remover">✕</button>
        </div>
        <div class="muted">${ATTACK_INFO[a.tipo].desc} • ${a.duracao}s</div>
        <div class="${open ? "" : "hidden"}">
          <div class="grid3">
            ${num(`${p}.duracao`, "Duração (s)", 1, 60, 0.5)}
            ${num(`${p}.dano`, "Dano / cura", 0, 999)}
            ${num(`${p}.tamanho`, "Tamanho ×", 0.3, 4, 0.1)}
          </div>
          <div class="grid2">
            ${range(`${p}.velocidade`, "Velocidade", 0.3, 3, 0.1)}
            ${range(`${p}.densidade`, "Quantidade", 0.3, 3, 0.1)}
          </div>
          ${select(`${p}.tipoDano`, "Cor / regra do dano", KIND_LABEL)}
          <div class="row">
            ${select(`${p}.forma`, "Aparência do projétil", SHAPE_LABEL, true)}
            <div class="shrink"><label>Cor</label><input type="color" data-path="${p}.cor" value="${a.cor || "#ffffff"}"></div>
          </div>
          ${a.forma === "emoji" ? text(`${p}.emoji`, "Emoji", "⭐") : ""}
          ${a.forma === "imagem" ? imageField(`${p}.imagem`, "Imagem do projétil") : ""}
          ${text(`${p}.fala`, "Fala durante este ataque (opcional)")}
          <div class="grid2">
            ${num(`${p}.caixaL`, "Caixa: largura (0 = padrão)", 0, 600, 10)}
            ${num(`${p}.caixaA`, "Caixa: altura (0 = padrão)", 0, 180, 10)}
          </div>
        </div>
      </div>`;
    })
    .join("");

  const lib = loadLibrary();
  return `
    ${select("mecanica.ordem", "Como os ataques do turno rodam", {
      sequencia: "Em sequência (um depois do outro)",
      simultaneo: "Todos ao mesmo tempo",
      aleatorio: "Sorteia um deles",
    })}
    ${cards || '<p class="muted">Nenhum ataque. Adicione um abaixo.</p>'}
    <div class="row">
      <select id="newType">${Object.entries(typeOpts).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <button class="btn shrink" data-act="add">+ Adicionar ataque</button>
    </div>
    <h2>Turnos salvos</h2>
    <p class="muted">Monte as fases da luta antes da sessão e carregue cada uma na hora.</p>
    <div class="row"><input type="text" id="turnName" placeholder="Nome do turno (ex.: Fase 2)">
      <button class="btn shrink" data-act="save-turn">Salvar</button></div>
    ${lib
      .map(
        (t, i) => `<div class="player"><span class="name">${esc(t.nome)} <span class="muted">(${t.ataques.length} ataques)</span></span>
        <button class="btn small" data-act="load-turn" data-i="${i}">Carregar</button>
        <button class="btn small" data-act="del-turn" data-i="${i}">✕</button></div>`,
      )
      .join("")}`;
}

function viewSons() {
  const sfx = (Object.keys(SFX_INFO) as SfxName[]).map((k) => audioField(`audio.sons.${k}`, SFX_INFO[k])).join("");
  return `
    ${check("mecanica.sons", "Ativar música e efeitos sonoros")}
    <h2>Música da batalha</h2>
    ${audioField("audio.musica", "Faixa (toca em loop)", true)}
    ${range("audio.volMusica", "Volume da música", 0, 1, 0.05)}
    <h2>Efeitos</h2>
    ${sfx}
    ${range("audio.volSons", "Volume dos efeitos", 0, 1, 0.05)}
    <h2>Usar seus próprios mp3</h2>
    <p class="muted"><b>Arquivos do repositório:</b> envie os .mp3 para a pasta <code>public/audio</code> do repositório no GitHub
    (Add file → Upload files). Cerca de 1 minuto depois, eles aparecem nas listas acima com 📁.</p>
    <p class="muted"><b>Link:</b> escolha “Link (URL)” e cole um endereço direto para um .mp3 que qualquer pessoa consiga abrir.</p>
    <p class="muted">Use apenas áudios que você tem direito de usar.</p>`;
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
        <div class="hpbar"><div style="width:${pct}%"></div></div>
        <span class="muted" style="width:52px;text-align:right">${hp}/${cfg.mecanica.hpMax}</span>
        <button class="btn small" data-hp="${p.id}" data-d="-5">−5</button>
        <button class="btn small" data-hp="${p.id}" data-d="5">+5</button>
        <button class="btn small" data-hp="${p.id}" data-d="max">♥</button>
      </div>`;
    })
    .join("");
  return `
    <div class="status ${active ? "on" : ""}">${active ? "● Batalha em andamento" : "○ Nenhuma batalha ativa"}</div>
    <button class="btn big go" data-act="start">▶ ${active ? "Próximo turno" : "Iniciar batalha"}</button>
    <div class="row">
      <button class="btn" data-act="watch" ${active ? "" : "disabled"}>👁 Assistir</button>
      <button class="btn" data-act="test">🧪 Testar sozinho</button>
      <button class="btn stop" data-act="end" ${active ? "" : "disabled"}>■ Encerrar</button>
    </div>
    <p class="muted">“Próximo turno” usa o que estiver nas abas agora (monstro, alma e ataques). Mude entre os turnos para criar fases.</p>
    <h2>Jogadores</h2>
    <p class="muted">Marque quem entra na batalha (nenhum marcado = todos).</p>
    ${rows || '<p class="muted">Nenhum jogador conectado.</p>'}
    <button class="btn" style="margin-top:6px" data-act="heal-all">♥ Curar todos</button>
    <h2>Ações dos jogadores</h2>
    <div class="log">${log.length ? log.map((l) => `<div>${esc(l)}</div>`).join("") : '<span class="muted">As escolhas (LUTAR/AGIR/ITEM/POUPAR) aparecem aqui.</span>'}</div>
    <h2>Backup</h2>
    <div class="row"><button class="btn" data-act="export">Exportar JSON</button><button class="btn" data-act="import">Importar JSON</button></div>
    <textarea id="json" class="hidden" style="margin-top:6px;min-height:120px"></textarea>
    <button class="btn hidden" id="jsonApply" data-act="apply-json">Aplicar JSON</button>`;
}

function render() {
  const tabs = [
    ["batalha", "Batalha"],
    ["monstro", "Monstro"],
    ["alma", "Alma"],
    ["ataques", "Ataques"],
    ["sons", "Sons"],
  ];
  const body =
    tab === "monstro" ? viewMonstro()
    : tab === "alma" ? viewAlma()
    : tab === "ataques" ? viewAtaques()
    : tab === "sons" ? viewSons()
    : viewBatalha();
  const scroll = window.scrollY;
  app.innerHTML = `
    <h1><span class="heart">♥</span> Batalha da Alma</h1>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="body">${body}</div>`;
  window.scrollTo(0, scroll);
}

// ---------- eventos ----------
app.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
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
  if (el.dataset.sel) {
    const id = el.dataset.sel;
    (el as HTMLInputElement).checked ? selected.add(id) : selected.delete(id);
  }
});

app.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tab],[data-act],[data-mode],[data-token],[data-hp],[data-preview]");
  if (!el) return;
  if (el.dataset.preview) {
    preview(el.dataset.preview);
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
      lib.push({ nome: name, fala: cfg.monstro.fala, ordem: cfg.mecanica.ordem, ataques: structuredClone(cfg.ataques) });
      saveLibrary(lib);
      break;
    }
    case "load-turn": {
      const t = loadLibrary()[i];
      if (t) {
        cfg.ataques = structuredClone(t.ataques);
        cfg.monstro.fala = t.fala;
        cfg.mecanica.ordem = t.ordem;
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

// ---------- prévia de áudio ----------
let previewEl: HTMLAudioElement | null = null;
let previewChip: ChipMusic | null = null;
let previewTimer = 0;
function stopPreview() {
  clearTimeout(previewTimer);
  previewEl?.pause();
  previewEl = null;
  previewChip?.stop();
  previewChip = null;
}
function preview(path: string) {
  const playing = previewEl || previewChip;
  stopPreview();
  if (playing && path === "audio.musica") return; // segundo clique para a prévia
  const v = String(getPath(path) ?? "");
  if (path === "audio.musica") {
    if (v === "nenhuma") return;
    if (!v) {
      previewChip = new ChipMusic();
      previewChip.start(cfg.audio.volMusica);
    } else {
      previewEl = new Audio(resolveAudioUrl(v));
      previewEl.volume = cfg.audio.volMusica;
      previewEl.play().catch(() => {
        if (inOBR) OBR.notification.show("Não consegui tocar esse arquivo.", "WARNING");
      });
    }
    previewTimer = window.setTimeout(stopPreview, 10000);
    return;
  }
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
  const st: BattleState = {
    ativo: true,
    turno: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    seed: Math.floor(Math.random() * 1e9),
    participantes: [...selected],
    config: structuredClone(cfg),
  };
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

function setHp(alvo: string[], hp: number | "max") {
  if (!inOBR) return;
  OBR.broadcast.sendMessage(CH_HP, { alvo, hp, hpMax: cfg.mecanica.hpMax }, { destination: "REMOTE" });
}

function loadLibrary(): SavedTurn[] {
  try {
    return JSON.parse(localStorage.getItem("batalha-turnos") || "[]");
  } catch {
    return [];
  }
}
function saveLibrary(lib: SavedTurn[]) {
  try {
    localStorage.setItem("batalha-turnos", JSON.stringify(lib));
  } catch {
    /* sem armazenamento */
  }
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
    const was = battle?.ativo;
    battle = (m[BATTLE_KEY] as BattleState) ?? null;
    if (tab === "batalha" && was !== battle?.ativo) render();
  });
  OBR.party.onChange((p) => {
    players = p;
    if (tab === "batalha") render();
  });
  OBR.broadcast.onMessage(CH_ACTION, (ev) => {
    const d = ev.data as { nome: string; escolha: string; texto: string };
    pushLog(`${d.nome}: ${d.escolha}${d.texto ? ` — “${d.texto}”` : ""}`);
  });
  OBR.broadcast.onMessage(CH_EVENT, (ev) => {
    const d = ev.data as { tipo: string; nome: string };
    if (d.tipo === "morte") pushLog(`💔 A alma de ${d.nome} se partiu.`);
  });
}

if (inOBR) OBR.onReady(init);
else init();
