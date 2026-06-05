import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['electron/main.ts', 'electron/preload.ts'],
  format: ['cjs'],
  outDir: 'dist-electron',
  external: ['electron', 'ws', 'path', 'fs', 'child_process', 'crypto', 'url'],
  clean: false,
})
