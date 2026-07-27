import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createSourceWorkspace } from '../../../platforms/github/repo/workspace/sourceWorkspace'
import { analyzeSourceWorkspace, detectFramework } from './index'
import { parseStaticConfig } from './staticConfig'

const fixtureRoot = path.resolve(process.cwd(), '../../frontend/fixtures/content-import/frameworks')

const loadFixture = async (fixture: string) => {
  const root = path.join(fixtureRoot, fixture)
  const files = new Map<string, string>()
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(filename)
      else if (!filename.includes(`${path.sep}expected${path.sep}`)) {
        files.set(
          path.relative(root, filename).replaceAll(path.sep, '/'),
          await fs.readFile(filename, 'utf8'),
        )
      }
    }
  }
  await visit(root)
  return createSourceWorkspace('a'.repeat(40), files)
}

const fixtures = [
  ['docusaurus/basic', 'docusaurus'],
  ['fumadocs/basic', 'fumadocs'],
  ['mkdocs/basic', 'mkdocs'],
  ['nextra/basic', 'nextra'],
  ['rspress/basic', 'rspress'],
  ['starlight/basic', 'starlight'],
  ['vitepress/basic', 'vitepress'],
] as const

describe('Docs framework analyzer', () => {
  it.each(fixtures)('detects and analyzes %s', async (fixture, framework) => {
    const workspace = await loadFixture(fixture)

    expect(detectFramework(workspace)).toBe(framework)
    const analysis = await analyzeSourceWorkspace(workspace)
    expect(analysis.tree.source.framework).toBe(framework)
    expect(analysis.documents.length).toBeGreaterThan(0)
    expect(analysis.tree.navigation.length).toBeGreaterThan(0)
  })

  it.each(fixtures.map(([fixture]) => fixture))(
    'matches the canonical SourceTree fixture for %s',
    async (fixture) => {
      const workspace = await loadFixture(fixture)
      const expected = JSON.parse(
        await fs.readFile(path.join(fixtureRoot, fixture, 'expected/tree.json'), 'utf8'),
      ) as unknown

      await expect(analyzeSourceWorkspace(workspace)).resolves.toMatchObject({ tree: expected })
    },
  )

  it('supports the VitePress additional-config static function pattern', async () => {
    const analysis = await analyzeSourceWorkspace(await loadFixture('vitepress/additional_config'))

    expect(analysis.tree.navigation).toHaveLength(2)
    expect(JSON.stringify(analysis.tree.navigation)).toContain('Getting Started')
  })

  it('supports the VitePress root sidebar array form', async () => {
    const workspace = createSourceWorkspace(
      'b'.repeat(40),
      new Map([
        [
          'docs/.vitepress/config.ts',
          `export default defineConfig({
            title: 'Example Docs',
            themeConfig: {
              sidebar: [
                {
                  text: 'Examples',
                  items: [{ text: 'Markdown Examples', link: '/markdown-examples' }],
                },
              ],
            },
          })`,
        ],
        ['docs/markdown-examples.md', '# Markdown Examples'],
        ['docs/index.md', '# Home'],
        ['docs/api/index.md', '---\ndraft: true\n---\n# API'],
      ]),
    )

    const analysis = await analyzeSourceWorkspace(workspace)

    expect(analysis.tree.navigation).toHaveLength(1)
    expect(analysis.tree.navigation[0]).toMatchObject({
      pages: [
        {
          pages: [{ route: '/markdown-examples', title: 'Markdown Examples', type: 'page' }],
          title: 'Examples',
          type: 'section',
        },
        {
          pages: [
            { navigationStatus: 'unlisted', route: '/', title: 'Home', type: 'page' },
            {
              draft: true,
              navigationStatus: 'unlisted',
              route: '/api',
              title: 'API',
              type: 'page',
            },
          ],
          title: 'Other pages',
          type: 'section',
        },
      ],
      routePrefix: '/',
      title: 'Example Docs',
      type: 'scope',
    })
    expect(JSON.stringify(analysis.tree.navigation).match(/"type":"page"/g)).toHaveLength(3)
    expect(JSON.stringify(analysis.tree.navigation)).toContain('"sizeBytes":')
  })

  it.each([
    ['nextra/app_router', 'nextra'],
    ['rspress/auto_navigation', 'rspress'],
  ] as const)('supports the %s framework variant', async (fixture, framework) => {
    const analysis = await analyzeSourceWorkspace(await loadFixture(fixture))

    expect(analysis.tree.source.framework).toBe(framework)
    expect(analysis.tree.navigation.length).toBeGreaterThan(0)
    expect(analysis.documents.length).toBeGreaterThan(0)
  })

  it('rejects executable dynamic config instead of importing repository code', () => {
    expect(() => parseStaticConfig('export default await loadConfig()', 'docs/config.ts')).toThrow(
      'statically readable',
    )
  })
})
