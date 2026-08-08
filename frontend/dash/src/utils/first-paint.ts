import {
  RESOLVED_THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  THEME_MODE,
  THEME_MODE_COOKIE,
} from '~/const/theme'
import type { TThemeMode, TThemeName } from '~/spec'

type TThemeSeed = {
  theme: TThemeName
  themeMode: TThemeMode
}

export const prePaintThemeDetectScript = ({ theme, themeMode }: TThemeSeed) => `
(function() {
  try {
    var mode = '${themeMode}';
    var theme = '${theme}';

    if (mode === '${THEME_MODE.SYSTEM}') {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      theme = media.matches ? '${THEME_MODE.DARK}' : '${THEME_MODE.LIGHT}';
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.style.colorScheme = theme;
    document.cookie = '${THEME_MODE_COOKIE}=' + mode + '; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax';
    document.cookie = '${RESOLVED_THEME_COOKIE}=' + theme + '; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax';
  } catch (e) {}
})();
`

export const prePaintRuntimeSeedScript = (renderedAt: number) => `
(function() {
  try {
    window.process = window.process || { env: {} };
    window.__GROUPHER_INITIAL_NOW__ = ${renderedAt};
  } catch (e) {}
})();
`
