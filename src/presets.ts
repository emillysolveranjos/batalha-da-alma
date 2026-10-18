// Presets de moveset: paródias das lutas de Undertale, Deltarune e do fangame Last Breath,
// recriadas com os ataques da extensão. Só mecânica (padrões, ritmo, modo da alma, fases e clima do cenário):
// nenhuma arte, som, código ou fala dos jogos. Os nomes das fases são brincadeiras nossas.

import {
  AttackConfig,
  AttackType,
  BattleConfig,
  Cenario,
  SavedTurn,
  SoulMode,
  defaultAttack,
  defaultCenario,
  defaultConfig,
  normalizeConfig,
} from "./shared";

export const PRESET_FORMAT = "batalha-da-alma-preset";

export interface PresetFile {
  formato: typeof PRESET_FORMAT;
  versao: 1;
  nome: string;
  jogo?: string;
  descricao: string;
  nivel?: number; // 1 = monstro comum, 2 = chefe, 3 = chefe difícil, 4 = extremo
  config: BattleConfig;
  turnos: SavedTurn[];
}

/** Nível de cada luta: guia o balanceamento (dev/balanco.ts) e aparece no painel. */
const NIVEL: Record<string, number> = {
  Toriel: 2, Papyrus: 2, Undyne: 2, Mettaton: 2, Muffet: 2, "Mad Dummy": 2, Asgore: 2, "Greater Dog": 2,
  "K. Round": 2, King: 2, Berdly: 2, Queen: 2, Tenna: 2, "Tasque Manager": 2,
  "Undyne, a Imortal": 3, "Mettaton NEO": 3, "Omega Flowey": 3, Asriel: 3, Jevil: 3, "Spamton NEO": 3,
  "Roaring Knight": 3, "Hammer of Justice": 3, Titan: 3,
  Sans: 4, "Last Breath": 4, "Kaizo Knight": 4,
};
export const nivelDe = (nome: string) => NIVEL[nome] ?? 1;

/**
 * Ajuste fino de intensidade por fase ("Luta|Fase"), medido com dev/balanco.ts: um robô que desvia com
 * reação de gente e uma alma parada. Fases fáceis demais sobem, impossíveis descem.
 */
const AJUSTE: Record<string, number> = Object.fromEntries(
  Object.entries({
    Froggit: { Zumbido: 1.8, "Pula-pula": 1.35 },
    Napstablook: { "Choro de verdade": 0.75, "Nuvem de lágrimas": 0.65 },
    Toriel: { "Corredor de brasas": 1.8, "Mãos e brasas": 0.65 },
    Papyrus: { "Treino de ossos": 0.8, Escadinha: 0.8, "Corredor comprido": 0.8 },
    Undyne: { "Fuga pelo corredor": 1.35, "Golpe final": 1.15 },
    "Undyne, a Imortal": { "Chão de lanças": 1.8, Ciclone: 0.65 },
    Mettaton: { "Corredor estreito": 0.75, "Braços em cruz": 1.8, "Chuva de raios": 0.75, "Grande final": 0.65 },
    "Mettaton NEO": { "Disparo NEO": 0.65 },
    Muffet: { "Hora do chá": 0.77, "O bichinho": 0.77 },
    "Guardas Reais 01 e 02": { "Abraço quente": 0.65 },
    "Greater Dog": { "Lança azul": 0.8, "Cachorrinho animado": 0.8 },
    "Knight Knight": { "Lua cheia": 0.75 },
    Madjick: { Orbes: 0.65, "Truque de mágica": 0.76 },
    Glyde: { "Voo rasante": 0.75 },
    "So Sorry": { "Lápis": 0.75 },
    "Mad Dummy": { "Exército de bonecos": 1.35, "Facas de algodão": 1.8, "Fúria de pano": 0.75 },
    Asgore: { "Roda de fogo": 1.35, "Chuva de brasas": 0.75, "Fúria do rei": 0.65 },
    "Flowey (início)": { "Pétalas amigáveis": 0.75 },
    "Omega Flowey": { "Pétalas em X": 1.35, Videiras: 1.8, "Lança-chamas e bombas": 0.75, "Perseverança (livros)": 1.35, "Justiça (revólver)": 1.35, "Canal fora do ar": 0.75 },
    Asriel: { "Chuva de estrelas": 1.35, "Sabre do caos": 1.35, "Hiper-vórtice": 0.75, "Lanças de arco-íris": 0.65 },
    Sans: { "Azul e laranja": 1.35, "Cerco de canhões": 1.35, Gravidade: 1.8, "Grade de ossos": 1.35, "Corredor comprido": 0.8 },
    Rudinn: { Brilho: 0.75 },
    Hathy: { "Roda de corações": 0.75, "Coração grudento": 1.35 },
    "K. Round": { "Pulo real": 1.35, Estrelinhas: 0.84, "Braço comprido": 1.44 },
    Clover: { "Três cabeças": 0.75 },
    Jevil: { "Cerco de espadas": 0.75, "Diamantes subindo": 1.51, "Caos, caos!": 1.8 },
    King: { "Investida com corrente": 0.77, "Caixa encolhendo": 0.75, "Cerco de espadas": 0.65, "Fúria real": 0.65 },
    Queen: { "Raio do monitor": 1.35, "Download final": 0.65 },
    "Spamton NEO": { "Cabecinhas no fio": 1.8, "Tiro grande": 1.11, "Canos e cabeças": 1.35, "Telefone em roda": 0.82, "[[ATAQUE FINAL]]": 0.65 },
    "Tasque Manager": { Gatinhos: 0.75, Chicote: 1.35 },
    Werewire: { "Faíscas": 0.75 },
    Tenna: { "Estrelas do show": 0.75 },
    "Roaring Knight": { "Corte fino": 1.35, "Muralha de espadas": 1.35, "Teia vermelha": 1.51, "Lua vermelha": 0.65, "Espadas em órbita": 0.75, "Escuridão total": 1.29 },
    "Hammer of Justice": { "Machados caindo": 1.35, "Corredor comprido": 1.35 },
    Titan: { Enxame: 0.83, "Estrelas sombrias": 1.8 },
    "Last Breath": { "Fase 1 — Boas-vindas": 1.3, "Fase 1 — Portões": 1.3, "Fase 2 — Rodada sem fim": 1.35, "Fase 3 — Poço": 1.3, "Fase 3 — Caixa viva": 1.3 },
    "Kaizo Knight": { "Luas crescentes": 0.69, Estocada: 1.68, "Neve de diamantes": 0.82, "Visão dupla": 0.8, Guilhotina: 1.68, "Puxão na alma": 0.75, "Cone de luz": 0.77, Bolhas: 1.35, "Muralha de espadas": 1.26, "Teia e mira": 1.35, "Espadas em órbita": 0.8, "Final — Galáxia": 1.8, "Final — Constelação": 1.35 },
  } as Record<string, Record<string, number>>).flatMap(([luta, fases]) =>
    Object.entries(fases).map(([fase, v]) => [`${luta}|${fase}`, v]),
  ),
);

// ---------- atalhos ----------
type Opts = Partial<AttackConfig>;
type TurnDef = Omit<SavedTurn, "cenario"> & { cenario?: Partial<Cenario> };

const a = (tipo: AttackType, duracao: number, o: Opts = {}): AttackConfig => ({ ...defaultAttack(tipo), duracao, ...o });
const t = (nome: string, ataques: AttackConfig[], o: Partial<TurnDef> = {}): TurnDef => ({
  nome,
  fala: "",
  ordem: "sequencia",
  ataques,
  ...o,
});
const juntos = { ordem: "simultaneo" as const };
const azul = { tipoDano: "azul" as const };
const laranja = { tipoDano: "laranja" as const };
const fogo = { cor: "#ff8a2a" };
const em = (e: string, o: Opts = {}): Opts => ({ forma: "emoji", emoji: e, ...o });
const caixa = (l: number, h: number): Opts => ({ caixaL: l, caixaA: h });
const arena = (d: number) => a("arena", d);
const cor = (c: string, o: Opts = {}): Opts => ({ cor: c, ...o });

interface Def {
  nome: string;
  jogo: "Undertale" | "Deltarune" | "Fangame";
  descricao: string;
  hp: number;
  atk: number;
  def: number;
  modo: SoulMode;
  caixa?: [number, number];
  poupavel?: boolean;
  karma?: boolean;
  esquiva?: number;
  acoes?: string[];
  cenario?: Partial<Cenario>;
  turnos: TurnDef[];
}

function build(d: Def): PresetFile {
  const c = defaultConfig();
  const first = d.turnos[0];
  const base: Cenario = { ...defaultCenario(), ...(d.cenario ?? {}) };
  c.monstro = {
    ...c.monstro,
    nome: d.nome,
    imagem: "",
    fala: first.fala,
    hp: d.hp,
    atk: d.atk,
    def: d.def,
    descricao: "",
    acoes: d.acoes ?? ["Conferir", "Conversar", "Elogiar", "Provocar"],
    poupavel: !!d.poupavel,
    esquiva: first.esquiva ?? d.esquiva ?? 0,
    frase: "",
  };
  c.alma.modo = first.modo ?? d.modo;
  if (d.caixa) [c.mecanica.caixaL, c.mecanica.caixaA] = d.caixa;
  c.mecanica.ordem = first.ordem;
  const ajuste = (x: TurnDef) => +(((x.intensidade ?? 1) * (AJUSTE[`${d.nome}|${x.nome}`] ?? 1)).toFixed(2));
  c.mecanica.intensidade = ajuste(first);
  c.mecanica.karma = !!d.karma;
  c.ataques = structuredClone(first.ataques);
  const turnos: SavedTurn[] = d.turnos.map((x) => ({
    modo: d.modo,
    esquiva: d.esquiva ?? 0,
    ...x,
    intensidade: ajuste(x),
    cenario: { ...base, ...(x.cenario ?? {}) },
  }));
  c.cenario = structuredClone(turnos[0].cenario!);
  return { formato: PRESET_FORMAT, versao: 1, nome: d.nome, jogo: d.jogo, descricao: d.descricao, nivel: nivelDe(d.nome), config: c, turnos };
}

const DR: [number, number] = [160, 150]; // caixa quadrada do Deltarune

// ======================================================================
// Undertale
// ======================================================================
const UNDERTALE: Def[] = [
  {
    nome: "Froggit", jogo: "Undertale", descricao: "Moscas lentas e pulos de sapo. A primeira luta perfeita.",
    hp: 30, atk: 4, def: 4, modo: "vermelha", poupavel: true,
    turnos: [
      t("Zumbido", [a("mirado", 4, { velocidade: 0.6, densidade: 0.6, tamanho: 0.6 })]),
      t("Pula-pula", [a("arco", 4, { velocidade: 0.7, densidade: 0.6 })]),
    ],
  },
  {
    nome: "Whimsun", jogo: "Undertale", descricao: "Mariposas em roda e asas caindo. Pede desculpas a cada ataque.",
    hp: 10, atk: 4, def: 0, modo: "vermelha", poupavel: true,
    turnos: [
      t("Ciranda de mariposas", [a("anel", 5, { velocidade: 0.55, densidade: 0.6, tamanho: 0.8 })]),
      t("Asas ao vento", [a("chuva", 4, { velocidade: 0.6, densidade: 0.6 }), a("lateral", 3, { velocidade: 0.6, densidade: 0.5 })]),
    ],
  },
  {
    nome: "Moldsmal", jogo: "Undertale", descricao: "Gelatinas quicando e balançando. Muito sensual.",
    hp: 50, atk: 4, def: 0, modo: "vermelha", poupavel: true,
    turnos: [
      t("Gelatina dançante", [a("ricochete", 5, { velocidade: 0.7, densidade: 0.7, ...cor("#9fe870") })]),
      t("Rebolado", [a("arco", 5, { velocidade: 0.7, ...cor("#9fe870") })]),
    ],
  },
  {
    nome: "Loox", jogo: "Undertale", descricao: "Um olho só e muita encarada.",
    hp: 50, atk: 5, def: 4, modo: "vermelha", poupavel: true,
    turnos: [
      t("Encarada em roda", [a("anel", 5, { velocidade: 0.8 })]),
      t("Olhar perseguidor", [a("mirado", 5, { velocidade: 0.8, densidade: 0.8 })]),
    ],
  },
  {
    nome: "Napstablook", jogo: "Undertale", descricao: "Lágrimas caindo cada vez mais tristes.",
    hp: 88, atk: 10, def: 10, modo: "vermelha", poupavel: true,
    cenario: { fundoCor: "#02040a", efeito: "particulas", corEfeito: "#9fd8ff", escuro: 0.3 },
    turnos: [
      t("Chorinho", [a("chuva", 5, { velocidade: 0.7, densidade: 0.8, forma: "diamante", cor: "#9fd8ff", dano: 1 })]),
      t("Choro de verdade", [a("chuva", 6, { velocidade: 0.9, densidade: 1.6, forma: "diamante", cor: "#9fd8ff", dano: 1 })]),
      t("Nuvem de lágrimas", [a("chuva", 6, { densidade: 1.3, forma: "diamante", cor: "#9fd8ff" }), a("explosao", 6, { densidade: 0.5, forma: "diamante", cor: "#9fd8ff" })], juntos),
    ],
  },
  {
    nome: "Toriel", jogo: "Undertale", descricao: "Mãos que varrem a caixa soltando fogo, colunas pelos lados e chuva de brasas. No fim ela pega leve.",
    hp: 440, atk: 6, def: 1, modo: "vermelha", poupavel: true,
    cenario: { fundoCor: "#0a0200", efeito: "chamas", corEfeito: "#ff8a2a", escuro: 0.25 },
    turnos: [
      t("Mãos quentinhas", [a("maos", 6, { ...fogo })]),
      t("Colunas de fogo", [a("lateral", 5, { ...fogo, velocidade: 0.9 })]),
      t("Corredor de brasas", [a("tunel", 6, { ...fogo, forma: "circulo", velocidade: 0.8 })]),
      t("Mãos e brasas", [a("maos", 7, { ...fogo, densidade: 1.2 }), a("chuva", 7, { ...fogo, densidade: 0.6 })], juntos),
      t("Coração mole", [a("chuva", 6, { ...fogo, velocidade: 0.6, densidade: 0.5 })], { cenario: { escuro: 0.1 } }),
    ],
  },
  {
    nome: "Papyrus", jogo: "Undertale", descricao: "Alma azul: ossos de alturas diferentes para pular, osso azul para ficar parado, corredor comprido e o ataque especial com cachorro.",
    hp: 680, atk: 8, def: 2, modo: "azul", poupavel: true,
    turnos: [
      t("Treino de ossos", [a("ossos", 5, { velocidade: 0.9 })]),
      t("Osso azul!", [a("varredura", 4, { ...azul, densidade: 0.8 }), a("ossos", 3)]),
      t("Escadinha", [a("ossos", 6, { velocidade: 1.1, densidade: 1.3 })]),
      t("Corredor comprido", [a("ossos", 7, { ...caixa(420, 120), densidade: 1.1 })]),
      t("Cortina azul", [a("cortina", 5, { ...azul }), a("ossos", 3, { densidade: 1.2 })]),
      t("Ataque especial (com cachorro)", [a("ossos", 4, { densidade: 1.8, velocidade: 1.2 }), a("varredura", 3, { ...azul }), a("lateral", 3, em("🐶", { densidade: 0.4, dano: 0 })), a("estacas", 3, { ...caixa(300, 150) })], { intensidade: 1.15 }),
    ],
  },
  {
    nome: "Undyne", jogo: "Undertale", descricao: "Escudo contra lanças dos 4 lados (algumas dão a volta) e trechos de alma vermelha com lanças saindo do chão.",
    hp: 1500, atk: 7, def: 0, modo: "verde",
    cenario: { fundoCor: "#00040a", efeito: "grade", corEfeito: "#2a7bff" },
    turnos: [
      t("Lanças de boas-vindas", [a("flechas", 6, { cor: "#4fc3ff" })]),
      t("Lanças traiçoeiras", [a("lancas", 7, { cor: "#4fc3ff", densidade: 1.2 })]),
      t("Fuga pelo corredor", [a("estacas", 5, { cor: "#4fc3ff", ...caixa(320, 120) }), a("mirado", 5, { forma: "seta", cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Chuva de lanças", [a("flechas", 7, { cor: "#4fc3ff", densidade: 1.6, velocidade: 1.3 })]),
      t("Golpe final", [a("lancas", 10, { cor: "#4fc3ff", velocidade: 1.8, densidade: 2 })], { intensidade: 1.2, cenario: { tremor: 0.15 } }),
    ],
  },
  {
    nome: "Undyne, a Imortal", jogo: "Undertale", descricao: "Escudo muito mais rápido, lanças subindo do chão numa caixa minúscula e um cerco de lanças que gira e fecha na alma.",
    hp: 15000, atk: 10, def: 10, modo: "verde",
    cenario: { fundoCor: "#000308", efeito: "particulas", corEfeito: "#4fc3ff", escuro: 0.45, tremor: 0.1 },
    turnos: [
      t("Muralha de lanças", [a("lancas", 8, { cor: "#4fc3ff", velocidade: 1.6, densidade: 1.8 })]),
      t("Chão de lanças", [a("estacas", 6, { densidade: 1.5, cor: "#4fc3ff", ...caixa(100, 100) })], { modo: "vermelha" }),
      t("Lanças convergentes", [a("orbita", 7, { cor: "#4fc3ff", ...caixa(380, 140) }), a("mirado", 7, { forma: "seta", cor: "#4fc3ff", densidade: 0.6 })], { ...juntos, modo: "vermelha", intensidade: 1.15 }),
      t("Ciclone", [a("orbita", 7, { cor: "#4fc3ff", densidade: 1.4, ...caixa(380, 140) }), a("chuva", 7, { forma: "seta", cor: "#4fc3ff", densidade: 0.6 })], { ...juntos, modo: "vermelha", intensidade: 1.2 }),
      t("Determinação", [a("lancas", 12, { cor: "#4fc3ff", velocidade: 2, densidade: 2.3 })], { intensidade: 1.25, cenario: { tremor: 0.25, escuro: 0.6 } }),
    ],
  },
  {
    nome: "Mettaton", jogo: "Undertale", descricao: "Show de TV com alma amarela: atire nas bombas (explodem em cruz), desvie dos blocos, do globo de luz e do corredor estreito.",
    hp: 30000, atk: 10, def: 999, modo: "amarela",
    cenario: { fundoCor: "#0e0018", efeito: "pulso", corEfeito: "#ff5ad1" },
    acoes: ["Conferir", "Pose", "Aplaudir", "Provocar"],
    turnos: [
      t("Bombas no palco", [a("bombas", 7), a("chuva", 7, em("☂", { velocidade: 0.5, densidade: 0.3 }))], juntos),
      t("Pernas!", [a("varredura", 6, { forma: "quadrado" })], { modo: "vermelha" }),
      t("Globo de luz", [a("discoteca", 7), a("chuva", 7, { forma: "quadrado", velocidade: 0.7, densidade: 0.4 })], juntos),
      t("Corredor estreito", [a("bombas", 7, { ...caixa(60, 170), densidade: 0.9 })]),
      t("Braços em cruz", [a("cruz", 6, { cor: "#ffe14a" }), a("laser", 6, { cor: "#ffe14a", densidade: 0.7 })], juntos),
      t("Chuva de raios", [a("espiral", 6, em("⚡", { densidade: 0.7 })), a("bombas", 6, { densidade: 0.6 })], juntos),
      t("Grande final", [a("bombas", 9, { densidade: 1.3 }), a("discoteca", 9), a("chuva", 9, em("⚡", { densidade: 0.5 }))], { ...juntos, intensidade: 1.2, cenario: { efeito: "estrelas", corEfeito: "#ffe14a" } }),
    ],
  },
  {
    nome: "Mettaton NEO", jogo: "Undertale", descricao: "Muito estilo, pouca defesa. Atire primeiro.",
    hp: 30000, atk: 90, def: 9, modo: "amarela",
    cenario: { fundoCor: "#0e0018", efeito: "grade", corEfeito: "#ff5ad1" },
    turnos: [t("Disparo NEO", [a("mirado", 6, { velocidade: 1.6, densidade: 1.8 }), a("canhao", 6, { cor: "#ff5a8a" })], { ...juntos, intensidade: 1.3 })],
  },
  {
    nome: "Muffet", jogo: "Undertale", descricao: "Alma roxa nos fios: aranhas correndo, rosquinhas quicando, croissants que voltam e o bichinho numa caixa alta com mais fios.",
    hp: 1250, atk: 8, def: 0, modo: "roxa", poupavel: true,
    cenario: { fundoCor: "#0d0016", efeito: "particulas", corEfeito: "#c33cff" },
    acoes: ["Conferir", "Pagar", "Elogiar o chá"],
    turnos: [
      t("Aranhas nos fios", [a("fios", 6, em("🕷"))]),
      t("Rosquinhas", [a("ricochete", 6, em("🍩")), a("fios", 6, em("🕷", { densidade: 0.6 }))], juntos),
      t("Croissant bumerangue", [a("bumerangue", 6, em("🥐"))]),
      t("Hora do chá", [a("bumerangue", 7, em("🥐", { densidade: 0.6 })), a("fios", 7, em("🕷", { densidade: 0.7 }))], juntos),
      t("O bichinho", [a("bichinho", 8, { ...caixa(160, 280) }), a("fios", 8, em("🕷", { densidade: 1.2 }))], { ...juntos, intensidade: 1.15, cenario: { tremor: 0.15 } }),
    ],
  },
  {
    nome: "Guardas Reais 01 e 02", jogo: "Undertale", descricao: "Dupla de armadura: mirados, colunas e um fogo cruzado meio sem jeito.",
    hp: 260, atk: 9, def: 6, modo: "vermelha", poupavel: true,
    turnos: [
      t("Armaduras", [a("mirado", 5, { cor: "#ff8a2a" }), a("lateral", 5, { cor: "#ffe14a", densidade: 0.6 })], juntos),
      t("Fogo cruzado", [a("cruz", 6, { cor: "#ff8a2a" })]),
      t("Abraço quente", [a("anel", 5, { ...fogo })]),
    ],
  },
  {
    nome: "Shyren", jogo: "Undertale", descricao: "Notas musicais tímidas.",
    hp: 300, atk: 7, def: 0, modo: "vermelha", poupavel: true,
    turnos: [
      t("Cantarolar", [a("lateral", 6, em("🎵", { velocidade: 0.8 }))]),
      t("Coral", [a("espiral", 6, em("🎵", { velocidade: 0.7, densidade: 0.7 }))]),
    ],
  },
  {
    nome: "Greater Dog", jogo: "Undertale", descricao: "Alma azul, lanças para pular e muito carinho.",
    hp: 105, atk: 15, def: 8, modo: "azul", poupavel: true,
    acoes: ["Conferir", "Fazer carinho", "Brincar", "Ignorar"],
    turnos: [
      t("Lança no chão", [a("ossos", 6, { forma: "seta", velocidade: 1.1 })]),
      t("Lança azul", [a("varredura", 5, { ...azul, forma: "seta" }), a("ossos", 5, { forma: "seta", densidade: 0.6 })], juntos),
      t("Cachorrinho animado", [a("lateral", 5, em("🐶", { densidade: 0.6 })), a("ossos", 5, { forma: "seta" })], juntos),
    ],
  },
  {
    nome: "Knight Knight", jogo: "Undertale", descricao: "Estrelas, sol e lua girando no céu.",
    hp: 230, atk: 8, def: 5, modo: "vermelha", poupavel: true,
    cenario: { efeito: "estrelas", corEfeito: "#ffe14a" },
    turnos: [
      t("Estrelas cadentes", [a("chuva", 5, { forma: "estrela", cor: "#ffe14a" })]),
      t("Sol nascente", [a("espiral", 6, { cor: "#ffb340" })]),
      t("Lua cheia", [a("anel", 5, { forma: "estrela" }), a("chuva", 5, { forma: "estrela", densidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Madjick", jogo: "Undertale", descricao: "Orbes de magia e truques cruzados.",
    hp: 190, atk: 8, def: 5, modo: "vermelha", poupavel: true,
    turnos: [
      t("Orbes", [a("anel", 5, { cor: "#c879ff" })]),
      t("Truque de mágica", [a("mirado", 5, { cor: "#c879ff", forma: "estrela" }), a("corte", 5, { densidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Glyde", jogo: "Undertale", descricao: "Voos rasantes e muita pose.",
    hp: 220, atk: 6, def: 20, modo: "vermelha", poupavel: true,
    turnos: [t("Voo rasante", [a("lateral", 6, { cor: "#9fd8ff", densidade: 0.6 }), a("espiral", 6, { densidade: 0.4 })], juntos)],
  },
  {
    nome: "So Sorry", jogo: "Undertale", descricao: "Rabiscos e lápis voando.",
    hp: 1200, atk: 7, def: 5, modo: "vermelha", poupavel: true,
    turnos: [
      t("Rabiscos", [a("chuva", 6, { forma: "estrela" }), a("ricochete", 6)], juntos),
      t("Lápis", [a("giratorio", 6, em("✏"))]),
    ],
  },
  {
    nome: "Mad Dummy", jogo: "Undertale", descricao: "Bonecos presos em volta da caixa atirando, fileiras de mísseis teleguiados e facas caindo.",
    hp: 200, atk: 7, def: 0, modo: "vermelha",
    turnos: [
      t("Exército de bonecos", [a("torretas", 6)]),
      t("Mísseis teimosos", [a("teleguiado", 6)]),
      t("Facas de algodão", [a("chuva", 5, { forma: "seta", velocidade: 1.1, densidade: 0.7 })]),
      t("Cercado", [a("torretas", 7, { densidade: 1.6 }), a("teleguiado", 7, { densidade: 0.6 })], { ...juntos, intensidade: 1.15 }),
      t("Fúria de pano", [a("torretas", 8, { densidade: 2 }), a("teleguiado", 8), a("chuva", 8, { forma: "seta", densidade: 0.5 })], { ...juntos, intensidade: 1.25 }),
    ],
  },
  {
    nome: "Asgore", jogo: "Undertale", descricao: "Correntes de fogo em losango, mãos que varrem, roda de fogo que fecha e o tridente azul/laranja que cobre a caixa toda.",
    hp: 3500, atk: 10, def: 10, modo: "vermelha",
    cenario: { fundoCor: "#0d0008", efeito: "chamas", corEfeito: "#ff3a2a", escuro: 0.3 },
    turnos: [
      t("Correntes de fogo", [a("ondas", 6, { ...fogo, velocidade: 0.8, densidade: 0.7 })]),
      t("Mãos do rei", [a("maos", 6, { ...fogo, densidade: 1.3 })]),
      t("Roda de fogo", [a("roda", 7, { ...fogo })]),
      t("Tridente", [a("golpecor", 6)]),
      t("Chuva de brasas", [a("chuva", 6, { ...fogo, densidade: 2 }), a("lateral", 6, { ...fogo, densidade: 0.5 })], juntos),
      t("Fúria do rei", [a("golpecor", 9, { densidade: 0.8 }), a("roda", 9, { ...fogo, densidade: 0.8 }), a("maos", 9, { ...fogo })], { ...juntos, intensidade: 1.25, cenario: { tremor: 0.15, escuro: 0.45 } }),
    ],
  },
  {
    nome: "Flowey (início)", jogo: "Undertale", descricao: "Pétalas \"amigáveis\" que nem são tão amigáveis.",
    hp: 1, atk: 9, def: 0, modo: "vermelha",
    turnos: [
      t("Pétalas amigáveis", [a("anel", 5, { velocidade: 0.7, forma: "estrela", cor: "#ffffff" })]),
      t("Sem saída", [a("anel", 6, { velocidade: 0.4, densidade: 2, forma: "estrela" })], { cenario: { escuro: 0.5 } }),
    ],
  },
  {
    nome: "Omega Flowey", jogo: "Undertale", descricao: "Sem caixa: pétalas em X, videiras com aviso, lança-chamas e moscas. Depois, uma fase para cada cor de alma pedida ao mestre.",
    hp: 9999, atk: 99, def: 99, modo: "vermelha",
    cenario: { fundoCor: "#001000", efeito: "estatica", corEfeito: "#9cff6a", escuro: 0.4, tremor: 0.1 },
    turnos: [
      t("Pétalas em X", [arena(7), a("espiral", 7, { forma: "estrela", densidade: 0.9 }), a("mirado", 7, { forma: "estrela" })], juntos),
      t("Videiras", [arena(7), a("corte", 7, { densidade: 1.2 }), a("chuva", 7, { forma: "estrela", densidade: 0.5 })], juntos),
      t("Lança-chamas e bombas", [arena(7), a("cone", 7, { ...fogo, densidade: 0.8 }), a("explosao", 7, { densidade: 1.2 })], juntos),
      t("Moscas e dioneias", [arena(7), a("vortice", 7, em("🪰")), a("teleguiado", 7, em("🪰"))], juntos),
      t("Paciência (facas)", [arena(6), a("nevasca", 6, { forma: "seta", cor: "#4fffff" })], juntos),
      t("Bravura (luvas)", [arena(6), a("anel", 6, em("🥊"))], juntos),
      t("Integridade (sapatilhas)", [a("ossos", 6, em("🩰")), a("chuva", 6, { forma: "estrela", densidade: 0.5 })], { ...juntos, modo: "azul" }),
      t("Perseverança (livros)", [a("fios", 6, em("📖")), a("bumerangue", 6, em("📖", { densidade: 0.5 }))], { ...juntos, modo: "roxa" }),
      t("Bondade (frigideiras)", [a("flechas", 6, { ...fogo })], { modo: "verde" }),
      t("Justiça (revólver)", [a("mira", 6), a("bombas", 6, { densidade: 0.6 })], { ...juntos, modo: "amarela" }),
      t("Canal fora do ar", [arena(10), a("mirado", 10, { forma: "estrela" }), a("cone", 10, { ...fogo, densidade: 0.6 }), a("explosao", 10)], { ...juntos, intensidade: 1.35, cenario: { tremor: 0.3 } }),
    ],
  },
  {
    nome: "Asriel", jogo: "Undertale", descricao: "Estrelas que estouram, raios com aviso, sabre do caos numa caixa pequena, vórtice de losangos, lanças de arco-íris e as almas perdidas.",
    hp: 99999, atk: 99, def: 99, modo: "vermelha", caixa: [240, 170],
    cenario: { fundoCor: "#05001a", efeito: "estrelas", corEfeito: "#c879ff" },
    turnos: [
      t("Chuva de estrelas", [a("explosao", 6, { forma: "estrela", cor: "#ffe14a" }), a("chuva", 6, { forma: "estrela", densidade: 0.6 })], juntos),
      t("Quebra-choque", [a("raios", 6, { cor: "#bfe8ff" })]),
      t("Sabre do caos", [a("corte", 6, { densidade: 1.5, ...caixa(110, 100) })]),
      t("Canhão do caos", [a("mirado", 6, { forma: "diamante", densidade: 1.6 }), a("estilhacos", 6, { densidade: 0.6 })], juntos),
      t("Hiper-vórtice", [a("vortice", 7, { forma: "diamante", cor: "#ffffff" })], { cenario: { fundoCor: "#000000", efeito: "pulso", corEfeito: "#ffffff" } }),
      t("Lanças de arco-íris", [a("crescente", 7, { cor: "#ff9ae6" }), a("crescente", 7, { cor: "#9affe0", densidade: 0.6 })], juntos),
      t("Alma perdida: ossos", [a("ossos", 6), a("varredura", 6, { ...azul, densidade: 0.6 })], { ...juntos, modo: "azul" }),
      t("Alma perdida: lanças", [a("lancas", 6, { cor: "#4fc3ff" })], { modo: "verde" }),
      t("Alma perdida: fogo", [a("roda", 6, { ...fogo }), a("maos", 6, { ...fogo, densidade: 0.6 })], juntos),
      t("Fim de todas as coisas", [a("vortice", 9, { forma: "estrela", densidade: 0.7 }), a("raios", 9, { cor: "#ffffff", densidade: 0.4 })], { ...juntos, intensidade: 1.35, cenario: { efeito: "pulso", corEfeito: "#ff5ad1", tremor: 0.2 } }),
    ],
  },
  {
    nome: "Sans", jogo: "Undertale", descricao: "Esquiva de tudo, tem karma (KR), canhões em formação, pancadas, plataformas, grade e o ataque especial. Na última fase ele cansa.",
    hp: 1, atk: 1, def: 1, modo: "vermelha", caixa: [240, 160], karma: true, esquiva: 100,
    acoes: ["Conferir", "Contar piada", "Dormir"],
    turnos: [
      t("Boas-vindas", [a("ossos", 2.5, { velocidade: 1.4, densidade: 1.4 }), a("canhao", 2.5, { densidade: 1.3 }), a("pancada", 3)]),
      t("Azul e laranja", [a("cortina", 3, { ...azul }), a("cortina", 3, { ...laranja }), a("ossos", 3, { densidade: 1.2 })]),
      t("Cerco de canhões", [a("cerco", 7)]),
      t("Gravidade", [a("pancada", 4, { densidade: 1.3 }), a("plataformas", 6)]),
      t("Grade de ossos", [a("grade", 6), a("canhao", 6, { densidade: 0.6 })], juntos),
      t("Túnel", [a("tunel", 7, { velocidade: 1.3 })]),
      t("Corredor comprido", [a("ossos", 7, { ...caixa(520, 70), densidade: 1.4, velocidade: 1.3 })], { modo: "azul" }),
      t("Ataque especial", [a("cerco", 3), a("pancada", 3), a("cruz", 3), a("grade", 3), a("ponteiro", 4), a("corte", 3)], { intensidade: 1.3 }),
      t("Cansado (sem esquiva)", [a("ossos", 6, { velocidade: 0.6, densidade: 0.5 })], { esquiva: 0, cenario: { escuro: 0.3 } }),
    ],
  },
];

// ======================================================================
// Deltarune
// ======================================================================
const DELTARUNE: Def[] = [
  {
    nome: "Lancer", jogo: "Deltarune", descricao: "Espadas de baralho caindo, pás arremessadas e uma moto muito barulhenta.",
    hp: 210, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Chuva de espadas", [a("chuva", 5, em("♠", { cor: "#ffffff", velocidade: 0.8 }))]),
      t("Pás arremessadas", [a("mirado", 5, em("♠", { velocidade: 0.8, densidade: 0.7 }))]),
      t("Vruum!", [a("lateral", 5, { velocidade: 1.1 }), a("cortina", 3, { densidade: 0.6 })]),
    ],
  },
  {
    nome: "Rudinn", jogo: "Deltarune", descricao: "Diamantes mirados e brilho em roda.",
    hp: 90, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Diamantes", [a("mirado", 5, { forma: "diamante", cor: "#5ad1ff", velocidade: 0.8 })]),
      t("Brilho", [a("anel", 5, { forma: "diamante", cor: "#5ad1ff", velocidade: 0.8 })]),
    ],
  },
  {
    nome: "Hathy", jogo: "Deltarune", descricao: "Corações em roda e um coração que persegue.",
    hp: 110, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Roda de corações", [a("anel", 5, em("♥", { cor: "#ff5a8a", velocidade: 0.8 }))]),
      t("Coração grudento", [a("teleguiado", 5, em("♥", { densidade: 0.5, velocidade: 0.8 }))]),
    ],
  },
  {
    nome: "K. Round", jogo: "Deltarune", descricao: "Pula por cima da caixa, estrelinhas quicando e um braço comprido que varre.",
    hp: 2000, atk: 8, def: 2, modo: "vermelha", caixa: DR,
    turnos: [
      t("Pulo real", [a("arco", 5, { densidade: 0.9 }), a("estacas", 5, { densidade: 0.7 })], juntos),
      t("Estrelinhas", [a("ricochete", 5, { forma: "estrela", cor: "#ffffff", tamanho: 0.7 })]),
      t("Braço comprido", [a("varredura", 5, { densidade: 0.8 }), a("chuva", 5, { forma: "estrela", densidade: 0.4 })], juntos),
      t("Terremoto", [a("estacas", 6, { densidade: 1.3 }), a("explosao", 6, { densidade: 0.8 })], { ...juntos, cenario: { tremor: 0.3 } }),
    ],
  },
  {
    nome: "Clover", jogo: "Deltarune", descricao: "Três cabeças, três opiniões, três ataques.",
    hp: 600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Três cabeças", [a("espiral", 7, { densidade: 0.45 }), a("mirado", 7, { densidade: 0.45 }), a("chuva", 7, { densidade: 0.45 })], juntos)],
  },
  {
    nome: "Jevil", jogo: "Deltarune", descricao: "Baralho cercando, corações em espiral, foices, carrossel, bombas de espadas e o caos final sem caixa. Chefe secreto.",
    hp: 3500, atk: 10, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    cenario: { fundoCor: "#08000f", efeito: "estrelas", corEfeito: "#ff5ad1", tremor: 0.05 },
    acoes: ["Conferir", "Ser alegre", "Hipnotizar", "Brincar"],
    turnos: [
      t("Baralho caindo", [a("chuva", 6, em("♣", { densidade: 1.1 })), a("lateral", 6, em("♠", { densidade: 0.5 }))], juntos),
      t("Cerco de espadas", [a("anel", 6, em("♠", { densidade: 1.2 }))]),
      t("Corações em espiral", [a("espiral", 6, em("♥", { cor: "#ff5a5a" }))]),
      t("Foices dançantes", [a("giratorio", 6, { cor: "#c879ff", densidade: 1.2, tamanho: 1.3 })]),
      t("Carrossel", [a("lateral", 6, em("🐴", { densidade: 0.9 })), a("chuva", 6, em("♦", { densidade: 0.4 }))], juntos),
      t("Diamantes subindo", [a("arco", 6, em("♦", { cor: "#ff5a5a", densidade: 1.2 }))]),
      t("Bombas de espadas", [a("bolhas", 6, em("♠")), a("explosao", 6, em("♣", { densidade: 0.6 }))], juntos),
      t("Caos, caos!", [arena(9), a("giratorio", 9, { cor: "#ffffff", densidade: 1.1 }), a("visaodupla", 9), a("chuva", 9, em("♠", { densidade: 0.6 }))], { ...juntos, intensidade: 1.15, cenario: { efeito: "pulso", tremor: 0.15 } }),
    ],
  },
  {
    nome: "King", jogo: "Deltarune", descricao: "Espadas atiradas, investidas com corrente, a caixa encolhendo e um cerco de espadas.",
    hp: 2000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#0a0005", efeito: "pulso", corEfeito: "#2a3cff" },
    turnos: [
      t("Espadas atiradas", [a("mirado", 6, em("♠", { densidade: 1.1 }))]),
      t("Investida com corrente", [a("estocada", 6, { densidade: 0.8 }), a("lateral", 6, em("♠", { densidade: 0.5 }))], juntos),
      t("Caixa encolhendo", [a("pinos", 6, { ...caixa(100, 90), densidade: 0.8 })]),
      t("Corrente que chicoteia", [a("corte", 6, { densidade: 1.1 })]),
      t("Cerco de espadas", [a("anel", 6, em("♠")), a("pinos", 6, { densidade: 0.6 })], juntos),
      t("Fúria real", [a("mirado", 8, em("♠")), a("corte", 8, { densidade: 0.8 }), a("pinos", 8, { densidade: 0.6 })], { ...juntos, intensidade: 1.15, cenario: { tremor: 0.15 } }),
    ],
  },
  {
    nome: "Berdly", jogo: "Deltarune", descricao: "Ventania que puxa e penas mirando.",
    hp: 1600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Ventania", [a("vortice", 6, { cor: "#9fd8ff", velocidade: 0.8 })]),
      t("Penas", [a("mirado", 6, { forma: "seta", cor: "#5ad1ff" })]),
    ],
  },
  {
    nome: "Queen", jogo: "Deltarune", descricao: "Penas do ajudante, a taça de ácido, raio do monitor, rostinhos e redes, palavras voando e o download final.",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#14000a", efeito: "grade", corEfeito: "#5aff8a" },
    turnos: [
      t("Penas do ajudante", [a("mirado", 6, { forma: "seta", cor: "#ffffff", densidade: 0.9 })]),
      t("Brinde ácido", [a("bolhas", 6, { cor: "#5aff8a" }), a("chuva", 6, { forma: "gota", cor: "#ffffff", densidade: 0.5 })], juntos),
      t("Raio do monitor", [a("laser", 6, { cor: "#ffe14a", densidade: 0.8 }), a("ponteiro", 6, { cor: "#ffffff" })], juntos),
      t("Rostinhos e redes", [a("chuva", 6, em("🙂", { densidade: 1.2 })), a("explosao", 6, { forma: "quadrado", cor: "#5aff8a", densidade: 0.6 })], juntos),
      t("Palavras voando", [a("lateral", 6, em("💬", { velocidade: 0.9 }))]),
      t("Download final", [a("pinos", 9, { cor: "#5aff8a" }), a("chuva", 9, em("🙂", { densidade: 0.8 })), a("canhao", 9, { cor: "#5aff8a", densidade: 0.6 })], { ...juntos, intensidade: 1.15, cenario: { tremor: 0.1 } }),
    ],
  },
  {
    nome: "Spamton", jogo: "Deltarune", descricao: "Cifrões e OFERTAS voando em volta da caixa e cabecinhas que vêm da direita.",
    hp: 800, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    cenario: { efeito: "estatica", corEfeito: "#ffe14a" },
    turnos: [
      t("Ofertas imperdíveis", [a("espiral", 6, em("💲", { densidade: 0.7 }))]),
      t("Cabecinhas", [a("lateral", 6, { forma: "quadrado", cor: "#ffffff", densidade: 0.7 }), a("mirado", 6, { forma: "quadrado", densidade: 0.5 })], juntos),
    ],
  },
  {
    nome: "Spamton NEO", jogo: "Deltarune", descricao: "Alma amarela numa caixa larga: cabecinhas, tiro grande do braço que vira estilhaços, ovos, telefone em roda e o ataque final. Chefe secreto.",
    hp: 4999, atk: 13, def: 0, modo: "amarela", caixa: [230, 100],
    cenario: { fundoCor: "#000814", efeito: "estatica", corEfeito: "#ffe14a", tremor: 0.08 },
    acoes: ["Conferir", "Ligar para ajuda", "Comprar"],
    turnos: [
      t("Cabecinhas no fio", [a("lateral", 6, { forma: "quadrado", cor: "#5ad1ff", densidade: 0.9 })]),
      t("Tiro grande", [a("estilhacos", 6, { densidade: 0.9 }), a("mirado", 6, { forma: "diamante", densidade: 0.6 })], juntos),
      t("Canos e cabeças", [a("bombas", 6, { cor: "#ffffff" }), a("lateral", 6, { forma: "quadrado", cor: "#5ad1ff", densidade: 0.5 })], juntos),
      t("Ovos e balões", [a("ricochete", 6, em("🥚")), a("chuva", 6, { cor: "#ffe14a", densidade: 0.6 })], juntos),
      t("Telefone em roda", [a("orbita", 6, em("☎", { cor: "#5aff8a" }))]),
      t("Corte de fios", [a("lateral", 6, { forma: "seta", cor: "#ffffff", velocidade: 1.2 })], { modo: "vermelha" }),
      t("[[ATAQUE FINAL]]", [a("espiral", 9, em("💲", { densidade: 0.6 })), a("estilhacos", 9, { densidade: 0.5 }), a("lateral", 9, { forma: "quadrado", densidade: 0.5 })], { ...juntos, intensidade: 1.15, cenario: { tremor: 0.25, corEfeito: "#ff5ad1" } }),
    ],
  },
  {
    nome: "Tasque Manager", jogo: "Deltarune", descricao: "Gatinhos quicando e chicotadas.",
    hp: 900, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Gatinhos", [a("ricochete", 6, em("🐈")), a("mirado", 6, { densidade: 0.6 })], juntos),
      t("Chicote", [a("corte", 6, { densidade: 0.8 })]),
    ],
  },
  {
    nome: "Werewire", jogo: "Deltarune", descricao: "Fios formando corredores e faíscas.",
    hp: 600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Fios", [a("tunel", 6, { cor: "#5ad1ff" })]),
      t("Faíscas", [a("chuva", 6, { forma: "estrela", cor: "#ffe14a" })]),
    ],
  },
  {
    nome: "Tenna", jogo: "Deltarune", descricao: "Previsão do tempo ao vivo: chuva, neve, sol e lua, raios no estúdio e estrelas do show.",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000818", efeito: "estatica", corEfeito: "#ffe14a" },
    turnos: [
      t("Previsão: chuva", [a("chuva", 6, { forma: "gota", cor: "#9fd8ff", densidade: 1.2 })]),
      t("Previsão: neve", [a("nevasca", 6, { cor: "#ffffff", densidade: 0.7 })]),
      t("Sol e lua", [a("espiral", 6, em("☀", { densidade: 0.6 })), a("arco", 6, em("🌙", { densidade: 0.5 }))], juntos),
      t("Raios no estúdio", [a("raios", 6, { cor: "#ffe14a" })]),
      t("Estrelas do show", [a("ricochete", 6, { forma: "estrela", cor: "#ffffff" }), a("explosao", 6, { forma: "estrela", densidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Roaring Knight", jogo: "Deltarune", descricao: "Corte fino, cone de estrelas, feixe vermelho com losangos, muralha e órbita de espadas, teia vermelha e o final sem caixa. Extremamente difícil.",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000000", efeito: "particulas", corEfeito: "#ffffff", escuro: 0.6, tremor: 0.1 },
    turnos: [
      t("Corte fino", [a("estocada", 6)]),
      t("Cone de estrelas", [a("cone", 6, { densidade: 0.8 }), a("chuva", 6, { forma: "estrela6", densidade: 0.5 })], juntos),
      t("Feixe vermelho", [a("laser", 6, { cor: "#ff2040", tamanho: 1.4 }), a("pinos", 6, { densidade: 0.8 })], juntos),
      t("Muralha de espadas", [a("muralha", 7)]),
      t("Teia vermelha", [a("teia", 7)]),
      t("Lua vermelha", [a("crescente", 6, { cor: "#ff2040" }), a("estilhacos", 6, { cor: "#ff2040", densidade: 0.6 })], juntos),
      t("Espadas em órbita", [a("orbita", 7)]),
      t("Escuridão total", [arena(10), a("galaxia", 10, { densidade: 0.9 }), a("corte", 10, { densidade: 0.6 })], { ...juntos, intensidade: 1.15, cenario: { escuro: 0.85, tremor: 0.25 } }),
    ],
  },
  {
    nome: "Hammer of Justice", jogo: "Deltarune", descricao: "Quase tudo com alma verde: flechas dos quatro lados e as traiçoeiras. Entre elas, machados caindo e um corredor comprido. Chefe secreto.",
    hp: 9999, atk: 15, def: 10, modo: "verde",
    cenario: { fundoCor: "#000a02", efeito: "pulso", corEfeito: "#9cff6a" },
    turnos: [
      t("Defesa", [a("flechas", 7, { cor: "#ffe14a", densidade: 1.2 })]),
      t("Flechas traiçoeiras", [a("lancas", 7, { cor: "#ffe14a" })]),
      t("Machados caindo", [a("chuva", 6, em("🪓", { ...caixa(140, 140), densidade: 0.8 }))], { modo: "vermelha" }),
      t("Sinos da justiça", [a("flechas", 8, { cor: "#ffe14a", velocidade: 1.4, densidade: 1.5 })]),
      t("Corredor comprido", [a("muralha", 7, { ...caixa(440, 70), densidade: 0.8 })], { modo: "vermelha" }),
      t("Justiça final", [a("lancas", 10, { cor: "#ffe14a", velocidade: 1.4, densidade: 1.6 })], { intensidade: 1.15, cenario: { tremor: 0.15 } }),
    ],
  },
  {
    nome: "Titan", jogo: "Deltarune", descricao: "Tudo no escuro: só se vê perto da alma. Sombras perseguem, enxames giram e um colapso puxa tudo.",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#050008", efeito: "particulas", corEfeito: "#c879ff", escuro: 0.7 },
    turnos: [
      t("Sombras", [a("lanterna", 7), a("teleguiado", 7, { cor: "#ffffff", densidade: 0.8 })], juntos),
      t("Enxame", [a("lanterna", 7), a("anel", 7, { cor: "#ffffff" }), a("chuva", 7, { forma: "estrela6", densidade: 0.4 })], juntos),
      t("Mãos da escuridão", [a("lanterna", 7), a("maos", 7, { cor: "#c879ff" })], juntos),
      t("Estrelas sombrias", [a("lanterna", 7, { tamanho: 1.3 }), a("estilhacos", 7, { cor: "#ff2040", densidade: 0.8 })], juntos),
      t("Colapso", [a("lanterna", 9), a("vortice", 9, { cor: "#c879ff", densidade: 0.6 }), a("teleguiado", 9, { densidade: 0.3 })], { ...juntos, intensidade: 1.15, cenario: { tremor: 0.2 } }),
    ],
  },
];

// ======================================================================
// Fangames
// ======================================================================
const LB2 = { fundoCor: "#0a0800", efeito: "pulso" as const, corEfeito: "#ffe14a", escuro: 0.3 };
const LB3 = { efeito: "estatica" as const, corEfeito: "#ff2040", escuro: 0.5, tremor: 0.15 };

const FANGAMES: Def[] = [
  {
    nome: "Last Breath", jogo: "Fangame",
    descricao: "Paródia do fangame (vista em vídeo): rodadas longas com muitos ataques seguidos, a alma mudando de cor no meio e KR. A fase 2 é uma rodada só, começando sem caixa. Depois ele cansa e volta pior.",
    hp: 1, atk: 1, def: 1, modo: "vermelha", caixa: [240, 160], karma: true, esquiva: 100,
    acoes: ["Conferir", "Implorar", "Desafiar"],
    turnos: [
      t("Fase 1 — Boas-vindas", [
        a("ossos", 2.5, { modo: "azul" }),
        a("plataformas", 4),
        a("canhao", 2.5, { modo: "vermelha" }),
        a("cerco", 3),
        a("grade", 3, { modo: "vermelha" }),
        a("cruz", 3),
      ]),
      t("Fase 1 — Portões", [
        a("cortina", 2.5, { ...azul }),
        a("cortina", 2.5, { ...laranja }),
        a("tunel", 3.5),
        a("laser", 2.5, { tamanho: 2.2, densidade: 0.7 }),
        a("corte", 3),
        a("ossos", 3, { modo: "azul" }),
      ]),
      t("Fase 1 — Gravidade", [
        a("pancada", 3.5),
        a("plataformas", 4.5),
        a("ossos", 2.5, { modo: "azul" }),
        a("giratorio", 3, { ...laranja, ...caixa(110, 110), modo: "vermelha" }),
        a("estacas", 3, { ...caixa(80, 220), modo: "vermelha" }),
        a("canhao", 3),
      ]),
      t(
        "Fase 2 — Rodada sem fim",
        [
          arena(15),
          a("cerco", 5, { densidade: 0.9 }),
          a("maos", 5, { inicio: 4, cor: "#ffffff" }),
          a("laser", 4, { inicio: 8, tamanho: 1.6, densidade: 0.8 }),
          a("giratorio", 4, { inicio: 11 }),
          a("cortina", 3, { inicio: 15, ...laranja }),
          a("ossos", 3, { inicio: 15 }),
          a("corte", 4, { inicio: 18 }),
          a("canhao", 4, { inicio: 19, densidade: 0.8 }),
          a("cerco", 5, { inicio: 22, densidade: 1.3 }),
          a("cruz", 3, { inicio: 27 }),
          a("pancada", 5, { inicio: 30 }),
          a("plataformas", 5, { inicio: 30 }),
        ],
        { ...juntos, cenario: LB2 },
      ),
      t("Fase 2 — Cansado", [a("ossos", 6, { velocidade: 0.6, densidade: 0.5 })], { cenario: { ...LB2, escuro: 0.45 } }),
      t("Fase 3 — Poço", [
        a("plataformas", 6, { ...caixa(170, 280), modo: "azul" }),
        a("ossos", 3, { modo: "azul" }),
        a("mira", 3, { modo: "vermelha", cor: "#ffe14a" }),
        a("cortina", 3, { cor: "#ff2040" }),
        a("varredura", 3, { ...azul }),
        a("ossos", 3, { modo: "vermelha", densidade: 1.2 }),
        a("ponteiro", 4),
        a("cerco", 4, { densidade: 1.3 }),
      ], { cenario: LB3, esquiva: 70 }),
      t("Fase 3 — Caixa viva", [
        a("deriva", 12),
        a("giratorio", 4, { densidade: 1.1 }),
        a("canhao", 4, { inicio: 4 }),
        a("ossos", 4, { inicio: 8, modo: "azul" }),
      ], { ...juntos, cenario: LB3, esquiva: 45 }),
      t("Fase 3 — Último suspiro", [
        a("cerco", 3),
        a("pancada", 3),
        a("ossos", 2.5, { modo: "azul" }),
        a("canhao", 2.5, { modo: "vermelha" }),
        a("grade", 3),
        a("corte", 3),
        a("cortina", 2.5, { ...azul }),
        a("cortina", 2.5, { ...laranja }),
        a("plataformas", 4),
        a("ponteiro", 3.5, { modo: "vermelha" }),
        a("giratorio", 3, { ...laranja, ...caixa(110, 110) }),
        a("estacas", 3, { ...caixa(80, 220) }),
        a("laser", 2.5, { tamanho: 2.2, densidade: 0.7 }),
        a("cruz", 3),
        a("cerco", 4, { densidade: 1.4 }),
      ], { cenario: { ...LB3, escuro: 0.65, tremor: 0.25 }, esquiva: 20 }),
    ],
  },
];

// Kaizo Knight: paródia montada assistindo uma luta completa do fangame (só os padrões, desenho próprio).
const KN = { fundoCor: "#04020a", efeito: "particulas" as const, corEfeito: "#b8a6ff", escuro: 0.45 };
const KN_FIM = { fundoCor: "#050a1f", efeito: "estrelas" as const, corEfeito: "#8fb0ff", escuro: 0.25, tremor: 0.05 };
const alta = { caixaL: 110, caixaA: 170 };

FANGAMES.push({
  nome: "Kaizo Knight", jogo: "Fangame",
  descricao: "O cavaleiro de verdade, sem enrolação: luas crescentes, estocadas, neve de diamantes, X azul, cone de luz, espadas em órbita e um final sem caixa. Muito difícil.",
  hp: 9999, atk: 18, def: 12, modo: "vermelha", caixa: [170, 150], cenario: KN,
  acoes: ["Conferir", "Encarar de volta", "Pedir uma trégua"],
  turnos: [
    t("Luas crescentes", [a("crescente", 7, { ...alta })]),
    t("Estocada", [a("estocada", 4), a("rabisco", 4, { densidade: 0.8 })]),
    t("Pilares rabiscados", [a("rabisco", 6, { densidade: 1.1 }), a("pinos", 6, { densidade: 0.8 })], juntos),
    t("Neve de diamantes", [a("nevasca", 8)], { cenario: { corEfeito: "#dff6ff" } }),
    t("Visão dupla", [a("visaodupla", 7), a("pinos", 7), a("rabisco", 7, { densidade: 0.7 })], { ...juntos, cenario: { efeito: "estatica" } }),
    t("X azul", [a("xazul", 6), a("espada", 6, { densidade: 0.7 })], juntos),
    t("Guilhotina", [a("guilhotina", 6), a("pinos", 6, { densidade: 0.6 })], juntos),
    t("Puxão na alma", [a("vortice", 7, { cor: "#8f7bff", velocidade: 0.9 }), a("estrelaazul", 7, { densidade: 0.8 })], { ...juntos, cenario: { escuro: 0.65 } }),
    t("Cone de luz", [a("cone", 7), a("estilhacos", 7, { densidade: 0.8 })], juntos),
    t("Bolhas", [a("bolhas", 7, { caixaL: 170, caixaA: 170 }), a("nevasca", 7, { densidade: 0.4 })], juntos),
    t("Muralha de espadas", [a("muralha", 8, { ...alta, caixaL: 140 })]),
    t("Estrela azul", [a("estrelaazul", 6), a("guilhotina", 6, { densidade: 0.6 })], juntos),
    t("Teia e mira", [a("teia", 4), a("mira", 4)], { intensidade: 1.15 }),
    t("Espadas em órbita", [a("orbita", 7), a("estilhacos", 7, { densidade: 0.6 })], { ...juntos, intensidade: 1.15 }),
    t("Final — Galáxia", [a("arena", 10), a("galaxia", 10)], { ...juntos, intensidade: 1.2, cenario: KN_FIM }),
    t("Final — Constelação", [a("arena", 11), a("constelacao", 11), a("teia", 11, { densidade: 0.5 }), a("mira", 11, { densidade: 0.5 })], { ...juntos, intensidade: 1.25, cenario: KN_FIM }),
  ],
});

export const BUILTIN_PRESETS: PresetFile[] = [...UNDERTALE, ...DELTARUNE, ...FANGAMES].map(build);

/** Aceita um preset exportado ou só uma configuração (backup antigo). */
export function parsePreset(raw: unknown): PresetFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PresetFile> & Partial<BattleConfig>;
  if (r.formato === PRESET_FORMAT && r.config) {
    return {
      formato: PRESET_FORMAT,
      versao: 1,
      nome: String(r.nome || "Preset"),
      jogo: r.jogo,
      descricao: String(r.descricao || ""),
      config: normalizeConfig(r.config),
      turnos: Array.isArray(r.turnos) ? r.turnos : [],
    };
  }
  if (r.monstro || r.ataques) {
    const config = normalizeConfig(r);
    return { formato: PRESET_FORMAT, versao: 1, nome: config.monstro.nome || "Preset", descricao: "", config, turnos: [] };
  }
  return null;
}
