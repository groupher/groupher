import THEME, { LOCAL_THEME_KEY } from '~/const/theme'

export const ssrThemeInitScript = () => `
(function() {
  try {
    var stored = localStorage.getItem('${LOCAL_THEME_KEY}');
    
    if (stored === '${THEME.DARK}' || stored === '${THEME.LIGHT}') {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.setAttribute(
        'data-theme',
        media.matches ? '${THEME.DARK}' : '${THEME.LIGHT}'
      );
    }
  } catch (e) {}
})();
`
