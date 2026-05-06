import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import svelte from "@astrojs/svelte";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  base: '/_audios/spotify',
  outDir: '../spotify',
  integrations: [tailwind(), svelte(), react()],
  output: 'static',
  vite: {
    build: {
      emptyOutDir: false
    }
  }
});
