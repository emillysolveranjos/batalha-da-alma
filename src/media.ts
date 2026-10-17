// Interpreta o que o mestre escolheu como áudio: padrão, arquivo enviado, YouTube, SoundCloud ou link.

export type AudioSource =
  | { kind: "padrao" }
  | { kind: "nenhuma" }
  | { kind: "arquivo"; hash: string; name: string }
  | { kind: "youtube"; id: string; start: number }
  | { kind: "soundcloud"; url: string }
  | { kind: "url"; url: string };

export const FILE_PREFIX = "arquivo:";

export function fileValue(hash: string, name: string) {
  return `${FILE_PREFIX}${hash}:${name}`;
}

export function parseSource(v: string): AudioSource {
  v = (v || "").trim();
  if (!v) return { kind: "padrao" };
  if (v === "nenhuma") return { kind: "nenhuma" };
  if (v.startsWith(FILE_PREFIX)) {
    const rest = v.slice(FILE_PREFIX.length);
    const i = rest.indexOf(":");
    return { kind: "arquivo", hash: rest.slice(0, i), name: rest.slice(i + 1) };
  }
  const yt = youTube(v);
  if (yt) return { kind: "youtube", ...yt };
  if (/^https?:\/\/(www\.|m\.)?(soundcloud\.com|on\.soundcloud\.com)\//i.test(v)) return { kind: "soundcloud", url: v };
  return { kind: "url", url: directLink(v) };
}

function youTube(v: string): { id: string; start: number } | null {
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  id = id.split(/[/?&#]/)[0];
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  const t = u.searchParams.get("t") || u.searchParams.get("start") || "0";
  return { id, start: parseTime(t) };
}

function parseTime(t: string) {
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/** Converte links de compartilhamento (Google Drive, Dropbox) em links que tocam direto. */
export function directLink(v: string): string {
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return v;
  }
  if (u.hostname === "drive.google.com") {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    const id = m?.[1] || u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (/(^|\.)dropbox\.com$/.test(u.hostname)) {
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.href;
  }
  return v;
}

export function describeSource(v: string): string {
  const s = parseSource(v);
  switch (s.kind) {
    case "padrao": return "Padrão";
    case "nenhuma": return "Sem música";
    case "arquivo": return `Arquivo: ${s.name}`;
    case "youtube": return `YouTube (${s.id})`;
    case "soundcloud": return "SoundCloud";
    case "url":
      return /spotify\.com/i.test(s.url)
        ? "⚠ Spotify não funciona (só libera prévias de 30 s fora do app)"
        : "Link de áudio";
  }
}
