import { readDemoWallpaper, writeDemoWallpaper } from './demo'

describe('Demo wallpaper storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('merges submitted theme fields per community', () => {
    writeDemoWallpaper('home', { light: { source: 'demo-gradient' } })
    writeDemoWallpaper('home', { dark: { source: 'demo-dark' } })
    writeDemoWallpaper('other', { light: { source: 'other-gradient' } })

    expect(readDemoWallpaper('home')).toMatchObject({
      light: { source: 'demo-gradient' },
      dark: { source: 'demo-dark' },
    })
    expect(readDemoWallpaper('other')).toMatchObject({ light: { source: 'other-gradient' } })
  })
})
