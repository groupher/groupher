import {defineConfig} from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  integrations: [
    starlight({
      title: 'Fixture Docs',
      sidebar: [
        {label: 'Home', slug: ''},
        {label: 'Guides', autogenerate: {directory: 'guides'}},
        {
          label: 'API',
          items: [{label: 'Overview', slug: 'api'}],
        },
        {label: 'Project', link: 'https://example.com/project'},
      ],
    }),
  ],
})
