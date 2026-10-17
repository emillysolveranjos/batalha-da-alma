// Arquivos de áudio enviados pelo mestre: guardados no navegador (IndexedDB) e
// repassados aos jogadores em pedaços pelo broadcast do Owlbear (limite de 16 KB por mensagem).

export const CH_FILE_CHUNK = "com.batalha-da-alma/file-chunk";
export const CH_FILE_REQ = "com.batalha-da-alma/file-req";
export const CH_FILE_PUSH = "com.batalha-da-alma/file-push"; // local: painel pede ao fundo para enviar
export const CH_FILE_READY = "com.batalha-da-alma/file-ready"; // local: arquivo completo neste navegador
export const CH_FILE_PROGRESS = "com.batalha-da-alma/file-progress"; // local: andamento do envio/recebimento

export const CHUNK_BYTES = 11000; // em base64 fica ~14,7 KB, abaixo do limite de 16 KB
export const CHUNK_INTERVAL_MS = 110; // ~9 mensagens por segundo
export const MAX_FILE_MB = 10;

export interface StoredFile {
  hash: string;
  name: string;
  type: string;
  data: ArrayBuffer;
}

export interface ChunkMsg {
  h: string; // hash
  n: string; // nome
  t: string; // tipo
  i: number; // índice
  c: number; // total de pedaços
  d: string; // base64
}

export interface ProgressMsg {
  hash: string;
  done: number;
  total: number;
  sending: boolean;
}

// ---------- IndexedDB ----------
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("batalha-da-alma", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files", { keyPath: "hash" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

export async function getFile(hash: string): Promise<StoredFile | null> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const r = d.transaction("files").objectStore("files").get(hash);
      r.onsuccess = () => resolve((r.result as StoredFile) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putFile(f: StoredFile) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("files", "readwrite");
    tx.objectStore("files").put(f);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const urlCache = new Map<string, string>();
/** URL local (blob:) de um arquivo já guardado, ou null se ainda não chegou. */
export async function fileUrl(hash: string): Promise<string | null> {
  const cached = urlCache.get(hash);
  if (cached) return cached;
  const f = await getFile(hash);
  if (!f) return null;
  const url = URL.createObjectURL(new Blob([f.data], { type: f.type || "audio/mpeg" }));
  urlCache.set(hash, url);
  return url;
}

/** Versão síncrona: só devolve se o arquivo já foi carregado com fileUrl(). */
export function fileUrlSync(hash: string): string | null {
  return urlCache.get(hash) ?? null;
}

export async function hashFile(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function chunkCount(size: number) {
  return Math.max(1, Math.ceil(size / CHUNK_BYTES));
}

export function chunkOf(f: StoredFile, i: number): ChunkMsg {
  const bytes = new Uint8Array(f.data, i * CHUNK_BYTES, Math.min(CHUNK_BYTES, f.data.byteLength - i * CHUNK_BYTES));
  return { h: f.hash, n: f.name, t: f.type, i, c: chunkCount(f.data.byteLength), d: toBase64(bytes) };
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Junta os pedaços recebidos; devolve o arquivo quando estiver completo. */
export class Assembler {
  private parts = new Map<string, { msg: ChunkMsg; got: (Uint8Array | undefined)[]; count: number; last: number }>();

  add(m: ChunkMsg): { done: StoredFile | null; got: number; total: number } {
    let p = this.parts.get(m.h);
    if (!p) {
      p = { msg: m, got: new Array(m.c), count: 0, last: 0 };
      this.parts.set(m.h, p);
    }
    p.last = Date.now();
    if (!p.got[m.i]) {
      p.got[m.i] = fromBase64(m.d);
      p.count++;
    }
    if (p.count < m.c) return { done: null, got: p.count, total: m.c };
    this.parts.delete(m.h);
    const size = p.got.reduce((n, b) => n + (b?.length ?? 0), 0);
    const all = new Uint8Array(size);
    let o = 0;
    for (const b of p.got) {
      all.set(b!, o);
      o += b!.length;
    }
    return { done: { hash: m.h, name: m.n, type: m.t, data: all.buffer }, got: m.c, total: m.c };
  }

  /** Arquivos parados há algum tempo, com os índices que faltam. */
  stalled(ms: number) {
    const now = Date.now();
    const out: { hash: string; missing: number[] }[] = [];
    for (const [hash, p] of this.parts) {
      if (now - p.last < ms) continue;
      const missing: number[] = [];
      for (let i = 0; i < p.got.length && missing.length < 400; i++) if (!p.got[i]) missing.push(i);
      out.push({ hash, missing });
      p.last = now;
    }
    return out;
  }

  has(hash: string) {
    return this.parts.has(hash);
  }
}
