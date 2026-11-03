import { describe, expect, it } from 'vitest'

import { COVER_SCENES } from '../coverScenes'

describe('Landing Scene manifest', () => {
  it('starts at feedback and gives every scene both theme and wallpaper modes', () => {
    expect(COVER_SCENES[4].id).toBe('feedback')
    expect(new Set(COVER_SCENES.map((scene) => scene.id)).size).toBe(9)

    for (const scene of COVER_SCENES) {
      for (const mode of ['light', 'dark'] as const) {
        expect(scene.themePreset[mode].pageBg).toBeTruthy()
        expect(scene.appearance[mode].page).toBeDefined()
        expect(scene.wallpaper[mode].assets.wide.url).toBeTruthy()
        expect(scene.wallpaper[mode].assets.phone.url).toBeTruthy()
        expect(scene.wallpaper[mode].preview).toBeTruthy()
        expect(scene.wallpaper[mode].cover).toBeTruthy()
      }
    }
  })
})
