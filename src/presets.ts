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
  config: BattleConfig;
  turnos: SavedTurn[];
}

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
  c.mecanica.intensidade = first.intensidade ?? 1;
  c.mecanica.karma = !!d.karma;
  c.ataques = structuredClone(first.ataques);
  const turnos: SavedTurn[] = d.turnos.map((x) => ({
    modo: d.modo,
    intensidade: 1,
    esquiva: d.esquiva ?? 0,
    ...x,
    cenario: { ...base, ...(x.cenario ?? {}) },
  }));
  c.cenario = structuredClone(turnos[0].cenario!);
  return { formato: PRESET_FORMAT, versao: 1, nome: d.nome, jogo: d.jogo, descricao: d.descricao, config: c, turnos };
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
    nome: "Toriel", jogo: "Undertale", descricao: "Mãos de fogo, leque de chamas e um cerco que ela mesma desvia de você.",
    hp: 440, atk: 6, def: 1, modo: "vermelha", poupavel: true,
    cenario: { fundoCor: "#0a0200", efeito: "chamas", corEfeito: "#ff8a2a", escuro: 0.25 },
    turnos: [
      t("Mãos quentinhas", [a("arco", 3, { ...fogo }), a("chuva", 3, { ...fogo, velocidade: 0.9 })]),
      t("Leque de chamas", [a("espiral", 5, { ...fogo, velocidade: 0.8, densidade: 0.8 })]),
      t("Cerco de fogo", [a("anel", 4, { ...fogo, velocidade: 0.9 }), a("lateral", 3, { ...fogo, densidade: 0.7 })]),
      t("Coração mole", [a("chuva", 6, { ...fogo, velocidade: 0.6, densidade: 0.5 })], { cenario: { escuro: 0.1 } }),
      t("Fogo cruzado", [a("arco", 7, { ...fogo }), a("chuva", 7, { ...fogo, densidade: 0.8 })], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Papyrus", jogo: "Undertale", descricao: "Alma azul, ossos para pular, osso azul para ficar parado e um ataque especial com cachorro.",
    hp: 680, atk: 8, def: 2, modo: "azul", poupavel: true,
    turnos: [
      t("Treino de ossos", [a("ossos", 5, { velocidade: 0.9 })]),
      t("Osso azul!", [a("varredura", 4, { ...azul, densidade: 0.8 }), a("ossos", 3)]),
      t("Corredor de ossos", [a("ossos", 6, { velocidade: 1.3, densidade: 1.5 })]),
      t("Cortina azul", [a("cortina", 5, { ...azul }), a("ossos", 3, { densidade: 1.2 })]),
      t("Ataque especial (com cachorro)", [a("ossos", 4, { densidade: 1.8, velocidade: 1.2 }), a("varredura", 3, { ...azul }), a("lateral", 3, em("🐶", { densidade: 0.4, dano: 0 }))], { intensidade: 1.15 }),
    ],
  },
  {
    nome: "Undyne", jogo: "Undertale", descricao: "Escudo contra lanças (algumas dão a volta!) e uma perseguição de alma vermelha.",
    hp: 1500, atk: 7, def: 0, modo: "verde",
    cenario: { fundoCor: "#00040a", efeito: "pulso", corEfeito: "#2a7bff" },
    turnos: [
      t("Lanças de boas-vindas", [a("flechas", 6, { cor: "#4fc3ff" })]),
      t("Lanças traiçoeiras", [a("lancas", 7, { cor: "#4fc3ff", densidade: 1.2 })]),
      t("Perseguição", [a("estacas", 5, { cor: "#4fc3ff" }), a("mirado", 5, { forma: "seta", cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Chuva de lanças", [a("chuva", 6, { forma: "seta", cor: "#4fc3ff", densidade: 1.3 }), a("cruz", 6, { cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Golpe final", [a("lancas", 10, { cor: "#4fc3ff", velocidade: 1.8, densidade: 2 })], { intensidade: 1.2, cenario: { tremor: 0.15 } }),
    ],
  },
  {
    nome: "Undyne, a Imortal", jogo: "Undertale", descricao: "Tudo da Undyne, só que sem piedade e com a tela tremendo.",
    hp: 15000, atk: 10, def: 10, modo: "verde",
    cenario: { fundoCor: "#000308", efeito: "particulas", corEfeito: "#4fc3ff", escuro: 0.45, tremor: 0.1 },
    turnos: [
      t("Muralha de lanças", [a("lancas", 8, { cor: "#4fc3ff", velocidade: 1.6, densidade: 1.8 })]),
      t("Chão de lanças", [a("estacas", 6, { densidade: 1.5, cor: "#4fc3ff" }), a("mirado", 6, { forma: "seta", densidade: 1.3, cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Dança das lanças", [a("cerco", 7, { cor: "#4fc3ff" }), a("chuva", 7, { forma: "seta", cor: "#4fc3ff" })], { ...juntos, modo: "vermelha", intensidade: 1.2 }),
      t("Cortes do oceano", [a("corte", 6, { densidade: 1.3 }), a("estacas", 6, { cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Determinação", [a("lancas", 12, { cor: "#4fc3ff", velocidade: 2, densidade: 2.3 })], { intensidade: 1.25, cenario: { tremor: 0.25, escuro: 0.6 } }),
    ],
  },
  {
    nome: "Mettaton", jogo: "Undertale", descricao: "Show de TV com alma amarela: atire nas bombas, desvie das pernas e dos raios.",
    hp: 30000, atk: 10, def: 999, modo: "amarela",
    cenario: { fundoCor: "#0e0018", efeito: "pulso", corEfeito: "#ff5ad1" },
    acoes: ["Conferir", "Pose", "Aplaudir", "Provocar"],
    turnos: [
      t("Bombas no palco", [a("explosao", 6, { forma: "quadrado", cor: "#ff5a8a" }), a("chuva", 6, { forma: "quadrado", densidade: 0.7 })], juntos),
      t("Pernas!", [a("varredura", 6, { forma: "quadrado" })], { modo: "vermelha" }),
      t("Raios do show", [a("laser", 5, { cor: "#ffe14a" }), a("cruz", 5, { cor: "#ffe14a" })]),
      t("Discos voadores", [a("ricochete", 6, { forma: "estrela", cor: "#ffe14a" })]),
      t("Mini-Mettatons", [a("mirado", 6, { forma: "quadrado", densidade: 1.2 }), a("chuva", 6, { forma: "quadrado" })], juntos),
      t("Grande final", [a("laser", 9, { cor: "#ffe14a" }), a("explosao", 9, { forma: "quadrado" }), a("mirado", 9, { forma: "estrela" })], { ...juntos, intensidade: 1.2, cenario: { efeito: "estrelas", corEfeito: "#ffe14a" } }),
    ],
  },
  {
    nome: "Mettaton NEO", jogo: "Undertale", descricao: "Muito estilo, pouca defesa. Atire primeiro.",
    hp: 30000, atk: 90, def: 9, modo: "amarela",
    cenario: { fundoCor: "#0e0018", efeito: "grade", corEfeito: "#ff5ad1" },
    turnos: [t("Disparo NEO", [a("mirado", 6, { velocidade: 1.6, densidade: 1.8 }), a("canhao", 6, { cor: "#ff5a8a" })], { ...juntos, intensidade: 1.3 })],
  },
  {
    nome: "Muffet", jogo: "Undertale", descricao: "Alma roxa presa nos fios, doces voando e o bichinho de estimação.",
    hp: 1250, atk: 8, def: 0, modo: "roxa", poupavel: true,
    cenario: { fundoCor: "#0d0016", efeito: "particulas", corEfeito: "#c33cff" },
    acoes: ["Conferir", "Pagar", "Elogiar o chá"],
    turnos: [
      t("Aranhas nos fios", [a("fios", 6, em("🕷"))]),
      t("Rosquinhas", [a("ricochete", 6, em("🍩")), a("fios", 6, em("🕷", { densidade: 0.6 }))], juntos),
      t("Croissant bumerangue", [a("arco", 6, em("🥐"))]),
      t("Hora do chá", [a("chuva", 6, em("🍵", { densidade: 0.8 })), a("fios", 6, em("🕷", { densidade: 0.7 }))], juntos),
      t("O bichinho", [a("estacas", 8, { cor: "#c33cff", densidade: 1.3 }), a("fios", 8, em("🕷", { densidade: 1.3 }))], { ...juntos, intensidade: 1.2, cenario: { tremor: 0.2 } }),
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
      t("Lança azul", [a("varredura", 5, { ...azul, forma: "seta" })]),
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
    turnos: [t("Voo rasante", [a("lateral", 6, { cor: "#9fd8ff" }), a("espiral", 6, { densidade: 0.6 })], juntos)],
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
    nome: "Mad Dummy", jogo: "Undertale", descricao: "Bonecos atirando de todo lado, facas e mísseis teleguiados.",
    hp: 200, atk: 7, def: 0, modo: "vermelha",
    turnos: [
      t("Exército de bonecos", [a("mirado", 6, { densidade: 1.4 })]),
      t("Facas", [a("chuva", 5, { forma: "seta", velocidade: 1.2 })]),
      t("Mísseis", [a("explosao", 6, { densidade: 1.2 }), a("mirado", 6)], juntos),
      t("Fúria de pano", [a("giratorio", 7, { densidade: 1.2 }), a("mirado", 7)], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Asgore", jogo: "Undertale", descricao: "Fogo em arco, tridente azul e laranja, anéis de chamas.",
    hp: 3500, atk: 10, def: 10, modo: "vermelha",
    cenario: { fundoCor: "#0d0400", efeito: "chamas", corEfeito: "#ff7a1a", escuro: 0.3 },
    turnos: [
      t("Fogo em arco", [a("arco", 6, { ...fogo, densidade: 1.2 })]),
      t("Tridente azul e laranja", [a("varredura", 6, { forma: "quadrado" })]),
      t("Anel de chamas", [a("anel", 6, { ...fogo }), a("espiral", 6, { ...fogo, densidade: 0.6 })], juntos),
      t("Mãos em brasa", [a("chuva", 4, { ...fogo, densidade: 1.3 }), a("lateral", 4, { ...fogo })]),
      t("Fúria do rei", [a("arco", 9, { ...fogo }), a("mirado", 9, { ...fogo }), a("varredura", 9, { forma: "quadrado", densidade: 0.6 })], { ...juntos, intensidade: 1.3, cenario: { tremor: 0.15, escuro: 0.45 } }),
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
    nome: "Omega Flowey", jogo: "Undertale", descricao: "Caos de TV quebrada: olhos, lança-chamas, bombas em X e videiras.",
    hp: 9999, atk: 99, def: 99, modo: "vermelha", caixa: [260, 170],
    cenario: { fundoCor: "#001000", efeito: "estatica", corEfeito: "#9cff6a", escuro: 0.4, tremor: 0.1 },
    turnos: [
      t("Olhos que piscam", [a("mirado", 6, { densidade: 1.5 })]),
      t("Lança-chamas", [a("laser", 4, { cor: "#ff8a2a" }), a("cruz", 4, { cor: "#ff8a2a" })]),
      t("Bombas em X", [a("explosao", 6, { densidade: 1.4, cor: "#c879ff" })]),
      t("Videiras", [a("lateral", 6, { forma: "seta", cor: "#9cff6a" }), a("estacas", 6, { cor: "#9cff6a" })], juntos),
      t("Pétalas de novo", [a("anel", 6, { forma: "estrela" }), a("chuva", 6, { forma: "estrela" })], juntos),
      t("Canal fora do ar", [a("mirado", 10), a("laser", 10), a("explosao", 10)], { ...juntos, intensidade: 1.4, cenario: { tremor: 0.3 } }),
    ],
  },
  {
    nome: "Asriel", jogo: "Undertale", descricao: "Estrelas, choques, sabre do caos, canhões e um vórtice que puxa a alma.",
    hp: 99999, atk: 99, def: 99, modo: "vermelha", caixa: [240, 170],
    cenario: { fundoCor: "#05001a", efeito: "estrelas", corEfeito: "#c879ff" },
    turnos: [
      t("Chuva de estrelas", [a("explosao", 6, { forma: "estrela", cor: "#ffe14a" }), a("chuva", 6, { forma: "estrela" })], juntos),
      t("Quebra-choque", [a("estacas", 4, { cor: "#9fd8ff", densidade: 1.3 }), a("laser", 4, { cor: "#ffffff" })]),
      t("Sabre do caos", [a("corte", 6, { densidade: 1.5 }), a("giratorio", 6, { cor: "#ff5a5a" })], juntos),
      t("Canhão do caos", [a("cerco", 7, { cor: "#ff5ad1" })]),
      t("Galáxia giratória", [a("vortice", 7, { forma: "estrela", cor: "#c879ff" }), a("espiral", 7, { forma: "estrela", densidade: 0.5 })], juntos),
      t("Fim de todas as coisas", [a("vortice", 5, { forma: "estrela" }), a("cerco", 4), a("ponteiro", 5, { cor: "#ff5ad1" })], { intensidade: 1.4, cenario: { efeito: "pulso", corEfeito: "#ff5ad1", tremor: 0.2 } }),
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
    nome: "Lancer", jogo: "Deltarune", descricao: "Espadas de baralho e uma moto muito barulhenta.",
    hp: 210, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Chuva de espadas", [a("chuva", 5, em("♠", { cor: "#ffffff" }))]),
      t("Vruum!", [a("lateral", 5, { velocidade: 1.1 }), a("cortina", 3, { densidade: 0.6 })]),
      t("Espadas giratórias", [a("giratorio", 5, em("♠"))]),
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
      t("Coração grudento", [a("mirado", 5, em("♥", { densidade: 0.7 }))]),
    ],
  },
  {
    nome: "K. Round", jogo: "Deltarune", descricao: "Pulos pesados, coroas quicando e tremedeira.",
    hp: 2000, atk: 8, def: 2, modo: "vermelha", caixa: DR,
    turnos: [
      t("Pulo real", [a("arco", 5, { densidade: 0.9 }), a("estacas", 5, { densidade: 0.7 })], juntos),
      t("Coroas", [a("ricochete", 5, { forma: "estrela", cor: "#ffe14a" })]),
      t("Terremoto", [a("estacas", 6, { densidade: 1.3 }), a("explosao", 6, { densidade: 0.8 })], { ...juntos, cenario: { tremor: 0.3 } }),
    ],
  },
  {
    nome: "Clover", jogo: "Deltarune", descricao: "Três cabeças, três opiniões, três ataques.",
    hp: 600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Três cabeças", [a("espiral", 7, { densidade: 0.6 }), a("mirado", 7, { densidade: 0.6 }), a("chuva", 7, { densidade: 0.6 })], juntos)],
  },
  {
    nome: "Jevil", jogo: "Deltarune", descricao: "Cartas, carrossel, bombas, foices girando e CAOS. Chefe secreto.",
    hp: 3500, atk: 10, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    cenario: { fundoCor: "#08000f", efeito: "estrelas", corEfeito: "#ff5ad1", tremor: 0.05 },
    acoes: ["Conferir", "Ser alegre", "Hipnotizar", "Brincar"],
    turnos: [
      t("Baralho em roda", [a("anel", 6, em("♦", { cor: "#ff5a5a", densidade: 1.3 }))]),
      t("Carrossel", [a("lateral", 6, em("🐴", { densidade: 0.9 })), a("espiral", 6, em("♣", { densidade: 0.6 }))], juntos),
      t("Bombas de espadas", [a("ricochete", 6, em("💣")), a("explosao", 6, em("♠", { densidade: 1.2 }))], juntos),
      t("Foices dançantes", [a("giratorio", 6, { cor: "#c879ff", densidade: 1.3, tamanho: 1.3 })]),
      t("Caos, caos!", [a("vortice", 6, em("♠")), a("anel", 6, em("♦", { densidade: 0.7 }))], { ...juntos, intensidade: 1.3, cenario: { efeito: "pulso", tremor: 0.15 } }),
      t("Último truque", [a("ponteiro", 6, { cor: "#ff5ad1" }), a("giratorio", 6, { densidade: 0.8 }), a("chuva", 6, em("♠", { densidade: 0.8 }))], { ...juntos, intensidade: 1.4 }),
    ],
  },
  {
    nome: "King", jogo: "Deltarune", descricao: "Espadas aéreas, correntes e fúria real.",
    hp: 2000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#0a0005", efeito: "pulso", corEfeito: "#ff2040" },
    turnos: [
      t("Espadas aéreas", [a("chuva", 6, em("♠", { densidade: 1.3 }))]),
      t("Correntes", [a("lateral", 6, { forma: "quadrado", velocidade: 1.1 })]),
      t("Fúria real", [a("mirado", 7, em("♠")), a("cerco", 7, { cor: "#ff2040" })], { ...juntos, intensidade: 1.2, cenario: { tremor: 0.15 } }),
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
    nome: "Queen", jogo: "Deltarune", descricao: "Taças quicando, raios, cabos e cadeiras voando.",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000a14", efeito: "grade", corEfeito: "#5ad1ff" },
    turnos: [
      t("Brinde", [a("ricochete", 6, em("🍷"))]),
      t("Raios", [a("laser", 6, { cor: "#5ad1ff" })]),
      t("Cabos", [a("tunel", 6, { cor: "#5ad1ff" })]),
      t("Cadeiras voando", [a("giratorio", 6, em("🪑"))]),
      t("Final", [a("cruz", 8, { cor: "#5ad1ff" }), a("ricochete", 8, em("🍷"))], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Spamton", jogo: "Deltarune", descricao: "Cabeças voando e OFERTAS IMPERDÍVEIS.",
    hp: 800, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    cenario: { efeito: "estatica", corEfeito: "#ffe14a" },
    turnos: [
      t("Cabeças", [a("mirado", 6, { forma: "quadrado", cor: "#ffffff" })]),
      t("Ofertas", [a("chuva", 6, em("💲")), a("lateral", 6, { densidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Spamton NEO", jogo: "Deltarune", descricao: "Alma amarela: atire nas cabeças, ovos e telefones. Chefe secreto.",
    hp: 4999, atk: 13, def: 0, modo: "amarela", caixa: DR,
    cenario: { fundoCor: "#000814", efeito: "estatica", corEfeito: "#ffe14a", tremor: 0.08 },
    acoes: ["Conferir", "Ligar para ajuda", "Comprar"],
    turnos: [
      t("Cabeças voadoras", [a("mirado", 6, { forma: "quadrado", velocidade: 1.3, densidade: 1.3 })]),
      t("Feixes", [a("canhao", 6, { cor: "#ffe14a" }), a("laser", 6, { cor: "#ff5a8a" })], { ...juntos, modo: "vermelha" }),
      t("Telefone", [a("ricochete", 6, em("☎"))]),
      t("Ovos", [a("explosao", 6, em("🥚"))]),
      t("Mangueira", [a("tunel", 6, { cor: "#5ad1ff", velocidade: 1.2 })], { modo: "vermelha" }),
      t("[[ATAQUE FINAL]]", [a("cerco", 9, { cor: "#ffe14a" }), a("mirado", 9, { forma: "quadrado" }), a("chuva", 9, em("💲"))], { ...juntos, intensidade: 1.45, cenario: { tremor: 0.25, corEfeito: "#ff5ad1" } }),
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
    nome: "Tenna", jogo: "Deltarune", descricao: "Show de TV: raios, varreduras, comerciais. (aproximado)",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000818", efeito: "estatica", corEfeito: "#ffe14a" },
    turnos: [
      t("No ar!", [a("laser", 6, { cor: "#ffe14a" }), a("varredura", 6, { densidade: 0.7 })], juntos),
      t("Antena", [a("explosao", 6, { forma: "estrela", cor: "#ffe14a" })]),
      t("Intervalo comercial", [a("cortina", 4), a("corte", 4)]),
    ],
  },
  {
    nome: "Roaring Knight", jogo: "Deltarune", descricao: "Espadas em formação, cortes e tempestade. Extremamente difícil. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000000", efeito: "particulas", corEfeito: "#ffffff", escuro: 0.6, tremor: 0.1 },
    turnos: [
      t("Espadas em roda", [a("cerco", 7, { densidade: 1.3 })], { intensidade: 1.2 }),
      t("Cortes", [a("corte", 7, { densidade: 1.4 })]),
      t("Chuva de lâminas", [a("chuva", 7, { forma: "seta", densidade: 1.4 }), a("estacas", 7, { densidade: 1.2 })], juntos),
      t("Tempestade", [a("giratorio", 8, { densidade: 1.4 }), a("espiral", 8, { forma: "seta", densidade: 0.7 })], { ...juntos, intensidade: 1.3 }),
      t("Escuridão total", [a("cerco", 4), a("corte", 4), a("ponteiro", 5)], { intensidade: 1.5, cenario: { escuro: 0.85, tremor: 0.25 } }),
    ],
  },
  {
    nome: "Hammer of Justice", jogo: "Deltarune", descricao: "Martelada em arco, cascos quicando e justiça. Chefe secreto. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#000a02", efeito: "pulso", corEfeito: "#9cff6a" },
    turnos: [
      t("Martelada", [a("arco", 6, { densidade: 1.3 }), a("estacas", 6)], { ...juntos, cenario: { tremor: 0.15 } }),
      t("Cascos", [a("ricochete", 6, { velocidade: 1.4 })]),
      t("Justiça", [a("cruz", 8, { cor: "#9cff6a" }), a("arco", 8)], { ...juntos, intensidade: 1.3 }),
    ],
  },
  {
    nome: "Titan", jogo: "Deltarune", descricao: "Sombras em espiral, anéis e um colapso que puxa tudo. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    cenario: { fundoCor: "#050008", efeito: "particulas", corEfeito: "#c879ff", escuro: 0.7 },
    turnos: [
      t("Sombras", [a("espiral", 7, { cor: "#c879ff" }), a("mirado", 7, { densidade: 0.7 })], juntos),
      t("Anéis", [a("anel", 7, { densidade: 1.4, cor: "#c879ff" })]),
      t("Colapso", [a("vortice", 9, { cor: "#c879ff" }), a("cerco", 9, { cor: "#c879ff" })], { ...juntos, intensidade: 1.4, cenario: { tremor: 0.2 } }),
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
    descricao: "Paródia em 3 fases cada vez mais brutais: canhões em formação, pancadas, plataformas, grade, ponteiro e caixa viva. Com KR.",
    hp: 1, atk: 1, def: 1, modo: "vermelha", caixa: [240, 160], karma: true, esquiva: 100,
    acoes: ["Conferir", "Implorar", "Desafiar"],
    turnos: [
      t("Fase 1 — Aquecimento", [a("ossos", 3, { velocidade: 1.4, densidade: 1.3 }), a("canhao", 3, { densidade: 1.3 })]),
      t("Fase 1 — Pancadas", [a("pancada", 6), a("ossos", 6, { densidade: 0.9 })], juntos),
      t("Fase 1 — Plataformas", [a("plataformas", 7), a("giratorio", 7, { densidade: 0.6 })], juntos),
      t("Fase 1 — Azul e laranja", [a("cortina", 3, { ...azul }), a("cortina", 3, { ...laranja }), a("canhao", 3, { densidade: 1.4 })]),
      t("Fase 2 — Cerco", [a("cerco", 7)], { intensidade: 1.25, cenario: LB2 }),
      t("Fase 2 — Grade e cortes", [a("grade", 4), a("corte", 4)], { intensidade: 1.25, cenario: LB2 }),
      t("Fase 2 — Gravidade cruel", [a("pancada", 8, { densidade: 1.5 }), a("cruz", 8)], { ...juntos, intensidade: 1.25, cenario: { ...LB2, escuro: 0.35 } }),
      t("Fase 3 — Ponteiro", [a("ponteiro", 6), a("ossos", 6, { densidade: 0.8 })], { ...juntos, intensidade: 1.45, cenario: LB3, esquiva: 70 }),
      t("Fase 3 — Caixa viva", [a("deriva", 8), a("giratorio", 8, { densidade: 1.2 }), a("canhao", 8)], { ...juntos, intensidade: 1.45, cenario: LB3, esquiva: 45 }),
      t("Fase 3 — Último suspiro", [a("cerco", 3), a("pancada", 3), a("grade", 3), a("ponteiro", 4), a("corte", 3), a("plataformas", 5)], { intensidade: 1.6, cenario: { ...LB3, escuro: 0.65, tremor: 0.25 }, esquiva: 20 }),
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
    t("Final — Constelação", [a("arena", 11), a("constelacao", 11), a("teia", 11, { densidade: 0.5 })], { ...juntos, intensidade: 1.25, cenario: KN_FIM }),
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
