// Roda o tempo todo em cada cliente: abre/fecha a batalha, avisa o mestre
// e repassa os arquivos de áudio do mestre para os jogadores.

import OBR from "@owlbear-rodeo/sdk";
import {
  ActionMsg,
  BATTLE_KEY,
  BattleState,
  CH_ACTION,
  CH_EVENT,
  CH_HP,
  CH_ITEMS_RESET,
  HP_KEY,
  ITEMS_KEY,
  MODAL_ID,
  describeAction,
} from "./shared";
import {
  Assembler,
  CH_FILE_CHUNK,
  CH_FILE_PROGRESS,
  CH_FILE_PUSH,
  CH_FILE_READY,
  CH_FILE_REQ,
  CHUNK_INTERVAL_MS,
  ChunkMsg,
  ProgressMsg,
  StoredFile,
  chunkCount,
  chunkOf,
  getFile,
  putFile,
} from "./files";

OBR.onReady(async () => {
  const [id, role] = await Promise.all([OBR.player.getId(), OBR.player.getRole()]);
  let lastTurn = "";
  let wasActive = false;

  const apply = (room: Record<string, unknown>) => {
    const st = room[BATTLE_KEY] as BattleState | undefined;
    if (!st || !st.ativo) {
      if (wasActive) OBR.modal.close(MODAL_ID);
      wasActive = false;
      lastTurn = "";
      return;
    }
    wasActive = true;
    if (st.turno === lastTurn) return;
    lastTurn = st.turno;
    // O mestre abre a própria visão pelo painel; os jogadores recebem a batalha automaticamente.
    if (role === "GM") return;
    const participa = !st.participantes?.length || st.participantes.includes(id);
    if (participa) OBR.modal.open({ id: MODAL_ID, url: `${import.meta.env.BASE_URL}battle.html`, fullScreen: true, hidePaper: true });
  };
  apply(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(apply);

  // O mestre pode mudar o HP dos jogadores (só o próprio jogador grava seus metadados).
  OBR.broadcast.onMessage(CH_HP, async (ev) => {
    const d = ev.data as { alvo: string[]; hp: number | "max"; hpMax: number };
    if (role === "GM") return;
    if (d.alvo.length && !d.alvo.includes(id)) return;
    const hp = d.hp === "max" ? d.hpMax : Math.max(0, Math.min(d.hpMax, d.hp));
    await OBR.player.setMetadata({ [HP_KEY]: hp });
  });
  OBR.broadcast.onMessage(CH_ITEMS_RESET, async () => {
    if (role !== "GM") await OBR.player.setMetadata({ [ITEMS_KEY]: {} });
  });

  if (role === "GM") {
    OBR.broadcast.onMessage(CH_ACTION, async (ev) => {
      const d = ev.data as ActionMsg;
      OBR.notification.show(describeAction(d), "INFO");
      // o dano do LUTAR sai da vida do monstro
      if (d.escolha === "LUTAR" && d.dano) {
        const room = await OBR.room.getMetadata();
        const st = room[BATTLE_KEY] as BattleState | undefined;
        if (!st?.ativo || !st.config?.monstro?.hp) return;
        const atual = st.monstroHp ?? st.config.monstro.hp;
        const novo = Math.max(0, atual - d.dano);
        await OBR.room.setMetadata({ [BATTLE_KEY]: { ...st, monstroHp: novo } });
        if (novo === 0 && atual > 0) OBR.notification.show(`${st.config.monstro.nome} chegou a 0 HP!`, "WARNING");
      }
    });
    OBR.broadcast.onMessage(CH_EVENT, (ev) => {
      const d = ev.data as { tipo: string; nome: string };
      if (d.tipo === "morte") OBR.notification.show(`A alma de ${d.nome} se partiu!`, "ERROR");
    });
    serveFiles();
  } else {
    receiveFiles();
  }
});

const progress = (m: ProgressMsg) => OBR.broadcast.sendMessage(CH_FILE_PROGRESS, m, { destination: "LOCAL" });

/** Mestre: envia os pedaços dos arquivos pedidos, um de cada vez, sem estourar o limite do broadcast. */
function serveFiles() {
  const queue = new Map<string, Set<number>>();
  const loaded = new Map<string, StoredFile>();

  const enqueue = async (hash: string, idx?: number[]) => {
    let f = loaded.get(hash);
    if (!f) {
      const got = await getFile(hash);
      if (!got) return;
      f = got;
      loaded.set(hash, f);
    }
    const total = chunkCount(f.data.byteLength);
    const set = queue.get(hash) ?? new Set<number>();
    const list = idx?.length ? idx : [...Array(total).keys()];
    for (const i of list) if (i >= 0 && i < total) set.add(i);
    queue.set(hash, set);
  };

  OBR.broadcast.onMessage(CH_FILE_PUSH, (ev) => enqueue((ev.data as { hash: string }).hash));
  OBR.broadcast.onMessage(CH_FILE_REQ, (ev) => {
    const d = ev.data as { hash: string; missing?: number[] };
    enqueue(d.hash, d.missing);
  });

  let sent = 0;
  setInterval(() => {
    for (const [hash, set] of queue) {
      const f = loaded.get(hash);
      if (!f || !set.size) {
        queue.delete(hash);
        continue;
      }
      const i = Math.min(...set);
      set.delete(i);
      OBR.broadcast.sendMessage(CH_FILE_CHUNK, chunkOf(f, i), { destination: "REMOTE" }).catch(() => set.add(i));
      const total = chunkCount(f.data.byteLength);
      if (++sent % 8 === 0 || !set.size) progress({ hash, done: total - set.size, total, sending: true });
      if (!set.size) queue.delete(hash);
      return;
    }
  }, CHUNK_INTERVAL_MS);
}

/** Jogador: junta os pedaços, guarda no navegador e pede de novo o que se perdeu. */
function receiveFiles() {
  const asm = new Assembler();
  const have = new Set<string>();
  const checking = new Map<string, Promise<boolean>>();
  const known = (hash: string) => {
    if (have.has(hash)) return Promise.resolve(true);
    let p = checking.get(hash);
    if (!p) {
      p = getFile(hash).then((f) => {
        if (f) have.add(hash);
        return !!f;
      });
      checking.set(hash, p);
    }
    return p;
  };

  OBR.broadcast.onMessage(CH_FILE_CHUNK, async (ev) => {
    const m = ev.data as ChunkMsg;
    if (!asm.has(m.h) && (await known(m.h))) return;
    const r = asm.add(m);
    if (r.got % 8 === 0 || r.done) progress({ hash: m.h, done: r.got, total: r.total, sending: false });
    if (r.done) {
      await putFile(r.done);
      have.add(m.h);
      OBR.broadcast.sendMessage(CH_FILE_READY, { hash: m.h }, { destination: "LOCAL" });
    }
  });

  setInterval(() => {
    for (const s of asm.stalled(4000)) {
      OBR.broadcast.sendMessage(CH_FILE_REQ, { hash: s.hash, missing: s.missing }, { destination: "REMOTE" });
    }
  }, 2000);
}
