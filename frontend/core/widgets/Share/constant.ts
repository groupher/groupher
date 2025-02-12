export const SITE_SHARE_TYPE = {
  EMBED: 'embed',
  LINKS: 'links',
  WECHAT: 'wechat',
}

export const OUTSIDE_SHARE_TYPE = {
  TWITTER: 'twitter',
  EMAIL: 'email',
  WECHAT: 'wechat',
  TELEGRAM: 'telegram',
  WEIBO: 'weibo',
  DOUBAN: 'douban',
  FACEBOOK: 'facebook',
}

export const SHARE_TYPE = {
  ...SITE_SHARE_TYPE,
  ...OUTSIDE_SHARE_TYPE,
}

export const PLATFORMS = [
  {
    title: '链接',
    type: SHARE_TYPE.LINKS,
  },
  {
    title: '嵌入',
    type: SHARE_TYPE.EMBED,
  },
  {
    title: '微信',
    type: SHARE_TYPE.WECHAT,
  },
  {
    title: '微博',
    type: SHARE_TYPE.WEIBO,
  },
  {
    title: '邮箱',
    type: SHARE_TYPE.EMAIL,
  },
  {
    title: 'Douban',
    type: SHARE_TYPE.DOUBAN,
  },
  {
    title: 'Telegram',
    type: SHARE_TYPE.TELEGRAM,
  },
  {
    title: 'Twitter',
    type: SHARE_TYPE.TWITTER,
  },
  {
    title: 'Facebook',
    type: SHARE_TYPE.FACEBOOK,
  },
]
