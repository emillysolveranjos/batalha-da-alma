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
  esquivou?: boolean;
  cura?: number;
}

export function describeAction(d: ActionMsg) {
  const parts = [d.escolha];
  if (d.opcao) parts.push(d.opcao);
  if (d.escolha === "LUTAR" && d.dano !== undefined)
    parts.push(
      d.esquivou
        ? `esquivou (precisão ${d.precisao}%)`
        : d.dano
          ? `${d.dano} de dano${d.critico ? " (CRÍTICO)" : ""}, precisão ${d.precisao}%`
          : "errou",
    );
  if (d.cura) parts.push(`+${d.cura} HP`);
  return `${d.nome}: ${parts.join(" — ")}${d.texto ? ` — “${d.texto}”` : ""}`;
}

export type SoulMode = "vermelha" | "azul" | "verde" | "roxa" | "amarela";
export type BulletKind = "branco" | "azul" | "laranja" | "verde";
export type BulletShape =
  | "circulo"
  | "quadrado"
  | "diamante"
  | "estrela"
  | "osso"
  | "seta"
  | "emoji"
  | "imagem"
  | "espada"
  | "triangulo"
  | "estrela6"
  | "crescente"
  | "gota"
  | "rabisco";

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
  | "pancada"
  | "cerco"
  | "cruz"
  | "ponteiro"
  | "cortina"
  | "grade"
  | "plataformas"
  | "giratorio"
  | "corte"
  | "deriva"
  | "lancas"
  | "vortice"
  | "crescente"
  | "estocada"
  | "rabisco"
  | "nevasca"
  | "xazul"
  | "espada"
  | "pinos"
  | "estrelaazul"
  | "cone"
  | "estilhacos"
  | "bolhas"
  | "muralha"
  | "guilhotina"
  | "teia"
  | "mira"
  | "orbita"
  | "visaodupla"
  | "arena"
  | "galaxia"
  | "constelacao"
  | "maos"
  | "torretas"
  | "teleguiado"
  | "bumerangue"
  | "bichinho"
  | "bombas"
  | "discoteca"
  | "golpecor"
  | "ondas"
  | "raios"
  | "roda"
  | "lanterna";

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
  modo?: SoulMode | ""; // troca a alma enquanto este ataque roda ("" = a da batalha)
  inicio?: number; // no modo simultâneo: segundos até este ataque começar (0 = já no início)
}

export type SceneEffect = "nenhum" | "pulso" | "particulas" | "estrelas" | "chamas" | "grade" | "estatica";

export interface Cenario {
  fundoCor: string;
  efeito: SceneEffect;
  corEfeito: string;
  bordaCor: string;
  caixaCor: string;
  escuro: number; // 0..0.9 vinheta escura nas bordas
  tremor: number; // 0..1 tela tremendo o tempo todo
}

export const EFEITO_INFO: Record<SceneEffect, string> = {
  nenhum: "Nenhum",
  pulso: "Pulso de luz",
  particulas: "Partículas subindo",
  estrelas: "Estrelas",
  chamas: "Brasas",
  grade: "Grade em movimento",
  estatica: "Estática de TV",
};

export function defaultCenario(): Cenario {
  return {
    fundoCor: "#000000",
    efeito: "nenhum",
    corEfeito: "#3b6bff",
    bordaCor: "#ffffff",
    caixaCor: "#000000",
    escuro: 0,
    tremor: 0,
  };
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
    esquiva: number; // 0-100: chance de desviar de cada golpe do LUTAR
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
    efeitos: boolean; // clarões, tremidas e aberração cromática
    karma: boolean; // KR: cada acerto envenena e o HP vai drenando
    danoAtaque: number; // dano base do LUTAR (acerto perfeito)
  };
  audio: AudioConfig;
  cenario: Cenario;
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
  cenario?: Cenario; // a fase pode trocar o cenário
  esquiva?: number; // a fase pode mudar a chance de esquiva do monstro
  grupo?: string; // nome do preset de onde a fase veio (vazio = turno salvo pelo mestre)
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
  cerco: { nome: "Cerco de canhões", desc: "Um anel de canhões cerca a caixa e dispara um depois do outro na alma." },
  cruz: { nome: "Cruz de canhões", desc: "Canhões cruzam feixes sobre a alma (reto e depois na diagonal)." },
  ponteiro: { nome: "Ponteiro", desc: "Feixe preso no centro girando como um relógio: corra à frente dele." },
  cortina: { nome: "Cortina de ossos", desc: "Bloco de ossos azuis (ou laranja) atravessando a caixa junto." },
  grade: { nome: "Grade de ossos", desc: "Colunas de ossos surgem no lugar, com um vão em cada uma." },
  plataformas: { nome: "Plataformas", desc: "Vira alma azul: chão de espinhos e plataformas andando para se apoiar." },
  giratorio: { nome: "Ossos giratórios", desc: "Ossos girando no ar arremessados na direção da alma." },
  corte: { nome: "Cortes", desc: "Linha vermelha de aviso e um corte rápido atravessa a tela." },
  lancas: { nome: "Lanças traiçoeiras", desc: "Lanças dos 4 lados; as amarelas dão a volta e chegam pelo lado oposto. Feito para a alma verde." },
  vortice: { nome: "Vórtice", desc: "Puxa a alma para o centro enquanto projéteis giram em espiral para dentro." },
  crescente: { nome: "Luas crescentes", desc: "Cortes em forma de lua atravessam a tela com um vão para passar." },
  estocada: { nome: "Estocada", desc: "Uma linha fina mira a alma e um golpe horizontal enorme vem logo depois." },
  rabisco: { nome: "Pilares rabiscados", desc: "Colunas em zigue-zague atravessam a caixa com uma abertura." },
  nevasca: { nome: "Nevasca de diamantes", desc: "Diamantes caem como neve e espinhos de cristal sobem do chão." },
  xazul: { nome: "X azul", desc: "Um X azul cruza a caixa (fique parado) e um corte branco vem em seguida." },
  espada: { nome: "Espada caindo", desc: "Uma espada gigante mira a sua coluna e despenca." },
  pinos: { nome: "Pinos de losango", desc: "Losangos se alinham numa borda e disparam para dentro." },
  estrelaazul: { nome: "Estrela azul", desc: "Raios azuis saem do centro (fique parado), depois raios brancos entre eles." },
  cone: { nome: "Cone de luz", desc: "Um cone enorme de luz mira a alma de fora da caixa." },
  estilhacos: { nome: "Estilhaços", desc: "Explosões de triângulos voando para todos os lados." },
  bolhas: { nome: "Bolhas que estouram", desc: "Bolhas aparecem no alto da caixa e estouram em gotas." },
  muralha: { nome: "Muralha de espadas", desc: "Uma parede de espadas com um buraco atravessa a caixa, com dardos." },
  guilhotina: { nome: "Guilhotina", desc: "Espadas se alinham no alto e caem todas de uma vez." },
  teia: { nome: "Teia de cortes", desc: "Linhas vermelhas formam uma rede de losangos e viram cortes." },
  mira: { nome: "Mira", desc: "Uma mira trava na alma e uma cruz de feixes acerta o ponto." },
  orbita: { nome: "Espadas em órbita", desc: "Espadas giram em volta da alma e depois fecham para o centro." },
  visaodupla: { nome: "Visão dupla", desc: "Tudo aparece em dobro (o fantasma não machuca). Combine com outros ataques." },
  arena: { nome: "Arena sem caixa", desc: "A caixa vira a tela inteira. Combine com galáxia, constelação ou teia." },
  galaxia: { nome: "Galáxia de estrelas", desc: "Estrelas grandes saem do centro em braços de espiral girando." },
  constelacao: { nome: "Constelação", desc: "Uma grade de estrelas desce rolando pela tela." },
  lanterna: { nome: "Escuridão (lanterna)", desc: "Tudo escurece e só se enxerga perto da alma. Combine com outros ataques (modo simultâneo)." },
  deriva: { nome: "Caixa em movimento", desc: "A caixa desliza pela tela. Combine com outros ataques (modo simultâneo)." },
  maos: { nome: "Mãos de fogo", desc: "Mãos varrem o alto da caixa (ou descem pelos lados) soltando bolas de fogo." },
  torretas: { nome: "Torretas", desc: "Bonecos ficam presos em volta da caixa e atiram na alma, um de cada vez." },
  teleguiado: { nome: "Mísseis teleguiados", desc: "Fileiras de mísseis que perseguem a alma por um tempo e depois seguem reto." },
  bumerangue: { nome: "Bumerangue", desc: "Entra pelos lados, freia e volta por onde veio. Na alma roxa corre pelos fios." },
  bichinho: { nome: "Bichinho faminto", desc: "Uma bocarra sobe e desce pelo fundo da caixa. Fique nos fios de cima." },
  bombas: { nome: "Bombas e blocos", desc: "Blocos e bombas caem em colunas. Atirar numa bomba (alma amarela) solta uma explosão em cruz." },
  discoteca: { nome: "Globo de luz", desc: "Um globo no alto da caixa balança feixes de luz azul e laranja." },
  golpecor: { nome: "Golpe azul/laranja", desc: "A caixa inteira pisca numa cor e um golpe a atravessa: azul = fique parado, laranja = mexa-se." },
  ondas: { nome: "Correntes em onda", desc: "Correntes de fogo sobem serpenteando e se cruzam em losangos. Fique dentro dos losangos." },
  raios: { nome: "Raios com aviso", desc: "Marcas de \"!\" aparecem no chão e raios caem naquelas colunas, alternando." },
  roda: { nome: "Roda de fogo", desc: "Um anel com uma abertura gira em volta da caixa e se fecha. Passe pela abertura." },
  pancada: { nome: "Pancada de gravidade", desc: "Arremessa a alma contra uma parede (vira alma azul naquela direção) e ossos sobem dali. Pule para escapar." },
};

export const SOUL_INFO: Record<SoulMode, { nome: string; cor: string; desc: string }> = {
  vermelha: { nome: "Vermelha (livre)", cor: "#ff1a1a", desc: "Move em todas as direções. Shift = devagar." },
  azul: { nome: "Azul (gravidade)", cor: "#1a5cff", desc: "Cai com gravidade. Cima/W/Z pula." },
  verde: { nome: "Verde (escudo)", cor: "#16c60c", desc: "Fica parada no centro; as setas giram o escudo." },
  roxa: { nome: "Roxa (fios)", cor: "#c33cff", desc: "Presa em 3 fios: cima/baixo troca de fio." },
  amarela: { nome: "Amarela (tiro)", cor: "#ffe14a", desc: "Move livre e atira para cima com Z; os tiros destroem projéteis redondos." },
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
      tipo === "ossos" || tipo === "tunel" || tipo === "varredura" || tipo === "cortina" || tipo === "giratorio"
        ? "osso"
        : tipo === "flechas" || tipo === "estacas"
          ? "seta"
          : ({
              crescente: "crescente",
              rabisco: "rabisco",
              nevasca: "diamante",
              pinos: "diamante",
              espada: "espada",
              muralha: "espada",
              guilhotina: "espada",
              orbita: "espada",
              estilhacos: "triangulo",
              bolhas: "circulo",
              galaxia: "estrela6",
              constelacao: "estrela6",
            } as Record<string, BulletShape>)[tipo] ?? "circulo",
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
      esquiva: 0,
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
      efeitos: true,
      karma: false,
      danoAtaque: 12,
    },
    audio: {
      musica: "",
      volMusica: 0.5,
      volSons: 0.8,
      sons: { dano: "", escudo: "", texto: "", selecionar: "", cura: "", morte: "" },
    },
    cenario: defaultCenario(),
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
    cenario: { ...d.cenario, ...(c.cenario ?? {}) },
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
