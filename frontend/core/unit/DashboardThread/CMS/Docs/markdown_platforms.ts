import type { TLogoListItem } from '~/ui/LogoList/spec'

export const MARKDOWN_PLATFORMS = [
  {
    text: 'Mintlify',
    slogan: 'AI-native, beautiful out of the box, and built for developers.',
    href: 'https://www.mintlify.com/docs/ai/markdown-export',
    markdownHref: 'https://www.mintlify.com/docs/ai/markdown-export.md',
    logoSrc: '/icons/platform/mintlify.png',
  },
  {
    text: 'GitBook',
    slogan: 'Create and publish AI-native documentation your users will love.',
    href: 'https://gitbook.com/docs/publishing-documentation/llm-ready-docs',
    markdownHref: 'https://gitbook.com/docs/publishing-documentation/llm-ready-docs.md',
    logoSrc: '/icons/platform/gitbook.png',
  },
  {
    text: 'Fern',
    slogan: 'Build beautiful developer documentation that matches your brand.',
    href: 'https://buildwithfern.com/learn/docs/configuration/page-level-settings',
    markdownHref: 'https://buildwithfern.com/learn/docs/configuration/page-level-settings.md',
    logoSrc: '/icons/platform/fern.png',
  },
  {
    text: 'ReadMe',
    slogan: 'Build and maintain beautiful, interactive API documentation.',
    href: 'https://docs.readme.com/main/changelog/ask-ai-llms-txt',
    markdownHref: 'https://docs.readme.com/main/changelog/ask-ai-llms-txt.md',
    logoSrc: '/icons/platform/readme.png',
  },
  {
    text: 'Speakeasy',
    slogan: 'Generate API docs that stay in sync with your SDKs.',
    href: 'https://www.speakeasy.com/blog/prepare-your-website-for-llms',
    markdownHref: 'https://www.speakeasy.com/blog/prepare-your-website-for-llms.md',
    logoSrc: '/icons/platform/speakeasy.png',
  },
  {
    text: 'Fumadocs',
    slogan: 'Build excellent documentation, your style.',
    href: 'https://www.fumadocs.dev/docs/integrations/llms',
    markdownHref:
      'https://raw.githubusercontent.com/fuma-nama/fumadocs/dev/apps/docs/content/docs/%28framework%29/integrations/llms.mdx',
    logoSrc: '/icons/platform/fumadocs.png',
  },
  {
    text: 'VitePress',
    slogan: 'A static site generator for fast, content-centric websites.',
    href: 'https://vitepress.dev/guide/markdown',
    markdownHref: 'https://vitepress.dev/guide/markdown.md',
    logoSrc: '/icons/platform/vitepress.png',
  },
  {
    text: 'Rspress',
    slogan: 'A fast static site generator based on the Rspack ecosystem.',
    href: 'https://rspress.dev/guide/basic/conventional-route',
    markdownHref: 'https://rspress.dev/guide/basic/conventional-route.md',
    logoSrc: '/icons/platform/rspress.png',
  },
] satisfies readonly TLogoListItem[]
