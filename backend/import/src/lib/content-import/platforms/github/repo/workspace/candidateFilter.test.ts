import fs from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { isCandidateSourceFile } from './candidateFilter'
import { withTemporaryWorkspace } from './temporaryWorkspace'

describe('isCandidateSourceFile', () => {
  it.each([
    'docs/guide/start.md',
    'content/reference.mdx',
    'docs/.vitepress/config.ts',
    'mkdocs.yml',
    'package.json',
  ])('retains analyzer text input: %s', (sourcePath) => {
    expect(isCandidateSourceFile(sourcePath)).toBe(true)
  })

  it.each(['node_modules/pkg/readme.md', 'public/logo.svg', 'docs/image.png', '.git/config'])(
    'drops irrelevant or binary input: %s',
    (sourcePath) => expect(isCandidateSourceFile(sourcePath)).toBe(false),
  )
})

describe('withTemporaryWorkspace', () => {
  it('always removes the permission-restricted workspace', async () => {
    let directory = ''
    await expect(
      withTemporaryWorkspace(async (value) => {
        directory = value
        expect((await fs.stat(value)).mode & 0o777).toBe(0o700)
        throw new Error('step failed')
      }),
    ).rejects.toThrow('step failed')

    await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
