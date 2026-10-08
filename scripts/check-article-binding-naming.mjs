import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const scannedRoots = [
  'backend/api/lib/groupher_server/cms',
  'backend/api/test',
  'backend/api/priv/repo/seeds',
]

const forbidden = [
  ['legacy ArticleCommunity module name', /\bArticleCommunity(?:Tag)?\b/],
  ['removed Articles.Communities owner', /\bArticles\.Communities\b/],
  ['legacy article_community_id field', /\barticle_community_id\b/],
  ['legacy article_communities storage name', /\barticle_communities\b/],
  ['legacy article_community_tags storage name', /\barticle_community_tags\b/],
  ['removed Bindings.get_with_context API', /\bBindings\.get_with_context\b/],
  ['ArticleBinding relation terminology', /\brelation\b/],
]

const sourceFile = (file) => /\.(?:ex|exs)$/.test(file)

/** Returns forbidden legacy ArticleBinding naming occurrences from active repository source files. */
export const namingFindings = (files, read = (file) => readFileSync(path.join(repoRoot, file), 'utf8')) =>
  files.flatMap((file) => {
    if (!sourceFile(file) || !scannedRoots.some((root) => file.startsWith(`${root}/`))) return []

    return read(file)
      .split('\n')
      .flatMap((line, index) =>
        forbidden
          .filter(([, pattern]) => pattern.test(line.replace(/#.*/, '')))
          .map(([message]) => ({ file, line: index + 1, message, source: line.trim() })),
      )
  })

/** Lists tracked and untracked active backend files included by the naming gate. */
export const repositoryFiles = () =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...scannedRoots], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((file) => file && existsSync(path.join(repoRoot, file)))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = namingFindings(repositoryFiles())

  if (findings.length > 0) {
    console.error(
      `ArticleBinding naming violations found:\n${findings
        .map(({ file, line, message, source }) => `- ${file}:${line}: ${message}: ${source}`)
        .join('\n')}`,
    )
    process.exit(1)
  }

  console.log('ArticleBinding naming is clean across active backend runtime, tests, and fixtures.')
}
