import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSchema, parse, validate } from 'graphql'
import type { DocumentNode, SelectionSetNode } from 'graphql'
import { describe, expect, it } from 'vitest'

import { DOC_TREE_MAX_VISIBLE_LEVELS } from '../constant/dsb/docs'
import { THREAD, THREAD_PATH } from '../constant/thread'
import AboutSchema from '../unit/AboutThread/schema'
import ArticleEditorSchema from '../unit/ArticleEditor/schema'
import ArticleMenuSchema from '../unit/ArticleSettingMenu/schema'
import ArticleViewSchema from '../unit/ArticleView/schema'
import ChangelogSchema from '../unit/ChangelogThread/schema'
import CommentsSchema from '../unit/Comments/schema'
import CoverEditorSchema from '../unit/CoverEditor/schema'
import DocCoversSchema from '../unit/DocCovers/schema'
import DocSchema from '../unit/DocThread/schema'
import * as AnalysisSchema from '../unit/DsbThread/Analysis/WebOverview/schema'
import * as ThemeSchema from '../unit/DsbThread/Appearance/Theme/schema'
import WallpaperSchema from '../unit/DsbThread/Appearance/Wallpaper/schema'
import ImportSchema from '../unit/DsbThread/CMS/Docs/Import/schema'
import DashboardAdminsSchema from '../unit/DsbThread/schema/admins'
import DashboardAppearanceSchema from '../unit/DsbThread/schema/appearance'
import DashboardAssetsSchema from '../unit/DsbThread/schema/assets'
import DashboardContentSchema from '../unit/DsbThread/schema/content'
import DashboardDocsSchema from '../unit/DsbThread/schema/docs'
import DashboardIntegrationsSchema from '../unit/DsbThread/schema/integrations'
import DashboardSettingsSchema from '../unit/DsbThread/schema/settings'
import DashboardShellSchema from '../unit/DsbThread/schema/shell'
import DashboardTagsSchema from '../unit/DsbThread/schema/tags'
import KanbanSchema from '../unit/KanbanThread/schema'
import PassportSchema from '../unit/PassportEditor/schema'
import PostThreadSchema from '../unit/PostThread/schema'
import RichEditorSchema from '../unit/RichEditor/schema'
import TagSettingSchema from '../unit/TagSettingEditor/schema'
import { pageDocuments } from './pages/contract-inventory'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '../../../backend/api/schema.graphql')
const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'))

const maxPagesDepth = (
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, SelectionSetNode>,
  depth = 0,
  visiting = new Set<string>(),
): number => {
  return selectionSet.selections.reduce((maxDepth, selection) => {
    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value
      const fragment = fragments.get(fragmentName)
      if (!fragment || visiting.has(fragmentName)) return maxDepth

      return Math.max(
        maxDepth,
        maxPagesDepth(fragment, fragments, depth, new Set([...visiting, fragmentName])),
      )
    }

    if (selection.kind === 'InlineFragment') {
      return Math.max(maxDepth, maxPagesDepth(selection.selectionSet, fragments, depth, visiting))
    }

    if (!selection.selectionSet) return maxDepth

    const nextDepth = selection.name.value === 'pages' ? depth + 1 : depth
    return Math.max(maxDepth, maxPagesDepth(selection.selectionSet, fragments, nextDepth, visiting))
  }, depth)
}

const documentPagesDepth = (document: DocumentNode): number => {
  const operation = document.definitions.find(
    (definition) => definition.kind === 'OperationDefinition',
  )
  if (!operation || operation.kind !== 'OperationDefinition') return 0

  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === 'FragmentDefinition')
      .map((definition) => [definition.name.value, definition.selectionSet]),
  )

  return maxPagesDepth(operation.selectionSet, fragments)
}

type SchemaValue = string | DocumentNode

const featureDocuments: Record<string, Record<string, SchemaValue>> = {
  pages: pageDocuments,
  about: AboutSchema,
  articleEditor: ArticleEditorSchema,
  articleMenu: ArticleMenuSchema,
  articleView: {
    setTag: ArticleViewSchema.setTag,
    unsetTag: ArticleViewSchema.unsetTag,
    articlePost: ArticleViewSchema.getArticle(THREAD.POST),
    articleChangelog: ArticleViewSchema.getArticle(THREAD.CHANGELOG),
    articleDoc: ArticleViewSchema.getArticle(THREAD.DOC),
  },
  changelog: ChangelogSchema,
  comments: CommentsSchema,
  coverEditor: CoverEditorSchema,
  dashboard: {
    ...DashboardShellSchema,
    ...DashboardSettingsSchema,
    ...DashboardAppearanceSchema,
    ...DashboardContentSchema,
    ...DashboardDocsSchema,
    ...DashboardTagsSchema,
    ...DashboardAdminsSchema,
    ...DashboardAssetsSchema,
    ...DashboardIntegrationsSchema,
  },
  dashboardAnalysis: AnalysisSchema,
  dashboardTheme: ThemeSchema,
  dashboardWallpaper: WallpaperSchema,
  docsImport: ImportSchema,
  docCovers: DocCoversSchema,
  doc: DocSchema,
  kanban: KanbanSchema,
  passport: PassportSchema,
  postThread: {
    communityTagStats: PostThreadSchema.communityTagStats,
    pagedPosts: PostThreadSchema.getPagedArticlesSchema(THREAD_PATH.POST),
    pagedChangelogs: PostThreadSchema.getPagedArticlesSchema(THREAD_PATH.CHANGELOG),
    freshPost: PostThreadSchema.getArticleFreshSchema(),
  },
  richEditor: RichEditorSchema,
  tagSetting: TagSettingSchema,
}

const documents = Object.entries(featureDocuments).flatMap(([feature, registry]) =>
  Object.entries(registry).map(([name, source]) => ({
    name: `${feature}.${name}`,
    document: typeof source === 'string' ? parse(source) : source,
  })),
)

describe('feature GraphQL documents', () => {
  it.each(documents)('$name matches the current GraphQL schema', ({ name, document }) => {
    const errors = validate(schema, document)

    expect(errors, `${name}: ${errors.map((error) => error.message).join('\n')}`).toEqual([])
  })

  it('keeps the Dashboard document tree at three visible levels', () => {
    const document =
      typeof DashboardDocsSchema.docTree === 'string'
        ? parse(DashboardDocsSchema.docTree)
        : DashboardDocsSchema.docTree

    expect(documentPagesDepth(document) + 1).toBe(DOC_TREE_MAX_VISIBLE_LEVELS)
  })
})
