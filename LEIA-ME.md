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
| **Monstro** | Nome, aparência (URL ou **token selecionado** no mapa; GIFs animam), tamanho, fala no balão, fundo |
| **Alma** | Mecânica: **Vermelha** (livre), **Azul** (gravidade/pulo), **Verde** (parada + escudo), **Roxa** (3 fios). Cor, imagem própria, tamanho, velocidade. Regras: HP, tempo de invencibilidade, tamanho da caixa, **intensidade geral** (para as fases de chefe), menu final, sons, hitboxes |
| **Ataques** | Lista de ataques do turno, em sequência, simultâneos ou sorteados. Cada ataque tem duração, dano, velocidade, quantidade, tamanho, **regra de cor** (branco, azul = não se mexa, laranja = mexa-se, verde = cura), **aparência do projétil** (círculo, quadrado, diamante, estrela, osso, seta, emoji ou imagem), fala própria e tamanho de caixa. **Turnos salvos** guardam conjuntos de ataques para carregar cada fase na hora |
| **Sons** | Música (original sintetizada, nenhuma, mp3 do repositório ou link) e cada efeito (dano, escudo, texto, menu, cura, morte), com volumes e botão ▶ para ouvir |
| **Batalha** | Iniciar / próximo turno, assistir, testar sozinho, encerrar, quem participa, HP de cada jogador (−5, +5, curar), registro das escolhas LUTAR/AGIR/ITEM/POUPAR, backup em JSON |

### Ataques disponíveis

Chuva · Rajada lateral · Ossos · Anel · Espiral · Mirado · Laser · Ricochete · Túnel · Explosão · Flechas

### Fluxo de um turno

1. O mestre clica em **Iniciar batalha**. A tela abre em tela cheia para os jogadores marcados.
2. Aparece a introdução e depois os ataques. Cada jogador controla **a própria alma** e vê as dos outros translúcidas.
3. No fim, cada jogador escolhe **LUTAR / AGIR / ITEM / POUPAR** e pode escrever o que faz. O mestre recebe uma notificação.
4. O mestre resolve a ação na mesa, ajusta o que quiser e clica em **Próximo turno**.

O HP de cada jogador fica salvo entre os turnos.

## Sons e música

O padrão é uma **música original sintetizada** e efeitos sintetizados, feitos para esta extensão.
Para usar seus próprios arquivos:

1. No GitHub, abra a pasta `public/audio`, clique em **Add file → Upload files** e envie os `.mp3` (também aceita `.ogg`, `.wav` e `.m4a`).
2. Espere ~1 minuto para o site ser atualizado.
3. Na aba **Sons**, os arquivos aparecem com 📁 em cada lista.

Também dá para colar um link direto para um mp3 (opção "Link (URL)"). Use apenas áudios que você tem direito de usar:
o repositório é público.

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
- `src/audio.ts`: efeitos, música original sintetizada e tocador de mp3
- `src/background.ts`: abre e fecha a batalha nos jogadores e avisa o mestre
- `src/shared.ts`: tipos, padrões e lista de ataques/almas
- `vite.config.ts`: gera o `manifest.json` e a lista `audio/lista.json`
- `public/audio/`: seus arquivos de áudio
