import THEME from '~/const/theme'
import type { TThemeName } from '~/spec'

export type TThemeKeyPicker = {
  theme: TThemeName
  key: <TKey extends string>(baseKey: TKey) => TKey | `${TKey}Dark`
  value: <
    TSource extends Partial<Record<string, unknown>>,
    TKey extends Extract<keyof TSource, string>,
  >(
    source: TSource,
    baseKey: TKey,
  ) => TSource[TKey]
}

/**
 * Bind a theme once, then resolve keys that follow the `xx / xxDark` naming rule.
 *
 * Intent: callers should pass only the base key at usage sites. This keeps
 * code that reads paired values from repeating `theme === DARK ? xxDark : xx`.
 *
 * Example:
 *   const themeKey = createThemeKeyPicker(THEME.DARK)
 *   themeKey.key('pageBg') // 'pageBgDark'
 *   themeKey.value(source, 'textTitle') // source.textTitleDark
 */
export const createThemeKeyPicker = (theme: TThemeName): TThemeKeyPicker => {
  const key = <TKey extends string>(baseKey: TKey): TKey | `${TKey}Dark` =>
    theme === THEME.DARK ? `${baseKey}Dark` : baseKey

  return {
    theme,
    key,
    value: (source, baseKey) => source[key(baseKey)] as never,
  }
}
