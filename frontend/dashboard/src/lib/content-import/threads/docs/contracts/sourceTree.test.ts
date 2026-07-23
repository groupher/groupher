import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ContractError, decodeSourceTree } from './index'

const fixtureRoot = path.resolve(process.cwd(), 'frontend/fixtures/content-import/frameworks')

const goldenFiles = ['vitepress/basic', 'rspress/basic', 'nextra/basic'].map((fixture) =>
  path.join(fixtureRoot, fixture, 'expected/tree.json'),
)

describe('decodeSourceTree', () => {
  it.each(goldenFiles)('accepts the canonical SourceTree fixture: %s', (filename) => {
    const value = JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown

    expect(decodeSourceTree(value)).toEqual(value)
  })

  it('rejects an unsupported schema version', () => {
    expect(() =>
      decodeSourceTree({
        navigation: [],
        schemaVersion: 2,
        source: { configPaths: [], framework: 'vitepress', root: 'docs' },
      }),
    ).toThrow('sourceTree.schemaVersion')
  })

  it('enforces a total node limit', () => {
    expect(() =>
      decodeSourceTree(
        {
          navigation: [
            {
              children: [
                {
                  kind: 'page',
                  route: '/start',
                  sourceId: 'docs/start.md',
                  sourcePath: 'docs/start.md',
                  title: 'Start',
                },
              ],
              kind: 'scope',
              sourceId: 'docs',
              title: 'Docs',
            },
          ],
          schemaVersion: 1,
          source: { configPaths: [], framework: 'vitepress', root: 'docs' },
        },
        { maxNodes: 1 },
      ),
    ).toThrow(ContractError)
  })
})
