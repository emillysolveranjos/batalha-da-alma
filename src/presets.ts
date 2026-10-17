// Presets de moveset: aproximações das lutas de Undertale e Deltarune feitas com os ataques da extensão.
// Só mecânica (padrões, velocidades, modo da alma, fases). Nenhuma arte, som, código ou fala dos jogos.

import {
  AttackConfig,
  AttackType,
  BattleConfig,
  SavedTurn,
  SoulMode,
  defaultAttack,
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
const a = (tipo: AttackType, duracao: number, o: Opts = {}): AttackConfig => ({ ...defaultAttack(tipo), duracao, ...o });
const t = (nome: string, ataques: AttackConfig[], o: Partial<SavedTurn> = {}): SavedTurn => ({
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
const emoji = (e: string, o: Opts = {}): Opts => ({ forma: "emoji", emoji: e, ...o });
const cor = (c: string, o: Opts = {}): Opts => ({ cor: c, ...o });

interface Def {
  nome: string;
  jogo: "Undertale" | "Deltarune";
  descricao: string;
  hp: number;
  atk: number;
  def: number;
  modo: SoulMode;
  caixa?: [number, number];
  poupavel?: boolean;
  turnos: SavedTurn[];
}

function build(d: Def): PresetFile {
  const c = defaultConfig();
  const first = d.turnos[0];
  c.monstro = {
    ...c.monstro,
    nome: d.nome,
    imagem: "",
    fala: first.fala,
    hp: d.hp,
    atk: d.atk,
    def: d.def,
    descricao: "",
    acoes: ["Conferir", "Conversar", "Elogiar", "Provocar"],
    poupavel: !!d.poupavel,
    frase: "",
  };
  c.alma.modo = first.modo ?? d.modo;
  if (d.caixa) [c.mecanica.caixaL, c.mecanica.caixaA] = d.caixa;
  c.mecanica.ordem = first.ordem;
  c.mecanica.intensidade = first.intensidade ?? 1;
  c.ataques = structuredClone(first.ataques);
  return {
    formato: PRESET_FORMAT,
    versao: 1,
    nome: d.nome,
    jogo: d.jogo,
    descricao: d.descricao,
    config: c,
    turnos: d.turnos.map((x) => ({ modo: d.modo, intensidade: 1, ...x })),
  };
}

const DR: [number, number] = [160, 150]; // caixa quadrada do Deltarune

// ---------- Undertale ----------
const UNDERTALE: Def[] = [
  {
    nome: "Froggit", jogo: "Undertale", descricao: "Moscas lentas e pulos. Ótimo para a primeira luta.",
    hp: 30, atk: 4, def: 4, modo: "vermelha", poupavel: true,
    turnos: [
      t("Moscas", [a("mirado", 5, { velocidade: 0.6, densidade: 0.6, tamanho: 0.7 })]),
      t("Pulo", [a("arco", 5, { velocidade: 0.7, densidade: 0.5 })]),
    ],
  },
  {
    nome: "Whimsun", jogo: "Undertale", descricao: "Mariposas em círculo e asas caindo, bem devagar.",
    hp: 10, atk: 4, def: 0, modo: "vermelha", poupavel: true,
    turnos: [
      t("Mariposas", [a("anel", 5, { velocidade: 0.6, densidade: 0.6, tamanho: 0.8 })]),
      t("Asas", [a("chuva", 5, { velocidade: 0.6, densidade: 0.6 })]),
    ],
  },
  {
    nome: "Moldsmal", jogo: "Undertale", descricao: "Gelatinas quicando pela caixa.",
    hp: 50, atk: 4, def: 0, modo: "vermelha", poupavel: true,
    turnos: [t("Gelatina", [a("ricochete", 6, { velocidade: 0.7, densidade: 0.7, ...cor("#9fe870") })])],
  },
  {
    nome: "Loox", jogo: "Undertale", descricao: "Olhares em anel e disparos mirados.",
    hp: 50, atk: 5, def: 4, modo: "vermelha", poupavel: true,
    turnos: [
      t("Olhares", [a("anel", 5, { velocidade: 0.8 })]),
      t("Encarar", [a("mirado", 5, { velocidade: 0.8, densidade: 0.8 })]),
    ],
  },
  {
    nome: "Napstablook", jogo: "Undertale", descricao: "Lágrimas caindo, cada vez mais fortes.",
    hp: 88, atk: 10, def: 10, modo: "vermelha", poupavel: true,
    turnos: [
      t("Lágrimas", [a("chuva", 6, { velocidade: 0.7, densidade: 0.8, forma: "diamante", cor: "#9fd8ff", dano: 1 })]),
      t("Choro forte", [a("chuva", 7, { velocidade: 0.9, densidade: 1.6, forma: "diamante", cor: "#9fd8ff", dano: 1 })]),
      t("Nuvem triste", [a("chuva", 6, { densidade: 1.3, forma: "diamante", cor: "#9fd8ff" }), a("ricochete", 6, { velocidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Toriel", jogo: "Undertale", descricao: "Mãos de fogo, redemoinho e círculo de chamas.",
    hp: 440, atk: 6, def: 1, modo: "vermelha", poupavel: true,
    turnos: [
      t("Mãos de fogo", [a("chuva", 6, { ...fogo, velocidade: 0.9 }), a("arco", 5, { ...fogo, densidade: 0.6 })]),
      t("Redemoinho", [a("espiral", 7, { ...fogo, velocidade: 0.8, densidade: 0.8 })]),
      t("Círculo de chamas", [a("anel", 7, { ...fogo, velocidade: 0.9 })]),
      t("Fogo cruzado", [a("arco", 7, { ...fogo }), a("chuva", 7, { ...fogo, densidade: 0.8 })], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Papyrus", jogo: "Undertale", descricao: "Alma azul: ossos para pular e ossos azuis para ficar parado.",
    hp: 680, atk: 8, def: 2, modo: "azul", poupavel: true,
    turnos: [
      t("Ossos no chão", [a("ossos", 7, { velocidade: 0.9 })]),
      t("Osso azul", [a("varredura", 6, { ...azul, densidade: 0.8 })]),
      t("Corrida de ossos", [a("ossos", 8, { velocidade: 1.3, densidade: 1.5 })]),
      t("Ataque especial", [a("ossos", 9, { densidade: 1.8, velocidade: 1.2 }), a("varredura", 9, { ...azul, densidade: 0.6 })], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Undyne", jogo: "Undertale", descricao: "Alma verde com escudo contra lanças; fase vermelha com estacas.",
    hp: 1500, atk: 7, def: 0, modo: "verde",
    turnos: [
      t("Lanças", [a("flechas", 7)]),
      t("Lanças rápidas", [a("flechas", 8, { velocidade: 1.5, densidade: 1.5 })]),
      t("Chuva de lanças", [a("mirado", 6, { forma: "seta", cor: "#4fc3ff" }), a("estacas", 6, { cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Ataque final", [a("flechas", 10, { velocidade: 1.8, densidade: 2 })], { intensidade: 1.2 }),
    ],
  },
  {
    nome: "Undyne, a Imortal", jogo: "Undertale", descricao: "Versão muito mais rápida e longa da luta de lanças.",
    hp: 15000, atk: 10, def: 10, modo: "verde",
    turnos: [
      t("Lanças", [a("flechas", 8, { velocidade: 1.6, densidade: 1.7 })]),
      t("Estacas", [a("estacas", 7, { densidade: 1.5, cor: "#4fc3ff" }), a("mirado", 7, { forma: "seta", densidade: 1.3, cor: "#4fc3ff" })], { ...juntos, modo: "vermelha" }),
      t("Tempestade", [a("flechas", 10, { velocidade: 2, densidade: 2.3 })], { intensidade: 1.2 }),
      t("Desespero", [a("canhao", 8, { cor: "#4fc3ff", densidade: 1.3 }), a("estacas", 8, { densidade: 1.6, cor: "#4fc3ff" })], { ...juntos, modo: "vermelha", intensidade: 1.3 }),
    ],
  },
  {
    nome: "Mettaton", jogo: "Undertale", descricao: "Bombas, raios, discos e pernas: um show.",
    hp: 30000, atk: 10, def: 999, modo: "vermelha",
    turnos: [
      t("Bombas", [a("explosao", 6, { forma: "quadrado", cor: "#ff5a8a" })]),
      t("Raios", [a("laser", 6, { cor: "#ffe14a" })]),
      t("Discos", [a("ricochete", 6, { forma: "estrela", cor: "#ffe14a" })]),
      t("Pernas", [a("varredura", 6, { forma: "quadrado", densidade: 0.9 })]),
      t("Grande final", [a("laser", 9, { cor: "#ffe14a" }), a("mirado", 9, { forma: "estrela" })], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Mettaton NEO", jogo: "Undertale", descricao: "Disparos mirados muito rápidos e feixes.",
    hp: 30000, atk: 90, def: 9, modo: "vermelha",
    turnos: [t("Ataque", [a("mirado", 6, { velocidade: 1.8, densidade: 2 }), a("canhao", 6, { cor: "#ff5a8a" })], { ...juntos, intensidade: 1.3 })],
  },
  {
    nome: "Muffet", jogo: "Undertale", descricao: "Alma roxa presa nos fios, aranhas e doces.",
    hp: 1250, atk: 8, def: 0, modo: "roxa", poupavel: true,
    turnos: [
      t("Aranhas nos fios", [a("fios", 7, emoji("🕷"))]),
      t("Rosquinhas", [a("ricochete", 6, emoji("🍩")), a("fios", 6, emoji("🕷", { densidade: 0.6 }))], juntos),
      t("Croissants", [a("arco", 7, emoji("🥐"))]),
      t("Mascote", [a("estacas", 8, { cor: "#c33cff" }), a("fios", 8, emoji("🕷", { densidade: 1.3 }))], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Guardas Reais 01 e 02", jogo: "Undertale", descricao: "Ataques mirados e colunas laterais em dupla.",
    hp: 260, atk: 9, def: 6, modo: "vermelha", poupavel: true,
    turnos: [
      t("Armaduras", [a("mirado", 6, { cor: "#ff8a2a" }), a("lateral", 6, { cor: "#ffe14a", densidade: 0.6 })], juntos),
      t("Fogo cruzado", [a("laser", 6, { cor: "#ff8a2a" })]),
    ],
  },
  {
    nome: "Shyren", jogo: "Undertale", descricao: "Notas musicais em colunas laterais.",
    hp: 300, atk: 7, def: 0, modo: "vermelha", poupavel: true,
    turnos: [t("Notas", [a("lateral", 7, emoji("🎵", { velocidade: 0.8 }))])],
  },
  {
    nome: "Greater Dog", jogo: "Undertale", descricao: "Alma azul pulando lanças e cachorros.",
    hp: 105, atk: 15, def: 8, modo: "azul", poupavel: true,
    turnos: [
      t("Lanças", [a("ossos", 7, { forma: "seta", velocidade: 1.1 })]),
      t("Lança azul", [a("varredura", 6, { ...azul, forma: "seta" })]),
    ],
  },
  {
    nome: "Knight Knight", jogo: "Undertale", descricao: "Estrelas caindo e espiral do sol.",
    hp: 230, atk: 8, def: 5, modo: "vermelha", poupavel: true,
    turnos: [
      t("Estrelas", [a("chuva", 6, { forma: "estrela", cor: "#ffe14a" })]),
      t("Sol", [a("espiral", 7, { cor: "#ffb340" })]),
    ],
  },
  {
    nome: "Madjick", jogo: "Undertale", descricao: "Orbes em anel e mísseis mágicos.",
    hp: 190, atk: 8, def: 5, modo: "vermelha", poupavel: true,
    turnos: [
      t("Orbes", [a("anel", 6, { cor: "#c879ff" })]),
      t("Magia", [a("mirado", 6, { cor: "#c879ff", forma: "estrela" })]),
    ],
  },
  {
    nome: "Glyde", jogo: "Undertale", descricao: "Voos laterais e espiral.",
    hp: 220, atk: 6, def: 20, modo: "vermelha", poupavel: true,
    turnos: [t("Voo", [a("lateral", 6, { cor: "#9fd8ff" }), a("espiral", 6, { densidade: 0.6 })])],
  },
  {
    nome: "So Sorry", jogo: "Undertale", descricao: "Rabiscos caindo e quicando.",
    hp: 1200, atk: 7, def: 5, modo: "vermelha", poupavel: true,
    turnos: [t("Rabiscos", [a("chuva", 6, { forma: "estrela" }), a("ricochete", 6)], juntos)],
  },
  {
    nome: "Mad Dummy", jogo: "Undertale", descricao: "Bonecos atirando de todos os lados, facas e mísseis.",
    hp: 200, atk: 7, def: 0, modo: "vermelha",
    turnos: [
      t("Bonecos", [a("mirado", 7, { densidade: 1.3 })]),
      t("Facas", [a("chuva", 6, { forma: "seta", velocidade: 1.2 })]),
      t("Mísseis", [a("explosao", 7, { densidade: 1.2 }), a("mirado", 7)], juntos),
    ],
  },
  {
    nome: "Asgore", jogo: "Undertale", descricao: "Fogo em arco, tridente azul/laranja e anel de chamas.",
    hp: 3500, atk: 10, def: 10, modo: "vermelha",
    turnos: [
      t("Fogo em arco", [a("arco", 7, { ...fogo, densidade: 1.2 })]),
      t("Tridente", [a("varredura", 7, { forma: "quadrado" })]),
      t("Anel de chamas", [a("anel", 7, { ...fogo }), a("espiral", 7, { ...fogo, densidade: 0.6 })], juntos),
      t("Fúria", [a("arco", 9, { ...fogo }), a("mirado", 9, { ...fogo }), a("varredura", 9, { forma: "quadrado", densidade: 0.6 })], { ...juntos, intensidade: 1.3 }),
    ],
  },
  {
    nome: "Flowey (início)", jogo: "Undertale", descricao: "Anel de pétalas se fechando.",
    hp: 1, atk: 9, def: 0, modo: "vermelha",
    turnos: [
      t("Pétalas", [a("anel", 5, { velocidade: 0.7, forma: "estrela", cor: "#ffffff" })]),
      t("Cerco", [a("anel", 6, { velocidade: 0.4, densidade: 2, forma: "estrela" })]),
    ],
  },
  {
    nome: "Omega Flowey", jogo: "Undertale", descricao: "Caos: feixes, mirados, bombas e chuva, cada vez pior.",
    hp: 9999, atk: 99, def: 99, modo: "vermelha", caixa: [260, 170],
    turnos: [
      t("Olhos", [a("mirado", 7, { densidade: 1.5 })]),
      t("Feixes", [a("laser", 7, { cor: "#ffe14a" }), a("canhao", 7, { cor: "#9cff6a" })], juntos),
      t("Bombas", [a("explosao", 7, { densidade: 1.4, cor: "#c879ff" })]),
      t("Dedos", [a("chuva", 7, { forma: "seta", densidade: 1.5 }), a("estacas", 7)], juntos),
      t("Tudo de uma vez", [a("mirado", 10), a("laser", 10), a("explosao", 10)], { ...juntos, intensidade: 1.4 }),
    ],
  },
  {
    nome: "Asriel", jogo: "Undertale", descricao: "Estrelas cadentes, raios, sabre e galáxia.",
    hp: 99999, atk: 99, def: 99, modo: "vermelha", caixa: [240, 170],
    turnos: [
      t("Estrelas cadentes", [a("explosao", 7, { forma: "estrela", cor: "#ffe14a" }), a("chuva", 7, { forma: "estrela" })], juntos),
      t("Raios", [a("laser", 7, { cor: "#ffffff" }), a("estacas", 7, { cor: "#9fd8ff" })], juntos),
      t("Sabre", [a("canhao", 7, { cor: "#ff5a5a", densidade: 1.4 })]),
      t("Galáxia", [a("espiral", 8, { forma: "estrela", cor: "#c879ff" }), a("anel", 8, { forma: "estrela" })], juntos),
      t("Final", [a("canhao", 10, { densidade: 1.3 }), a("explosao", 10, { forma: "estrela" }), a("espiral", 10, { densidade: 0.6 })], { ...juntos, intensidade: 1.5 }),
    ],
  },
  {
    nome: "Sans", jogo: "Undertale", descricao: "Ossos, feixes de canhão, gravidade azul e túnel. Muito difícil.",
    hp: 1, atk: 1, def: 1, modo: "vermelha", caixa: [240, 160],
    turnos: [
      t("Abertura", [a("ossos", 5, { velocidade: 1.4, densidade: 1.4 }), a("canhao", 5, { densidade: 1.2 })]),
      t("Azul e laranja", [a("varredura", 7, { ...azul, densidade: 0.8 }), a("varredura", 7, { ...laranja, densidade: 0.6 }), a("ossos", 7, { densidade: 0.6 })], juntos),
      t("Gravidade", [a("ossos", 8, { densidade: 1.6, velocidade: 1.3 }), a("varredura", 8, { ...azul, densidade: 0.6 })], { ...juntos, modo: "azul" }),
      t("Feixes", [a("canhao", 8, { densidade: 2 })]),
      t("Túnel de ossos", [a("tunel", 8, { velocidade: 1.3 })]),
      t("Ataque final", [a("canhao", 12, { densidade: 1.6 }), a("ossos", 12, { densidade: 1.3 }), a("varredura", 12, { ...azul, densidade: 0.5 })], { ...juntos, intensidade: 1.4 }),
    ],
  },
];

// ---------- Deltarune ----------
const DELTARUNE: Def[] = [
  {
    nome: "Lancer", jogo: "Deltarune", descricao: "Espadas de baralho chovendo e investida de moto.",
    hp: 210, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Espadas", [a("chuva", 6, { forma: "emoji", emoji: "♠", cor: "#ffffff" })]),
      t("Moto", [a("lateral", 6, { velocidade: 1.1 })]),
    ],
  },
  {
    nome: "Rudinn", jogo: "Deltarune", descricao: "Diamantes mirados, devagar.",
    hp: 90, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Diamantes", [a("mirado", 6, { forma: "diamante", cor: "#5ad1ff", velocidade: 0.8 })])],
  },
  {
    nome: "Hathy", jogo: "Deltarune", descricao: "Corações em anel e perseguindo a alma.",
    hp: 110, atk: 5, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Corações", [a("anel", 6, { forma: "emoji", emoji: "♥", cor: "#ff5a8a", velocidade: 0.8 })]),
      t("Perseguição", [a("mirado", 6, { forma: "emoji", emoji: "♥", densidade: 0.7 })]),
    ],
  },
  {
    nome: "K. Round", jogo: "Deltarune", descricao: "Pulos pesados, estacas e coroas quicando.",
    hp: 2000, atk: 8, def: 2, modo: "vermelha", caixa: DR,
    turnos: [
      t("Pulos", [a("arco", 6, { densidade: 0.9 }), a("estacas", 6, { densidade: 0.7 })], juntos),
      t("Coroas", [a("ricochete", 6, { forma: "estrela", cor: "#ffe14a" })]),
    ],
  },
  {
    nome: "Clover", jogo: "Deltarune", descricao: "Três cabeças atacando ao mesmo tempo.",
    hp: 600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Três cabeças", [a("espiral", 7, { densidade: 0.6 }), a("mirado", 7, { densidade: 0.6 }), a("chuva", 7, { densidade: 0.6 })], juntos)],
  },
  {
    nome: "Jevil", jogo: "Deltarune", descricao: "Cartas em anel, carrossel, bombas e foices. Chefe secreto.",
    hp: 3500, atk: 10, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Cartas", [a("anel", 7, { forma: "emoji", emoji: "♦", cor: "#ff5a5a", densidade: 1.3 })]),
      t("Carrossel", [a("espiral", 7, { forma: "emoji", emoji: "♣", densidade: 1.5 })]),
      t("Bombas", [a("ricochete", 7, { forma: "emoji", emoji: "💣" }), a("explosao", 7, { densidade: 1.2 })], juntos),
      t("Foices", [a("canhao", 7, { densidade: 1.4, cor: "#c879ff" })]),
      t("Caos", [a("anel", 10, { forma: "emoji", emoji: "♠" }), a("espiral", 10, { densidade: 0.8 }), a("canhao", 10, { densidade: 0.8 })], { ...juntos, intensidade: 1.4 }),
    ],
  },
  {
    nome: "King", jogo: "Deltarune", descricao: "Espadas aéreas, colunas e fúria.",
    hp: 2000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    turnos: [
      t("Espadas aéreas", [a("chuva", 7, { forma: "emoji", emoji: "♠", densidade: 1.3 })]),
      t("Correntes", [a("lateral", 7, { forma: "quadrado", velocidade: 1.1 })]),
      t("Fúria", [a("mirado", 8, { forma: "emoji", emoji: "♠" }), a("laser", 8)], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Berdly", jogo: "Deltarune", descricao: "Tornado e penas mirando.",
    hp: 1600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Tornado", [a("espiral", 7, { cor: "#9fd8ff" })]),
      t("Penas", [a("mirado", 7, { forma: "seta", cor: "#5ad1ff" })]),
    ],
  },
  {
    nome: "Queen", jogo: "Deltarune", descricao: "Taças quicando, raios e cabos.",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    turnos: [
      t("Taças", [a("ricochete", 7, { forma: "emoji", emoji: "🍷" })]),
      t("Raios", [a("laser", 7, { cor: "#5ad1ff" })]),
      t("Cabos", [a("tunel", 7, { cor: "#5ad1ff" })]),
      t("Final", [a("canhao", 8, { cor: "#5ad1ff" }), a("ricochete", 8, { forma: "emoji", emoji: "🍷" })], { ...juntos, intensidade: 1.2 }),
    ],
  },
  {
    nome: "Spamton", jogo: "Deltarune", descricao: "Cabeças voando e ofertas caindo.",
    hp: 800, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [
      t("Cabeças", [a("mirado", 6, { forma: "quadrado", cor: "#ffffff" })]),
      t("Ofertas", [a("chuva", 6, { forma: "emoji", emoji: "💲" }), a("lateral", 6, { densidade: 0.6 })], juntos),
    ],
  },
  {
    nome: "Spamton NEO", jogo: "Deltarune", descricao: "Cabeças rápidas, feixes, telefone e ataque final. Chefe secreto.",
    hp: 4999, atk: 13, def: 0, modo: "vermelha", caixa: DR,
    turnos: [
      t("Cabeças voadoras", [a("mirado", 7, { forma: "quadrado", velocidade: 1.4, densidade: 1.3 })]),
      t("Feixes", [a("canhao", 7, { cor: "#ffe14a" }), a("laser", 7, { cor: "#ff5a8a" })], juntos),
      t("Telefone", [a("ricochete", 7, { forma: "emoji", emoji: "☎" })]),
      t("Mangueira", [a("tunel", 7, { cor: "#5ad1ff", velocidade: 1.2 })]),
      t("Ataque final", [a("mirado", 10, { forma: "quadrado" }), a("canhao", 10), a("chuva", 10, { forma: "emoji", emoji: "💲" })], { ...juntos, intensidade: 1.5 }),
    ],
  },
  {
    nome: "Tasque Manager", jogo: "Deltarune", descricao: "Gatinhos quicando e chicote mirado.",
    hp: 900, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Gatinhos", [a("ricochete", 6, { forma: "emoji", emoji: "🐈" }), a("mirado", 6, { densidade: 0.6 })], juntos)],
  },
  {
    nome: "Werewire", jogo: "Deltarune", descricao: "Fios formando um corredor.",
    hp: 600, atk: 8, def: 0, modo: "vermelha", caixa: DR, poupavel: true,
    turnos: [t("Fios", [a("tunel", 7, { cor: "#5ad1ff" })])],
  },
  {
    nome: "Tenna", jogo: "Deltarune", descricao: "Show de TV: raios, varreduras e explosões. (aproximado)",
    hp: 4000, atk: 10, def: 0, modo: "vermelha", caixa: DR,
    turnos: [
      t("No ar", [a("laser", 7, { cor: "#ffe14a" }), a("varredura", 7, { densidade: 0.7 })], juntos),
      t("Antena", [a("explosao", 7, { forma: "estrela", cor: "#ffe14a" })]),
    ],
  },
  {
    nome: "Roaring Knight", jogo: "Deltarune", descricao: "Espadas em todos os ângulos, cortes e tempestade. Extremamente difícil. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    turnos: [
      t("Espadas", [a("canhao", 8, { densidade: 2, cor: "#ffffff" })], { intensidade: 1.2 }),
      t("Cortes", [a("lateral", 8, { forma: "seta", velocidade: 1.4 }), a("estacas", 8, { densidade: 1.4 })], juntos),
      t("Tempestade", [a("espiral", 9, { forma: "seta", velocidade: 1.5, densidade: 1.4 })], { intensidade: 1.3 }),
      t("Final", [a("canhao", 12, { densidade: 1.8 }), a("espiral", 12, { forma: "seta" })], { ...juntos, intensidade: 1.5 }),
    ],
  },
  {
    nome: "Hammer of Justice", jogo: "Deltarune", descricao: "Martelo em arco, estacas e casco quicando. Chefe secreto. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    turnos: [
      t("Martelo", [a("arco", 7, { densidade: 1.3 }), a("estacas", 7)], juntos),
      t("Casco", [a("ricochete", 7, { velocidade: 1.4 })]),
      t("Justiça", [a("canhao", 9, { cor: "#9cff6a" }), a("arco", 9)], { ...juntos, intensidade: 1.3 }),
    ],
  },
  {
    nome: "Titan", jogo: "Deltarune", descricao: "Sombras em espiral, anéis e disparos. (aproximado)",
    hp: 9999, atk: 15, def: 10, modo: "vermelha", caixa: DR,
    turnos: [
      t("Sombras", [a("espiral", 8, { cor: "#c879ff" }), a("mirado", 8, { densidade: 0.7 })], juntos),
      t("Anéis", [a("anel", 8, { densidade: 1.4, cor: "#c879ff" })]),
      t("Colapso", [a("espiral", 10), a("anel", 10), a("canhao", 10, { cor: "#c879ff" })], { ...juntos, intensidade: 1.4 }),
    ],
  },
];

export const BUILTIN_PRESETS: PresetFile[] = [...UNDERTALE, ...DELTARUNE].map(build);

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
