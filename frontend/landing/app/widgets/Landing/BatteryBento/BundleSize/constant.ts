export const MAX_SIZE = 3590 // cicle, 3.5 Mb * 1024

const ICON_ASSET = '/landing/products'

export const PRODUCTS = [
  {
    title: 'Groupher',
    size: '384 KB',
    sizeNum: 384,
    icon: `${ICON_ASSET}/groupher.png`,
    iconSize: 'size-3.5',
  },
  {
    title: 'Flarum',
    size: '433 KB',
    sizeNum: 433,
    icon: `${ICON_ASSET}/flarum.png`,
  },
  // {
  //   title: 'UserVoice',
  //   size: '515 KB',
  //   sizeNum: 515,
  //   icon: `${ICON_ASSET}/uservoice.png`,
  // },
  {
    title: 'Canny',
    size: '883 KB',
    sizeNum: 883,
    icon: `${ICON_ASSET}/canny.png`,
  },
  // https://feedback.frill.co/b/4q0qxv2r/frillco-customer-ideas
  {
    title: 'Frill',
    size: '1.1+ MB',
    sizeNum: 1.14 * 1024,
    icon: `${ICON_ASSET}/frill.png`,
  },
  // https://www.gainsight.com/customer-communities/examples/
  // {
  //   title: 'Gainsight',
  //   size: '1.3+ MB',
  //   sizeNum: 1.32 * 1024,
  //   icon: `${ICON_ASSET}/gainsight.png`,
  // },
  // https://feedback.featureos.app/
  {
    title: 'FeatureOS',
    size: '1.3+ MB',
    sizeNum: 1.35 * 1024,
    iconSize: 'size-3.5',
    icon: `${ICON_ASSET}/featureos.png`,
  },
  // https://feedback.featurebase.app/
  {
    title: 'Featurebase',
    size: '1.4+ MB',
    sizeNum: 1.45 * 1024,
    iconSize: 'size-3',
    icon: `${ICON_ASSET}/featurebase.webp`,
  },
  // https://github.com/vercel/next.js/discussions
  {
    title: 'Github Discussions',
    size: '1.7+ MB',
    sizeNum: 1.7 * 1024,
    icon: `${ICON_ASSET}/github.png`,
  },
  // https://meta.discourse.com/
  {
    title: 'Discourse',
    size: '1.9+ MB',
    sizeNum: 1.96 * 1024,
    opacity: 'opacity-90',
    icon: `${ICON_ASSET}/discourse.png`,
  },
  {
    title: '腾讯兔小巢',
    size: '2+ MB',
    sizeNum: 2 * 1024,
    opacity: 'opacity-80',
    icon: `${ICON_ASSET}/txc.png`,
    iconSize: 'size-3.5',
  },
  {
    title: 'Trello',
    size: '2.1+ MB',
    sizeNum: 2.2 * 1024 + 65 - 131,
    opacity: 'opacity-70',
    icon: `${ICON_ASSET}/trello.png`,
  },
  {
    title: 'Circle',
    size: '3.5+ MB',
    sizeNum: 3.5 * 1024,
    opacity: 'opacity-60',
    icon: `${ICON_ASSET}/circle.png`,
  },
]
