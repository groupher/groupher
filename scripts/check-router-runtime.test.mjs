import assert from 'node:assert/strict'
import test from 'node:test'

import { collectResolvedRouterVersions } from './check-router-runtime.mjs'

test('collects plain and virtual router resolutions', () => {
  const lockfile = `
    resolution: "@tanstack/react-router@npm:1.170.21"
    resolution: "@tanstack/react-router@virtual:deadbeef#npm:1.171.0"
  `

  assert.deepEqual([...collectResolvedRouterVersions(lockfile)], ['1.170.21', '1.171.0'])
})
