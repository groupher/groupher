import { defineConfig } from 'vite'

export default defineConfig({
  base: '/graphiql-assets/',
  optimizeDeps: { exclude: ['graphiql/setup-workers/vite'] },
  build: { outDir: '../priv/static/graphiql', emptyOutDir: true },
})
