export const THEME_PRESET = {
  DEFAULT: 'DEFAULT',
  CLAUDE: 'CLAUDE',
  SOLARIZED: 'SOLARIZED',
  HN: 'HN',
} as const

export const DEFAULT_THEME_PRESET = THEME_PRESET.DEFAULT

export const THEME_PRESET_OPTIONS = [
  { value: THEME_PRESET.DEFAULT, title: 'Default', desc: 'Neutral baseline' },
  { value: THEME_PRESET.CLAUDE, title: 'Claude', desc: 'Warm amber tones' },
  { value: THEME_PRESET.SOLARIZED, title: 'Solarized', desc: 'Soft balanced contrast' },
  { value: THEME_PRESET.HN, title: 'HN', desc: 'Hacker News inspired' },
] as const
