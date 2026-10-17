# Batalha da Alma — extensão para o Owlbear Rodeo

Transforma a mesa numa batalha de "desviar de projéteis" no estilo dos RPGs de alma/coração.
Os **ataques são predefinidos** (movimento e hitbox); o **mestre escolhe** o monstro, o cenário,
a mecânica da alma, os ataques de cada turno e os sons.

## Instalar

No Owlbear Rodeo: **Perfil → Extensões → Adicionar extensão** e cole:

```
https://emillysolveranjos.github.io/batalha-da-alma/manifest.json
```

Cada push na branch `main` publica o site de novo pelo GitHub Actions (~1 minuto).

## O painel do mestre

| Aba | Para que serve |
|---|---|
| ⚔ **Batalha** | Vida do monstro, **fase do próximo turno** (⏭ avança), ▶ iniciar / próximo turno, 🧪 testar, 👁 assistir, encerrar, jogadores (HP, curar, repor itens), ações recebidas e resposta na caixa |
| ★ **Presets** | 43 lutas prontas (Undertale, Deltarune e o fangame Last Breath), busca e filtros, Desfazer, salvar os seus, abrir/baixar arquivo `.json` |
| ☻ **Monstro** | Nome, imagem (link ou token selecionado; GIF anima), tamanho, fala no balão, HP/ATK/DEF, opções do AGIR, se pode ser poupado, texto da caixa |
| ◐ **Cenário** | Cor de fundo, efeito animado (pulso, partículas, estrelas, brasas, grade, estática), cores da borda e da caixa, escuro nas bordas, tremor, imagem de fundo. Pode ser salvo em cada fase |
| ♥ **Alma** | Mecânica (vermelha, azul, verde, roxa, amarela), aparência, regras (HP, invencibilidade, caixa, intensidade, karma), itens dos jogadores |
| ✦ **Ataques** | Os ataques do turno (um depois do outro, todos juntos ou sorteado), cada um com duração, velocidade, quantidade, aparência, cor e regra de dano. Turnos salvos |
| ♪ **Sons** | Música e efeitos: padrão (original), arquivo do computador, YouTube, SoundCloud, Drive, Dropbox ou link de mp3 |

## Almas

- **Vermelha:** move livre (Shift = devagar).
- **Azul:** gravidade e pulo; a pancada muda a gravidade para qualquer parede.
- **Verde:** parada no centro; as setas viram o escudo.
- **Roxa:** presa em 3 fios.
- **Amarela:** move livre e atira para cima com Z; os tiros destroem projéteis redondos.
- **Karma (KR):** opção de regra. Cada toque tira 1 e envenena; o HP vai drenando (nunca mata sozinho).

## Ataques

**Básicos:** chuva, rajada lateral, ossos, anel, espiral, mirado, laser, ricochete, túnel, explosão, flechas, arco, estacas, varredura, fios.

**Coreografados:**
- **Canhão / Cerco / Cruz:** canhões visíveis entram na tela, miram, carregam e disparam feixes (em anel, em cruz ou um a um).
- **Ponteiro:** feixe preso no centro girando como relógio.
- **Cortina:** bloco de ossos azuis ou laranja atravessando junto.
- **Grade:** colunas de ossos surgem no lugar, cada uma com um vão.
- **Plataformas:** vira alma azul, com chão de espinhos e plataformas andando.
- **Ossos giratórios**, **Cortes** (linha vermelha de aviso + corte rápido), **Caixa em movimento**.
- **Pancada de gravidade:** joga a alma numa parede e ossos sobem dali.
- **Lanças traiçoeiras:** as amarelas dão a volta e chegam pelo lado oposto.
- **Vórtice:** puxa a alma para o centro enquanto projéteis giram para dentro.

Nas fases intensas e nos disparos há clarão, tremida e aberração cromática (desligável no Cenário).

## Presets

Paródias **só de moveset** de 43 lutas: os ataques, o modo da alma, o ritmo e o clima do cenário de cada fase.
Não há arte, som, código ou fala dos jogos; a aparência do monstro e as falas ficam por conta do mestre.
São aproximações; as marcadas "(aproximado)" são as menos fiéis.

- **Carregar** troca monstro, alma, ataques, caixa e cenário. Sua música, itens e regras dos jogadores continuam.
- As **fases** entram na lista de turnos. Escolha a fase na aba Batalha antes de cada turno (⏭ passa para a próxima);
  não precisa rolar todas.
- **Salvar atual** guarda a luta inteira, com os turnos salvos como fases. **Baixar atual** gera um `.batalha.json`
  que outra pessoa abre com **Abrir arquivo**.

## Fluxo de um turno

1. O mestre clica em **Iniciar batalha**; a tela abre para os jogadores marcados.
2. Texto na caixa → fala do monstro no balão → ataques. Cada jogador controla a própria alma e vê as outras translúcidas.
3. No fim, cada um escolhe **LUTAR** (barra de precisão; o dano sai da vida do monstro), **AGIR**, **ITEM** ou **POUPAR**.
4. O mestre recebe a ação, responde na caixa e avança pela **barra do mestre** (dentro da batalha) ou pelo painel.

### Barra do mestre (na tela da batalha)

Aparece ao 👁 Assistir e no 🧪 Testar: **responder na caixa**, **▶ próximo turno**, **⏭ próxima fase**, **■ encerrar**.
No teste sozinho, depois de escolher a ação, **Z** começa o próximo turno.

## Controles do jogador

- Setas/WASD movem; Shift ou X = devagar; Z/Espaço = pular (azul) ou atirar (amarela) e confirmar.
- Mouse/dedo: arraste a alma.
- **Controle:** analógico ou direcional move; **A** pula/confirma/atira; **B** devagar. Aperte um botão para o navegador detectar.

## Sons e música

O padrão é uma **música original sintetizada** e efeitos sintetizados. Para trocar:

- **📤 Arquivo:** mp3 do seu computador (até 10 MB). Vai aos jogadores pelo Owlbear, em pedaços (~1 MB a cada 10 s); cada um guarda.
- **🔗 YouTube / SoundCloud:** o player oficial aparece no canto da batalha. Vídeos com incorporação bloqueada não tocam.
- **🔗 Google Drive / Dropbox:** link de compartilhamento aberto a qualquer pessoa.
- Spotify não funciona (só libera prévias de 30 s).

Use apenas áudios que você tem direito de usar.

## Desenvolvimento

```bash
npm install
npm run dev
```

Extensão local: `http://localhost:5173/manifest.json`. Para testar sem o Owlbear:

- `http://localhost:5173/battle.html?ataque=cerco&modo=azul&hitbox` — um ataque, um modo de alma, hitboxes
- `http://localhost:5173/battle.html?preset=sans&fase=3` — uma fase de um preset pronto

### Arquivos

- `src/engine.ts` — motor: almas, ataques, canhões, cenário, colisão, desenho
- `src/battle.ts` — tela da batalha no Owlbear (sincronização, HP, escolhas, barra do mestre)
- `src/main.ts` / `src/panel.css` — painel do mestre e do jogador
- `src/presets.ts` — presets de moveset
- `src/gm.ts` — turnos salvos, fase atual, início de turno
- `src/audio.ts`, `src/files.ts`, `src/media.ts` — sons, música, envio de arquivos e links
- `src/background.ts` — abre/fecha a batalha, avisa o mestre, repassa arquivos
- `src/shared.ts` — tipos, padrões e listas
- `vite.config.ts` — gera o `manifest.json` e `audio/lista.json`
