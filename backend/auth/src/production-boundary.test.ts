import { fileURLToPath } from 'node:url'

// @vitest-environment node
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

describe('production Auth module boundary', () => {
  it.each(['src/server.ts', 'index.ts'])(
    'does not bundle development identity code into %s',
    async (entry) => {
      const result = await build({
        absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
        entryPoints: [entry],
        bundle: true,
        write: false,
        metafile: true,
        platform: 'node',
        format: 'esm',
        external: ['@auth/core', '@auth/core/*', '@hono/node-server', 'dotenv', 'hono', 'hono/*'],
        logLevel: 'silent',
      })
      expect(
        Object.keys(result.metafile!.inputs).filter((file) =>
          /dev-server|development-session|local-test-actors/.test(file),
        ),
      ).toEqual([])
    },
  )
})
