export const METRIC = {
  pageBgColor: {
    light: {
      'pure-white': '#fff',
      solarized: '#FEF6E4',
      'hacker news': '#F6F6F0',
      'light grey': '#FAFAF9',
      'floral-white': '#FFFAF0',
      'mint-white': '#F5FEFA',
      pink: '#fff8fd',
      todo2: '#FDF2E8',
      blue2: '#F0F6FB',
      purple: '#F5F2FE',
      todo: '#FEF8F7',
    },
    dark: {
      'charcoal-gray': '#121212',
      'dark-slate-gray': '#191919',
      'outer-space': '#171717',
      'rich-black': '#0A0A0A',
      'coffee-bean': '#1B1B1B',
      ubuntu: '#240e1d',
      obsidian: '#0B1215',
      solarized: '#002B35',
      'black-chocolate': '#100D08',
      gunmetal: '#1D1F21',
      'smoky-black': '#101720',
      'oxford-blue': '#212A37',
      'eerie-black': '#232023',
      'daylight-green': '#1C1D12',
      'jet-black': '#161618',
      arsenic: '#11181C',
    },
  },
  borderSoft: {
    opacity: 35,
    opacity_dark: 75,
  },
  container: {
    landing: {
      width: '1460px',
    },
    article: {
      width: '1360px',
    },
    community: {
      width: '1360px',
    },
    apply_community: {
      width: '1460px',
    },
    dashboard: {
      width: '1400px',
    },
    community_sidebar: {
      width: '1280px',
    },
  },
}

const containerToCSSVars = (container: Record<string, { width: string }>) => {
  return Object.entries(container)
    .map(([key, val]) => `--container-${key.replace(/_/g, '-')}-width: ${val.width};`)
    .join(' ')
}

export const toCSSVars = (tokens = METRIC) => {
  const cssParts: string[] = []

  if (tokens.container) {
    cssParts.push(containerToCSSVars(tokens.container))
  }

  return cssParts.join(' ')
}
