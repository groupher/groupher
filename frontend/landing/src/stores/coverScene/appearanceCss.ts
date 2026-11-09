import type { TLandingScene, TArticleTab, TDashboardTab } from '../../const/scenes/shared'
import { sceneBackground, sceneColor, type TSceneSurface } from '../../const/scenes/style'

const ARTICLE_LAYERS: Record<TArticleTab, string> = {
  POST: 'purple',
  KANBAN: 'blue',
  CHANGELOG: 'red',
  DOC: 'cyan',
}
const DASHBOARD_LAYERS: Partial<Record<TDashboardTab, string>> = {
  appearance: 'purple',
  post: 'blue',
  tags: 'green',
  header: 'brown',
  admins: 'red',
  seo: 'cyan',
  inout: 'yellow',
}

const surfaceDeclaration = (surface: TSceneSurface, inheritedBackground?: string): string => {
  const background =
    surface.background.kind === 'inherit' && inheritedBackground
      ? inheritedBackground
      : sceneBackground(surface.background)
  const declarations = [`background: ${background};`]
  if (surface.border?.kind === 'none') declarations.push('border-style: none;')
  if (surface.border?.kind === 'color')
    declarations.push(`border-color: ${sceneColor(surface.border.color)};`)
  if (surface.shadow?.kind === 'none') declarations.push('box-shadow: none;')
  if (surface.shadow?.kind === 'color')
    declarations.push(`box-shadow: 0 12px 32px ${sceneColor(surface.shadow.color)};`)
  return declarations.join(' ')
}

const coverStageDeclaration = (surface: TSceneSurface): string => {
  const declarations: string[] = []
  if (surface.background.kind !== 'inherit')
    declarations.push(`background: ${sceneBackground(surface.background)};`)
  if (surface.border?.kind === 'none') declarations.push('border-style: none;')
  if (surface.border?.kind === 'color')
    declarations.push(`border-color: ${sceneColor(surface.border.color)};`)
  if (surface.shadow?.kind === 'none') declarations.push('box-shadow: none;')
  if (surface.shadow?.kind === 'color')
    declarations.push(`box-shadow: 0 12px 32px ${sceneColor(surface.shadow.color)};`)
  return declarations.join(' ')
}

/** Generates light and dark CSS for a scene's page, sections, tab layers, and cover stage. */
export const serializeLandingAppearanceCss = (scene: TLandingScene): string => {
  return (['light', 'dark'] as const)
    .map((mode) => {
      const selector = mode === 'light' ? '.landing-scene' : "[data-theme='dark'] .landing-scene"
      const appearance = scene.appearance[mode]
      const rootSelector = mode === 'light' ? ':root' : ":root[data-theme='dark']"
      const surfaceVars = Object.entries(appearance.surfaces)
        .map(([name, value]) => `--landing-scene-${name}: ${value};`)
        .join(' ')
      const pageBackground = sceneBackground(appearance.page.background)
      const pageColor =
        appearance.page.background.kind === 'solid' ? pageBackground : 'var(--color-page-custom)'
      const rules = [
        `${rootSelector} { --color-pageBg: ${pageColor}; ${surfaceVars} }`,
        `${rootSelector} .landing-scene-page { ${surfaceDeclaration(appearance.page, 'var(--color-pageBg)')} }`,
        `${rootSelector} .landing-opening-backdrop { ${surfaceDeclaration(appearance.opening)} }`,
      ]
      for (const [tab, layer] of Object.entries(ARTICLE_LAYERS)) {
        const surface =
          appearance.sections.articles.byTab[tab as TArticleTab] ??
          appearance.sections.articles.default
        rules.push(
          `${selector} [data-landing-section='articles'] .landing-gradient-${layer} { ${surfaceDeclaration(surface)} }`,
        )
      }
      for (const [tab, layer] of Object.entries(DASHBOARD_LAYERS)) {
        const surface =
          appearance.sections.dashboard.byTab[tab as TDashboardTab] ??
          appearance.sections.dashboard.default
        rules.push(
          `${selector} [data-landing-section='dashboard'] .landing-gradient-${layer} { ${surfaceDeclaration(surface)} }`,
        )
      }
      rules.push(
        `${selector} [data-landing-section='battery'] [data-landing-card] { ${surfaceDeclaration(appearance.sections.battery.default)} }`,
      )
      for (const [card, surface] of Object.entries(appearance.sections.battery.byCard)) {
        rules.push(
          `${selector} [data-landing-section='battery'] [data-landing-card='${card}'] { ${surfaceDeclaration(surface)} }`,
        )
      }
      rules.push(
        `${selector} [data-landing-section='compare'] .gradient-green { background: ${sceneBackground(appearance.sections.compare.positive)}; }`,
      )
      const coverStage = coverStageDeclaration(appearance.sections.cover)
      if (coverStage)
        rules.push(
          `${selector} [data-landing-section='cover'] .cover-scene-stage { ${coverStage} }`,
        )
      rules.push(
        `${selector} [data-landing-section='cover'] { background: ${sceneBackground(appearance.sections.cover.background)}; }`,
      )
      for (const section of ['compare', 'users', 'join', 'footer'] as const) {
        rules.push(
          `${selector} [data-landing-section='${section}'] { ${surfaceDeclaration(appearance.sections[section])} }`,
        )
      }
      return rules.join('\n')
    })
    .join('\n')
}
