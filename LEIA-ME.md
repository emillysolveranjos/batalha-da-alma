# Batalha da Alma — extensão para o Owlbear Rodeo

Transforma a mesa numa batalha de "desviar de projéteis" no estilo dos RPGs de alma/coração.
Os **ataques são predefinidos** (movimento e hitbox), e o **mestre escolhe** a aparência, o personagem do meio,
a mecânica da alma e a combinação de ataques de cada turno.

## Instalar no Owlbear (versão publicada)

No Owlbear Rodeo: **Perfil → Extensões → Adicionar extensão** e cole:

```
https://emillysolveranjos.github.io/batalha-da-alma/manifest.json
```

Cada push na branch `main` publica o site de novo pelo GitHub Actions (leva ~1 minuto).

## Rodar no seu computador

```bash
npm install
npm run dev
```

No Owlbear Rodeo: **Perfil → Extensões → Adicionar extensão** e cole:

```
http://localhost:5173/manifest.json
```

> Enquanto estiver usando `localhost`, só funciona no computador que roda o `npm run dev`.
> Para os jogadores usarem também, publique a extensão (veja abaixo).

## Publicar

O workflow `.github/workflows/deploy.yml` compila e publica no GitHub Pages automaticamente.
Para hospedar em outro lugar, rode `npm run build` e envie a pasta `dist/`. Se o site ficar num subcaminho,
defina `BASE_PATH=/subcaminho/` antes do build.

## Como usar (mestre)

Clique no ícone ♥ na barra de extensões.

| Aba | O que dá para escolher |
|---|---|
| **Monstro** | Nome, aparência (URL ou **token selecionado** no mapa; GIFs animam), tamanho, fala no balão, texto da caixa, fundo, **HP / ATK / DEF**, descrição do "Conferir", **opções do AGIR**, se pode ser poupado |
| **Alma** | Mecânica: **Vermelha** (livre), **Azul** (gravidade/pulo), **Verde** (parada + escudo), **Roxa** (3 fios). Cor, imagem própria, tamanho, velocidade. Regras: HP, tempo de invencibilidade, tamanho da caixa, **intensidade geral** (para as fases de chefe), dano do LUTAR, **itens dos jogadores**, menu final, sons, hitboxes |
| **Ataques** | Lista de ataques do turno, em sequência, simultâneos ou sorteados. Cada ataque tem duração, dano, velocidade, quantidade, tamanho, **regra de cor** (branco, azul = não se mexa, laranja = mexa-se, verde = cura), **aparência do projétil** (círculo, quadrado, diamante, estrela, osso, seta, emoji ou imagem), fala própria e tamanho de caixa. **Turnos salvos** guardam conjuntos de ataques para carregar cada fase na hora |
| **Sons** | Música e cada efeito: padrão (original), **arquivo enviado do computador**, **YouTube**, **SoundCloud**, Google Drive, Dropbox ou link de mp3. Volumes e botão ▶ para ouvir |
| **Batalha** | Iniciar / próximo turno, assistir, testar sozinho, encerrar, quem participa, **HP do monstro**, HP de cada jogador (−5, +5, curar), repor itens, registro das ações, backup em JSON |

### Ataques disponíveis

Chuva · Rajada lateral · Ossos · Anel · Espiral · Mirado · Laser · Ricochete · Túnel · Explosão · Flechas

### Fluxo de um turno

1. O mestre clica em **Iniciar batalha**. A tela abre em tela cheia para os jogadores marcados.
2. A caixa mostra o texto do turno (ex.: "* Fulano bloqueia o caminho!"). Depois o monstro fala no balão e a caixa encolhe.
3. Vêm os ataques. Cada jogador controla **a própria alma** e vê as dos outros translúcidas.
4. No fim, cada jogador escolhe:
   - **LUTAR:** uma barra corre sobre o alvo; quanto mais perto do centro, mais dano (centro perfeito = crítico).
     O dano sai do HP do monstro automaticamente.
   - **AGIR:** as opções que o mestre definiu. "Conferir" mostra ATK, DEF e a descrição. "Outra coisa…" deixa escrever.
   - **ITEM:** os itens definidos pelo mestre curam na hora e acabam. "Outra coisa…" deixa escrever.
   - **POUPAR:** Poupar (fica amarelo se o monstro pode ser poupado) ou Fugir.
5. O mestre recebe cada ação como notificação, resolve na mesa e clica em **Próximo turno**.

O HP e os itens usados de cada jogador ficam salvos entre os turnos. Se o HP chega a 0, a alma se parte e o jogador assiste até o mestre curar.

## Sons e música

O padrão é uma **música original sintetizada** e efeitos sintetizados, feitos para esta extensão. Na aba **Sons** o mestre pode trocar cada um:

- **📤 Enviar arquivo:** escolha um mp3 do seu computador (até 10 MB). Ele fica guardado no seu navegador e vai para os jogadores
  pelo próprio Owlbear, em pedaços (cerca de 1 MB a cada 10 s). Cada jogador baixa uma vez e guarda. Deixe a sala aberta enquanto envia.
- **🔗 YouTube / SoundCloud:** cole o link. O player oficial aparece no canto da tela (as regras do YouTube não deixam escondê-lo).
  Vídeos com incorporação bloqueada pelo dono não tocam.
- **🔗 Google Drive / Dropbox:** cole o link de compartilhamento (com acesso "qualquer pessoa com o link").
- **🔗 Link direto** para um arquivo de áudio.
- **Spotify não funciona:** fora do app ele só libera prévias de 30 segundos.

Use apenas áudios que você tem direito de usar.

## Controles do jogador

- Setas ou WASD movem a alma. Shift (ou X) deixa mais lento.
- Alma azul: Cima/W/Z/Espaço pula. Segure para pular mais alto.
- Alma verde: as setas viram o escudo.
- Alma roxa: cima/baixo troca de fio.
- Também dá para arrastar a alma com o mouse ou o dedo.
- **Controle (qualquer um que o navegador reconheça):** analógico esquerdo ou direcional move; **A** (ou Y/Start) pula e confirma;
  **B** (ou X/gatilhos) deixa devagar e pula o texto. No menu, o direcional escolhe e **A** confirma; apertar **A** de novo envia a ação.
  Aperte qualquer botão uma vez para o navegador detectar o controle. No Chrome/Edge funciona dentro do Owlbear;
  em alguns navegadores (ex.: Firefox) o controle pode ficar bloqueado dentro de extensões.
- Se o teclado não responder, clique na tela da batalha.

## Testar sem o Owlbear

Com `npm run dev` rodando, abra no navegador:

- `http://localhost:5173/battle.html`: demonstração com 4 ataques
- `http://localhost:5173/battle.html?ataque=laser&modo=azul&hitbox`: um ataque específico, um modo de alma e as hitboxes

## Arquivos

- `src/engine.ts`: motor da batalha (alma, padrões de ataque, colisão, desenho)
- `src/battle.ts`: tela da batalha dentro do Owlbear (sincronização, HP, escolhas)
- `src/main.ts`: painel do mestre e do jogador
- `src/audio.ts`: efeitos, música original sintetizada, tocador de arquivos, YouTube e SoundCloud
- `src/files.ts`: guarda os arquivos de áudio no navegador e os envia em pedaços aos jogadores
- `src/media.ts`: reconhece links (YouTube, SoundCloud, Drive, Dropbox)
- `src/background.ts`: abre e fecha a batalha nos jogadores e avisa o mestre
- `src/shared.ts`: tipos, padrões e lista de ataques/almas
- `vite.config.ts`: gera o `manifest.json` e a lista `audio/lista.json`
- `public/audio/`: áudios opcionais que ficam junto com o site
