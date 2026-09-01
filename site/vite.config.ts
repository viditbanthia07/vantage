import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * The marketing page's build.
 *
 * Two decisions here are worth the words.
 *
 * **`base` is configurable.** The output is static files with no server behind
 * them, and where they end up is not settled: a GitHub Pages project site serves
 * from `/vantage/`, a domain serves from `/`. `VANTAGE_SITE_BASE` decides, and
 * every asset reference in the page goes through Vite so none of them hard-code
 * either answer.
 *
 * **`@console` points at the product's own source.** Beat 4 renders the console's
 * real `TrendChart` against a real captured payload, and beat 1 borrows its
 * palette. Importing the component is the difference between the page showing
 * the product and the page showing a drawing of the product; a reimplementation
 * would drift the first time either side changed.
 */
export default defineConfig({
  base: process.env.VANTAGE_SITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@console': fileURLToPath(new URL('../frontend/src', import.meta.url)),
    },
  },
  build: {
    // The budget is 150 KB of JS before the hero paints. three.js alone is
    // ~170 KB gzipped, so it must not be in the entry chunk: the hero imports
    // it dynamically and this only makes the split legible in the output.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap', 'gsap/ScrollTrigger'],
        },
      },
    },
    // Under a megabyte of JS total, so the default 500 KB warning is noise
    // rather than signal on the deliberate three.js chunk.
    chunkSizeWarningLimit: 700,
    assetsInlineLimit: 2048,
  },
  server: { port: 5174 },
  preview: { port: 5174 },
});
