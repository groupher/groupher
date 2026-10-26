import { defineConfig } from '@rspress/core'

export default defineConfig({
  root: 'docs',
  themeConfig: {
    sidebar: {
      '/guide/': [
        {
          text: 'Basics',
          items: [
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'External API', link: 'https://api.example.com' },
          ],
        },
      ],
    },
  },
})
