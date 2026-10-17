// Roda o tempo todo em cada cliente: abre/fecha a batalha e avisa o mestre.

import OBR from "@owlbear-rodeo/sdk";
import { BATTLE_KEY, BattleState, CH_ACTION, CH_EVENT, CH_HP, HP_KEY, MODAL_ID } from "./shared";

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

  if (role === "GM") {
    OBR.broadcast.onMessage(CH_ACTION, (ev) => {
      const d = ev.data as { nome: string; escolha: string; texto: string };
      OBR.notification.show(`${d.nome}: ${d.escolha}${d.texto ? ` — "${d.texto}"` : ""}`, "INFO");
    });
    OBR.broadcast.onMessage(CH_EVENT, (ev) => {
      const d = ev.data as { tipo: string; nome: string };
      if (d.tipo === "morte") OBR.notification.show(`A alma de ${d.nome} se partiu!`, "ERROR");
    });
  }
});
