// Áudio: efeitos (sintetizados ou arquivos do mestre) e música
// (original sintetizada, arquivo enviado, link direto, YouTube ou SoundCloud).

import { fileUrl, fileUrlSync } from "./files";
import { parseSource } from "./media";
import { AudioConfig, SfxName, resolveAudioUrl } from "./shared";

let sharedCtx: AudioContext | null = null;
function audioCtx() {
  sharedCtx ??= new AudioContext();
  return sharedCtx;
}

/** Destrava o áudio depois de um clique/tecla/botão do controle (regra de autoplay do navegador). */
export function unlockAudio() {
  try {
    if (sharedCtx?.state === "suspended") sharedCtx.resume();
  } catch {
    /* ignore */
  }
}

// ---------- efeitos ----------
export class Sfx {
  on: boolean;
  private pool = new Map<string, HTMLAudioElement>();
  constructor(on: boolean, private audio?: AudioConfig) {
    this.on = on;
  }

  play(name: SfxName) {
    if (!this.on) return;
    const src = parseSource(this.audio?.sons[name] ?? "");
    const url =
      src.kind === "arquivo" ? fileUrlSync(src.hash)
      : src.kind === "url" ? src.url
      : null; // YouTube/SoundCloud não servem para efeitos curtos
    if (url) return this.playFile(url);
    this.synth(name);
  }

  private playFile(v: string) {
    const url = resolveAudioUrl(v);
    let base = this.pool.get(url);
    if (!base) {
      base = new Audio(url);
      base.preload = "auto";
      this.pool.set(url, base);
    }
    const a = base.cloneNode() as HTMLAudioElement;
    a.volume = clamp01(this.audio?.volSons ?? 0.8);
    a.play().catch(() => {});
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.08, slide = 0) {
    try {
      const ctx = audioCtx();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol * clamp01(this.audio?.volSons ?? 0.8) * 1.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
    } catch {
      /* áudio indisponível */
    }
  }

  private synth(name: SfxName) {
    switch (name) {
      case "dano": return this.tone(220, 0.25, "square", 0.1, -150);
      case "escudo": return this.tone(1200, 0.08, "square", 0.05);
      case "texto": return this.tone(520, 0.03, "square", 0.025);
      case "selecionar": return this.tone(800, 0.06, "square", 0.05);
      case "cura": return this.tone(600, 0.2, "triangle", 0.08, 400);
      case "morte": return this.tone(300, 0.6, "sawtooth", 0.08, -250);
    }
  }
}

// ---------- música original sintetizada ----------
const _ = null;
// Melodia original em lá menor, 8 compassos de colcheias.
const LEAD: (number | null)[] = [
  69, _, 72, 76, _, 74, 72, 71,
  69, _, _, 65, 69, 72, _, 69,
  67, _, 64, 67, 72, _, 71, 72,
  74, _, 71, _, 67, _, 69, 71,
  72, _, 76, _, 81, _, 79, 76,
  77, _, 76, 74, 72, _, 69, 72,
  71, _, 68, 71, 76, _, 74, 71,
  68, _, _, 71, 64, _, _, _,
];
const BASS = [45, 41, 48, 43, 45, 41, 40, 40];
const CHORDS = [
  [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62],
  [57, 60, 64], [53, 57, 60], [52, 56, 59], [52, 56, 59],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class ChipMusic {
  private timer = 0;
  private step = 0;
  private next = 0;
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly stepDur = 60 / 138 / 2; // colcheia a 138 bpm

  start(volume: number) {
    this.stop();
    const ctx = audioCtx();
    this.gain = ctx.createGain();
    this.gain.gain.value = clamp01(volume) * 0.9;
    this.gain.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  setVolume(v: number) {
    if (this.gain) this.gain.gain.value = clamp01(v) * 0.9;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.gain?.disconnect();
    this.gain = null;
  }

  private schedule() {
    const ctx = audioCtx();
    while (this.gain && this.next < ctx.currentTime + 0.15) {
      const s = this.step % LEAD.length;
      const bar = Math.floor(s / 8);
      const t = this.next;
      const len = this.stepDur;
      const lead = LEAD[s];
      if (lead !== null) this.note(midi(lead), t, len * 1.6, "square", 0.045);
      // baixo pulsando com oitavas
      this.note(midi(BASS[bar] + (s % 2 ? 12 : 0)), t, len * 0.9, "triangle", 0.13);
      // arpejo
      const ch = CHORDS[bar];
      this.note(midi(ch[s % 3] + 12), t, len * 0.5, "square", 0.018);
      // chimbal nos contratempos
      if (s % 2 === 1) this.hat(t);
      this.step++;
      this.next += len;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = audioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number) {
    const ctx = audioCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.gain!);
    src.start(t);
  }
}

// ---------- players incorporados (YouTube / SoundCloud) ----------
interface Embedded {
  stop(): void;
  resume(): void;
  mute(m: boolean): void;
}

type AnyWin = Window & { YT?: any; SC?: any; onYouTubeIframeAPIReady?: () => void };
const w = window as AnyWin;
let ytApi: Promise<any> | null = null;
let scApi: Promise<any> | null = null;

function loadScript(src: string) {
  const s = document.createElement("script");
  s.src = src;
  document.head.appendChild(s);
  return s;
}

function loadYouTubeApi() {
  ytApi ??= new Promise((resolve) => {
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    loadScript("https://www.youtube.com/iframe_api");
  });
  return ytApi;
}

function loadSoundCloudApi() {
  scApi ??= new Promise((resolve) => {
    if (w.SC?.Widget) return resolve(w.SC);
    loadScript("https://w.soundcloud.com/player/api.js").onload = () => resolve(w.SC);
  });
  return scApi;
}

/** Player oficial do YouTube, visível (as regras do YouTube não permitem esconder o player). */
export function youTubeEmbed(
  box: HTMLElement,
  id: string,
  start: number,
  vol: number,
  onError: (m: string) => void,
  loop = true,
): Embedded {
  const holder = document.createElement("div");
  box.appendChild(holder);
  box.style.display = "block";
  let player: any = null;
  let muted = false;
  let stopped = false;
  loadYouTubeApi().then((YT) => {
    if (stopped) return;
    player = new YT.Player(holder, {
      width: 200,
      height: 200,
      videoId: id,
      playerVars: { autoplay: 1, start, playsinline: 1, rel: 0 },
      events: {
        onReady: (e: any) => {
          e.target.setVolume(Math.round(clamp01(vol) * 100));
          if (muted) e.target.mute();
          e.target.playVideo();
        },
        onStateChange: (e: any) => {
          if (loop && e.data === YT.PlayerState.ENDED) {
            e.target.seekTo(start || 0);
            e.target.playVideo();
          }
        },
        onError: (e: any) =>
          onError(
            e.data === 101 || e.data === 150
              ? "Esse vídeo não permite tocar fora do YouTube."
              : "Não consegui tocar esse vídeo do YouTube.",
          ),
      },
    });
  });
  return {
    stop() {
      stopped = true;
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      box.innerHTML = "";
      box.style.display = "none";
    },
    resume: () => player?.playVideo?.(),
    mute(m) {
      muted = m;
      if (m) player?.mute?.();
      else player?.unMute?.();
    },
  };
}

/** Player oficial do SoundCloud. */
export function soundCloudEmbed(
  box: HTMLElement,
  url: string,
  vol: number,
  onError: (m: string) => void,
  loop = true,
): Embedded {
  const iframe = document.createElement("iframe");
  iframe.allow = "autoplay";
  iframe.width = "200";
  iframe.height = "120";
  iframe.style.border = "0";
  iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=false&show_comments=false&hide_related=true&show_teaser=false`;
  box.appendChild(iframe);
  box.style.display = "block";
  let widget: any = null;
  loadSoundCloudApi().then((SC) => {
    widget = SC.Widget(iframe);
    widget.bind(SC.Widget.Events.READY, () => {
      widget.setVolume(Math.round(clamp01(vol) * 100));
      widget.play();
    });
    widget.bind(SC.Widget.Events.FINISH, () => {
      if (!loop) return;
      widget.seekTo(0);
      widget.play();
    });
    widget.bind(SC.Widget.Events.ERROR, () => onError("Não consegui tocar esse link do SoundCloud."));
  });
  return {
    stop() {
      try {
        widget?.pause();
      } catch {
        /* ignore */
      }
      box.innerHTML = "";
      box.style.display = "none";
    },
    resume: () => widget?.play?.(),
    mute: (m) => widget?.setVolume?.(m ? 0 : Math.round(clamp01(vol) * 100)),
  };
}

// ---------- tocador de música ----------
export interface MusicHost {
  embedBox: HTMLElement; // onde aparece o player do YouTube/SoundCloud
  onStatus?: (msg: string) => void; // mensagens para o jogador (baixando, erro…)
  onNeedFile?: (hash: string) => void; // arquivo do mestre ainda não chegou
}

export class MusicPlayer {
  private chip: ChipMusic | null = null;
  private el: HTMLAudioElement | null = null;
  private embed: Embedded | null = null;
  private blocked = false;
  private muted = false;
  private token = 0;
  private waiting: { hash: string; audio: AudioConfig; host: MusicHost } | null = null;

  async play(audio: AudioConfig, host: MusicHost) {
    this.stop();
    const token = this.token;
    const src = parseSource(audio.musica);
    const vol = audio.volMusica;
    const fail = (m: string) => host.onStatus?.(m);
    switch (src.kind) {
      case "nenhuma":
        return;
      case "padrao":
        this.chip = new ChipMusic();
        this.chip.start(vol);
        if (audioCtx().state === "suspended") this.blocked = true;
        break;
      case "arquivo": {
        const url = await fileUrl(src.hash);
        if (token !== this.token) return;
        if (!url) {
          this.waiting = { hash: src.hash, audio, host };
          host.onStatus?.(`Baixando a música do mestre (${src.name})…`);
          host.onNeedFile?.(src.hash);
          return;
        }
        host.onStatus?.("");
        this.playElement(url, vol, fail);
        break;
      }
      case "url":
        this.playElement(resolveAudioUrl(src.url), vol, fail);
        break;
      case "youtube":
        this.embed = youTubeEmbed(host.embedBox, src.id, src.start, vol, fail);
        break;
      case "soundcloud":
        this.embed = soundCloudEmbed(host.embedBox, src.url, vol, fail);
        break;
    }
    this.setMuted(this.muted);
  }

  /** Um arquivo do mestre terminou de chegar: começa a tocar se era o que faltava. */
  fileArrived(hash: string) {
    if (this.waiting?.hash === hash) {
      const { audio, host } = this.waiting;
      this.play(audio, host);
    }
  }

  private playElement(url: string, vol: number, fail: (m: string) => void) {
    this.el = new Audio(url);
    this.el.loop = true;
    this.el.volume = clamp01(vol);
    this.el.onerror = () => fail("Não consegui tocar esse link de áudio.");
    this.el.play().catch((e) => {
      if (e?.name === "NotAllowedError") this.blocked = true;
    });
  }

  /** Chamado num gesto do usuário para retomar música bloqueada pelo navegador. */
  resume() {
    unlockAudio();
    if (this.blocked && this.el) this.el.play().catch(() => {});
    this.embed?.resume();
    this.blocked = false;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.el) this.el.muted = m;
    this.embed?.mute(m);
    if (this.chip && sharedCtx) {
      if (m) sharedCtx.suspend();
      else sharedCtx.resume();
    }
  }

  stop() {
    this.token++;
    this.waiting = null;
    this.chip?.stop();
    this.chip = null;
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
    }
    this.el = null;
    this.embed?.stop();
    this.embed = null;
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
