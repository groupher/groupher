import type { MetadataRoute } from 'next'

const siteUrl = 'https://www.groupher.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/private/',
        '/api/',
        '/_next/',
        '/assets/',
        '*/404',
        '*/500',
        '/*/dashboard/', // disable all /xxx/dashboard/
        '/*/dashboard/*',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
