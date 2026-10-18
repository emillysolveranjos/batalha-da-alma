import fs from "fs";
import { resolve } from "path";
import { defineConfig, Plugin } from "vite";

// No GitHub Pages o site fica em /<repositório>/; o workflow define BASE_PATH.
const base = process.env.BASE_PATH || "/";
const audioDir = resolve(__dirname, "public/audio");

function listAudio() {
  if (!fs.existsSync(audioDir)) return [];
  return fs
    .readdirSync(audioDir)
    .filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `audio/${f}`);
}

function manifest() {
  return JSON.stringify(
    {
      name: "Batalha da Alma",
      version: "1.9.0",
      manifest_version: 1,
      author: "emillysolveranjos",
      description: "Batalha de desviar de projéteis: o mestre escolhe o monstro, a alma, a mecânica, os ataques e os sons.",
      icon: `${base}icon.svg`,
      action: {
        title: "Batalha da Alma",
        icon: `${base}icon.svg`,
        popover: `${base}index.html`,
        height: 640,
        width: 420,
      },
      background_url: `${base}background.html`,
      permissions: [
        { name: "autoplay", reason: "Tocar a música e os efeitos da batalha" },
        { name: "clipboard-write", reason: "Copiar o backup da batalha em JSON" },
      ],
    },
    null,
    2,
  );
}

/** Gera manifest.json (com o caminho base certo) e audio/lista.json (mp3 disponíveis). */
function owlbear(): Plugin {
  return {
    name: "owlbear-extension",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url === `${base}manifest.json`) {
          res.setHeader("Content-Type", "application/json");
          res.end(manifest());
        } else if (url === `${base}audio/lista.json`) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(listAudio()));
        } else next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: manifest() });
      this.emitFile({ type: "asset", fileName: "audio/lista.json", source: JSON.stringify(listAudio()) });
    },
  };
}

export default defineConfig({
  base,
  plugins: [owlbear()],
  server: {
    // O Owlbear Rodeo busca o manifest.json a partir de outro domínio
    cors: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html"),
        battle: resolve(__dirname, "battle.html"),
      },
    },
  },
});
