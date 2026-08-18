/**
 * Framework detection over bounded SourceWorkspace metadata.
 *
 *   SourceWorkspace markers -> framework detector -> adapter name -> source analyzer
 *
 * @see docs/bulk-import/bulk-import.md
 */
import type { TSourceWorkspace } from '../contracts'

export type TDocsFramework =
  | 'docusaurus'
  | 'fumadocs'
  | 'mkdocs'
  | 'nextra'
  | 'rspress'
  | 'starlight'
  | 'vitepress'

/** Returns the first supported Docs framework whose repository markers match. */
export const detectFramework = (workspace: TSourceWorkspace): TDocsFramework | null => {
  const files = new Set(workspace.files.map((file) => file.path))
  const has = (pattern: RegExp): boolean => Array.from(files).some((file) => pattern.test(file))
  if (has(/(^|\/)\.vitepress\/config\.(?:[cm]?[jt]s)$/)) return 'vitepress'
  if (has(/^rspress\.config\.(?:[cm]?[jt]s)$/)) return 'rspress'
  if (has(/^docusaurus\.config\.(?:[cm]?[jt]s)$/) && has(/^sidebars\.(?:[cm]?[jt]s)$/))
    return 'docusaurus'
  if (has(/^mkdocs\.ya?ml$/)) return 'mkdocs'
  if (has(/^astro\.config\.(?:[cm]?[jt]s)$/) && has(/^src\/content\/docs\//)) return 'starlight'
  if (files.has('source.config.ts') && has(/^content\/docs\/meta\.json$/)) return 'fumadocs'
  if (has(/(^|\/)_meta\.(?:js|ts|tsx)$/) || files.has('app/_meta.global.tsx')) return 'nextra'
  return null
}
