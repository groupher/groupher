export const INTEGRATE_ANALYSIS_TOOLS = [
  {
    key: 'ga',
    title: 'Google Analytics',
    desc: '页面访问量、来源渠道、用户路径、事件与转化数据。',
    detail:
      '通过集成 Google Analytics，你可以分析文档页面的访问量、来源渠道、用户路径以及事件与转化行为，用于评估内容效果并持续优化文档结构。',
    trackLabel: '添加 Tracking ID',
    trackDesc: '可在你的 Google Analytics 属性设置中找到对应的 Measurement ID。',
    placeholder: 'G-1234567',
    homepage: 'https://developers.google.com/analytics',
  },

  {
    key: 'gtm',
    title: 'Google Tag Manager',
    desc: '基于触发条件加载和管理第三方脚本与事件标签。',
    detail:
      '通过集成 Google Tag Manager，你可以在不修改代码的情况下集中管理和部署各类第三方脚本与事件标签，并基于用户行为触发自定义埋点，用于分析文档访问与交互情况。',
    trackLabel: '添加 Tag Manager ID',
    trackDesc: '可在你的 Google Tag Manager 账户中找到对应的容器 ID。',
    placeholder: 'GTM-ABC1234',
    homepage: 'https://developers.google.com/tag-platform/tag-manager',
  },

  {
    key: 'fb_pixel',
    title: 'Facebook Pixel ID',
    desc: '广告访问、转化事件与受众数据回传。',
    detail:
      '通过添加 Facebook Pixel ID，你可以追踪用户访问文档时的页面浏览行为，并将相关事件回传至 Meta 广告系统，用于转化分析与受众构建。',
    trackLabel: 'Pixel ID',
    trackDesc:
      '当用户访问文档时，将触发 PageViewLoggedIn 与 PageViewLoggedOut 事件，用于区分登录与未登录访问。',
    placeholder: '366164530432366',
    homepage: 'https://developers.facebook.com/docs/meta-pixel',
  },

  {
    key: 'hotjar',
    title: 'Hotjar Site ID',
    desc: '页面点击与滚动热力图，以及用户会话回放。',
    detail:
      'Hotjar Site ID 用于将 Hotjar 的行为分析与反馈工具接入到你的文档中，帮助你分析用户点击、滚动行为以及完整的会话回放。',
    trackLabel: 'Hotjar Site ID',
    trackDesc: '可在 Hotjar 后台的站点设置中找到对应的 Site ID。',
    placeholder: '2038495',
    homepage: 'https://www.hotjar.com/guides/',
  },

  {
    key: 'clarity',
    title: 'MS Clarity',
    desc: '用户会话回放、点击与滚动热力图。',
    detail:
      '集成 Microsoft Clarity 后，你可以通过会话回放与热力图分析用户在文档中的实际使用行为，从而识别常见路径、交互盲点与潜在问题。',
    trackLabel: 'Clarity Project ID',
    trackDesc: '可在 Microsoft Clarity 项目设置中找到对应的 Project ID。',
    placeholder: 'your_clarity_project_id',
    homepage: 'https://learn.microsoft.com/zh-cn/clarity/',
  },

  {
    key: 'plausible',
    title: 'Plausible Analytics',
    desc: '页面访问量、来源渠道与基础事件统计，不使用第三方 Cookie。',
    detail:
      'Plausible Analytics 提供轻量级的页面访问与来源统计能力，不依赖第三方 Cookie，适合对隐私合规有要求的文档站点。',
    trackLabel: '站点域名',
    trackDesc: '填写你在 Plausible 中配置并用于统计的站点域名，无需包含协议或路径。',
    placeholder: 'docs.example.com',
    homepage: 'https://plausible.io/docs',
  },

  {
    key: 'fathom',
    title: 'Fathom Analytics Site ID',
    desc: '页面访问量与事件统计，支持无 Cookie 追踪。',
    detail:
      'Fathom Analytics 提供无 Cookie 的页面访问与事件统计能力，适用于需要简化分析流程并减少隐私负担的文档场景。',
    trackLabel: 'Fathom Site ID',
    trackDesc: '可在 Fathom Analytics 后台的站点设置中找到对应的 Site ID。',
    placeholder: 'ABCDE',
    homepage: 'https://usefathom.com/docs',
  },

  {
    key: 'umami',
    title: 'Umami Analytics',
    desc: '页面访问量、事件与来源数据，支持自托管部署。',
    detail:
      'Umami Analytics 支持自托管部署，可用于收集文档页面的访问量、事件与来源数据，适合需要完全掌控数据存储与分析流程的团队。',
    trackLabel: 'Website ID',
    trackDesc: '填写你在 Umami 中创建站点后生成的 Website ID。',
    placeholder: 'b3e2a1f4-9c7d-4e6b-8a12-2c4f6e9d1234',
    homepage: 'https://umami.is/docs',
  },

  {
    key: 'matomo',
    title: 'Matomo Analytics',
    desc: '访问量、事件、目标、用户路径与自定义报表分析。',
    detail:
      'Matomo 提供完整的访问分析、事件追踪与用户路径分析能力，并支持自定义报表与自托管部署，适合对数据控制要求较高的文档平台。',
    trackLabel: 'Site ID',
    trackDesc: '填写你在 Matomo 管理后台为站点分配的数字 Site ID。',
    placeholder: '1',
    homepage: 'https://developer.matomo.org/integration',
  },
] as const
