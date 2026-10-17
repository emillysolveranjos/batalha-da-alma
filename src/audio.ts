// Áudio: efeitos (sintetizados ou mp3 do mestre) e música (original sintetizada ou mp3 do mestre).

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
    const url = this.audio?.sons[name];
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

// ---------- tocador de música ----------
export class MusicPlayer {
  private chip: ChipMusic | null = null;
  private el: HTMLAudioElement | null = null;
  private blocked = false;

  play(audio: AudioConfig) {
    this.stop();
    if (audio.musica === "nenhuma") return;
    if (!audio.musica) {
      this.chip = new ChipMusic();
      this.chip.start(audio.volMusica);
      if (audioCtx().state === "suspended") this.blocked = true;
      return;
    }
    this.el = new Audio(resolveAudioUrl(audio.musica));
    this.el.loop = true;
    this.el.volume = clamp01(audio.volMusica);
    this.el.play().catch(() => (this.blocked = true));
  }

  /** Chamado num gesto do usuário para retomar música bloqueada pelo navegador. */
  resume() {
    unlockAudio();
    if (this.blocked && this.el) this.el.play().catch(() => {});
    this.blocked = false;
  }

  setMuted(m: boolean) {
    if (this.el) this.el.muted = m;
    if (this.chip && sharedCtx) {
      if (m) sharedCtx.suspend();
      else sharedCtx.resume();
    }
  }

  stop() {
    this.chip?.stop();
    this.chip = null;
    if (this.el) {
      this.el.pause();
      this.el.src = "";
    }
    this.el = null;
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
