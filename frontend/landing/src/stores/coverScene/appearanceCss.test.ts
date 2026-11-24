import { describe, expect, it } from 'vitest'

import center from '../../const/scenes/center'
import { serializeLandingAppearanceCss } from './appearanceCss'

describe('Landing Scene appearance', () => {
  it('uses a section default when tab and card overrides are absent', () => {
    const scene = structuredClone(center)
    const plain = {
      background: { kind: 'solid' as const, color: { kind: 'hex' as const, value: '#f5f5f5' } },
    }
    scene.appearance.light.sections.articles = { default: plain, byTab: {} }
    scene.appearance.light.sections.dashboard = { default: plain, byTab: {} }
    scene.appearance.light.sections.battery = { default: plain, byCard: {} }

    const css = serializeLandingAppearanceCss(scene)
    const lightCss = css.split("[data-theme='dark'] .landing-scene")[0]
    expect(lightCss).toContain(
      "[data-landing-section='articles'] .landing-gradient-purple { background: #f5f5f5;",
    )
    expect(lightCss).toContain(
      "[data-landing-section='dashboard'] .landing-gradient-blue { background: #f5f5f5;",
    )
    expect(lightCss).toContain(
      "[data-landing-section='battery'] [data-landing-card] { background: #f5f5f5;",
    )
  })
})
