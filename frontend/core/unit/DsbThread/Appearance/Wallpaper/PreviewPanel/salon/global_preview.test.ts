import useSalon from './global_preview'

const wallpaperState = vi.hoisted(() => ({
  type: 'none' as 'none' | 'gradient',
}))

vi.mock('~/hooks/useTheme', () => ({
  default: () => ({ isDarkTheme: false }),
}))

vi.mock('~/stores/wallpaper/hooks', () => ({
  default: () => ({}),
}))

vi.mock('~/stores/wallpaper/helper', () => ({
  pickWallpaperThemeState: () => ({
    type: wallpaperState.type,
  }),
}))

vi.mock('~/stores/dsbShell/hooks', () => ({
  default: () => ({ contentShadow: false }),
}))

vi.mock('~/hooks/useTwBelt', () => ({
  default: () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
    br: (key: string) => `border-${key}`,
    bg: (key: string) => `bg-${key}`,
    hoverBr: () => 'hover-border',
    shadow: (key: string) => `shadow-${key}`,
    primary: (key: string) => `primary-${key}`,
    sexyBorder: () => 'sexy-border',
    vividDark: () => 'vivid-dark',
  }),
}))

describe('Global preview salon geometry', () => {
  beforeEach(() => {
    wallpaperState.type = 'none'
  })

  it('keeps height and width on every bar overlay', () => {
    const salon = useSalon()

    for (const key of [
      'titleBar',
      'wideBar',
      'midBar',
      'longBar',
      'shortBar',
      'dimBar',
      'footerShort',
      'footerWide',
    ] as const) {
      expect(salon[key]).toMatch(/\bh-2\b/)
      expect(salon[key]).toMatch(/\bw-/)
    }
  })

  it('does not add a Content blur surface for NONE', () => {
    expect(useSalon().content).not.toMatch(/\bbackdrop-blur-sm\b/)
  })

  it('adds the Content blur surface for a renderable draft', () => {
    wallpaperState.type = 'gradient'

    expect(useSalon().content).toMatch(/\bbackdrop-blur-sm\b/)
  })
})
