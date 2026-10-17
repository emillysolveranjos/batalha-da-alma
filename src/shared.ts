// Tipos, valores padrão e constantes usados pelo painel, pelo script de fundo e pela batalha.

export const ID = "com.batalha-da-alma";
export const CONFIG_KEY = `${ID}/config`;
export const BATTLE_KEY = `${ID}/battle`;
export const HP_KEY = `${ID}/hp`;
export const MODAL_ID = `${ID}/modal`;
export const CH_SOUL = `${ID}/soul`;
export const CH_ACTION = `${ID}/action`;
export const CH_HP = `${ID}/set-hp`;
export const CH_EVENT = `${ID}/event`;
export const ITEMS_KEY = `${ID}/itens-usados`; // metadados do jogador: { nomeDoItem: quantosUsou }
export const CH_ITEMS_RESET = `${ID}/repor-itens`;
export const CH_REPLY = `${ID}/resposta`; // o mestre responde na caixa de texto dos jogadores

export interface Item {
  nome: string;
  cura: number;
  qtd: number;
}

/** O que o jogador escolheu no fim do turno (vai para o mestre). */
export interface ActionMsg {
  nome: string;
  escolha: string;
  opcao?: string;
  texto?: string;
  precisao?: number;
  dano?: number;
  critico?: boolean;
  cura?: number;
}

export function describeAction(d: ActionMsg) {
  const parts = [d.escolha];
  if (d.opcao) parts.push(d.opcao);
  if (d.escolha === "LUTAR" && d.dano !== undefined)
    parts.push(d.dano ? `${d.dano} de dano${d.critico ? " (CRÍTICO)" : ""}, precisão ${d.precisao}%` : "errou");
  if (d.cura) parts.push(`+${d.cura} HP`);
  return `${d.nome}: ${parts.join(" — ")}${d.texto ? ` — “${d.texto}”` : ""}`;
}

export type SoulMode = "vermelha" | "azul" | "verde" | "roxa";
export type BulletKind = "branco" | "azul" | "laranja" | "verde";
export type BulletShape =
  | "circulo"
  | "quadrado"
  | "diamante"
  | "estrela"
  | "osso"
  | "seta"
  | "emoji"
  | "imagem";

export type AttackType =
  | "chuva"
  | "lateral"
  | "ossos"
  | "anel"
  | "espiral"
  | "mirado"
  | "laser"
  | "ricochete"
  | "tunel"
  | "explosao"
  | "flechas"
  | "canhao"
  | "arco"
  | "estacas"
  | "varredura"
  | "fios"
  | "pancada";

export interface AttackConfig {
  tipo: AttackType;
  duracao: number; // segundos
  velocidade: number; // multiplicador
  densidade: number; // multiplicador
  tamanho: number; // multiplicador do projétil
  dano: number;
  tipoDano: BulletKind;
  forma: BulletShape;
  cor: string;
  emoji: string;
  imagem: string;
  fala: string; // fala opcional do monstro durante este ataque
  caixaL: number; // largura da caixa (0 = padrão)
  caixaA: number; // altura da caixa (0 = padrão)
}

export interface BattleConfig {
  monstro: {
    nome: string;
    imagem: string;
    escala: number;
    fala: string;
    fundo: string; // URL de imagem de fundo opcional
    hp: number; // 0 = sem barra de vida
    atk: number;
    def: number;
    descricao: string; // aparece no "Conferir"
    acoes: string[]; // opções do AGIR
    poupavel: boolean; // nome fica amarelo no POUPAR
    frase: string; // texto da caixa no começo dos turnos seguintes
  };
  itens: Item[];
  alma: {
    modo: SoulMode;
    cor: string; // vazio = cor padrão do modo
    imagem: string;
    tamanho: number;
    velocidade: number;
  };
  mecanica: {
    hpMax: number;
    invencivel: number; // segundos de invencibilidade após dano
    caixaL: number;
    caixaA: number;
    ordem: "sequencia" | "simultaneo" | "aleatorio";
    menuFinal: boolean; // mostra LUTAR/AGIR/ITEM/POUPAR no fim do turno
    mostrarHitbox: boolean;
    sons: boolean;
    intensidade: number; // multiplica velocidade e densidade de todos os ataques
    danoAtaque: number; // dano base do LUTAR (acerto perfeito)
  };
  audio: AudioConfig;
  ataques: AttackConfig[];
}

export type SfxName = "dano" | "escudo" | "texto" | "selecionar" | "cura" | "morte";

export interface AudioConfig {
  musica: string; // "" = música original sintetizada, "nenhuma" = silêncio, senão URL/arquivo
  volMusica: number; // 0..1
  volSons: number; // 0..1
  sons: Record<SfxName, string>; // "" = som sintetizado padrão, senão URL/arquivo
}

export const SFX_INFO: Record<SfxName, string> = {
  dano: "Levar dano",
  escudo: "Bloquear com o escudo",
  texto: "Letras do texto",
  selecionar: "Escolher no menu",
  cura: "Curar",
  morte: "Alma se partindo",
};

/** Resolve "audio/x.mp3" (arquivo do repositório) ou uma URL completa. */
export function resolveAudioUrl(v: string, base = location.href) {
  try {
    return new URL(v, base).href;
  } catch {
    return v;
  }
}

/** Um turno salvo na biblioteca do mestre (ataques + fala). */
export interface SavedTurn {
  nome: string;
  fala: string;
  ordem: BattleConfig["mecanica"]["ordem"];
  ataques: AttackConfig[];
  modo?: SoulMode; // a fase pode trocar a mecânica da alma
  intensidade?: number;
}

export interface BattleState {
  ativo: boolean;
  turno: string; // muda a cada turno iniciado
  seed: number;
  participantes: string[]; // ids dos jogadores; vazio = todos
  config: BattleConfig;
  numero?: number; // 1 = primeiro turno da batalha
  monstroHp?: number; // vida atual do monstro (o mestre atualiza)
}

export const ATTACK_INFO: Record<AttackType, { nome: string; desc: string }> = {
  chuva: { nome: "Chuva", desc: "Projéteis caem do topo da caixa." },
  lateral: { nome: "Rajada lateral", desc: "Colunas vêm dos lados com uma brecha." },
  ossos: { nome: "Ossos", desc: "Barras de cima e de baixo com um vão para passar." },
  anel: { nome: "Anel", desc: "Um círculo se fecha sobre a alma, com uma abertura." },
  espiral: { nome: "Espiral", desc: "Braços giratórios saem do centro." },
  mirado: { nome: "Mirado", desc: "Tiros das bordas apontados para a alma." },
  laser: { nome: "Laser", desc: "Aviso piscando e depois um feixe atravessa a caixa." },
  ricochete: { nome: "Ricochete", desc: "Projéteis quicam nas paredes da caixa." },
  tunel: { nome: "Túnel", desc: "Paredes descem com um corredor que serpenteia." },
  explosao: { nome: "Explosão", desc: "Bolas caem e explodem em estilhaços." },
  flechas: { nome: "Flechas", desc: "Vêm dos 4 lados até o centro. Ideal para a alma verde." },
  canhao: { nome: "Canhão de feixe", desc: "Mira de fora da caixa, em qualquer ângulo, e dispara um feixe largo." },
  arco: { nome: "Arco", desc: "Projéteis lançados dos lados caem em parábola." },
  estacas: { nome: "Estacas", desc: "O chão (ou o teto) pisca e uma estaca sobe naquele ponto." },
  varredura: { nome: "Varredura", desc: "Barras da altura da caixa atravessam tudo. Use azul ou laranja; branco alterna os dois." },
  fios: { nome: "Fios", desc: "Projéteis correm pelas 3 linhas horizontais. Feito para a alma roxa." },
  pancada: { nome: "Pancada de gravidade", desc: "Arremessa a alma contra uma parede (vira alma azul naquela direção) e ossos sobem dali. Pule para escapar." },
};

export const SOUL_INFO: Record<SoulMode, { nome: string; cor: string; desc: string }> = {
  vermelha: { nome: "Vermelha (livre)", cor: "#ff1a1a", desc: "Move em todas as direções. Shift = devagar." },
  azul: { nome: "Azul (gravidade)", cor: "#1a5cff", desc: "Cai com gravidade. Cima/W/Z pula." },
  verde: { nome: "Verde (escudo)", cor: "#16c60c", desc: "Fica parada no centro; as setas giram o escudo." },
  roxa: { nome: "Roxa (fios)", cor: "#c33cff", desc: "Presa em 3 fios: cima/baixo troca de fio." },
};

export const KIND_COLOR: Record<BulletKind, string | null> = {
  branco: null,
  azul: "#14a9ff",
  laranja: "#ffa040",
  verde: "#22dd22",
};

export function defaultAttack(tipo: AttackType = "chuva"): AttackConfig {
  return {
    tipo,
    duracao: 6,
    velocidade: 1,
    densidade: 1,
    tamanho: 1,
    dano: 2,
    tipoDano: "branco",
    forma:
      tipo === "ossos" || tipo === "tunel" || tipo === "varredura"
        ? "osso"
        : tipo === "flechas" || tipo === "estacas"
          ? "seta"
          : "circulo",
    cor: "#ffffff",
    emoji: "⭐",
    imagem: "",
    fala: "",
    caixaL: 0,
    caixaA: 0,
  };
}

export function defaultConfig(): BattleConfig {
  return {
    monstro: {
      nome: "Monstro",
      imagem: "",
      escala: 1,
      fala: "Prepare-se!",
      fundo: "",
      hp: 100,
      atk: 5,
      def: 0,
      descricao: "",
      acoes: ["Conferir", "Conversar", "Provocar"],
      poupavel: false,
      frase: "",
    },
    itens: [
      { nome: "Pão doce", cura: 10, qtd: 1 },
      { nome: "Bala de mel", cura: 5, qtd: 2 },
    ],
    alma: { modo: "vermelha", cor: "", imagem: "", tamanho: 1, velocidade: 1 },
    mecanica: {
      hpMax: 20,
      invencivel: 1,
      caixaL: 220,
      caixaA: 150,
      ordem: "sequencia",
      menuFinal: true,
      mostrarHitbox: false,
      sons: true,
      intensidade: 1,
      danoAtaque: 12,
    },
    audio: {
      musica: "",
      volMusica: 0.5,
      volSons: 0.8,
      sons: { dano: "", escudo: "", texto: "", selecionar: "", cura: "", morte: "" },
    },
    ataques: [defaultAttack("chuva"), defaultAttack("lateral")],
  };
}

/** Preenche campos ausentes (configs antigas ou importadas). */
export function normalizeConfig(raw: unknown): BattleConfig {
  const d = defaultConfig();
  const c = (raw ?? {}) as Partial<BattleConfig>;
  return {
    monstro: {
      ...d.monstro,
      ...(c.monstro ?? {}),
      acoes: Array.isArray(c.monstro?.acoes) ? c.monstro.acoes : d.monstro.acoes,
    },
    itens: Array.isArray(c.itens) ? c.itens : d.itens,
    alma: { ...d.alma, ...(c.alma ?? {}) },
    mecanica: { ...d.mecanica, ...(c.mecanica ?? {}) },
    audio: { ...d.audio, ...(c.audio ?? {}), sons: { ...d.audio.sons, ...(c.audio?.sons ?? {}) } },
    ataques: Array.isArray(c.ataques)
      ? c.ataques.map((a) => ({ ...defaultAttack(a?.tipo), ...a }))
      : d.ataques,
  };
}

/** Gerador pseudoaleatório com semente: todos os clientes veem os mesmos padrões. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
