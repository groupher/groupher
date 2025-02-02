import type { TArticle } from '~/spec'

import { openShareWindow } from '~/helper'

import type { TLinksData } from './spec'
import { SHARE_TYPE } from './constant'

export const parseLinksData = (article: TArticle, link: string): TLinksData => {
  if (!article?.meta?.thread) {
    return {
      link: '',
      html: '',
      md: '',
      orgMode: '',
    }
  }

  const { title } = article

  return {
    link,
    html: `<a href="${link}">${title}</a>`,
    md: `[${title}](${link})`,
    orgMode: `[[${link}][${title}]]`,
  }
}

export const toPlatform = (article: TArticle, type: string, url: string): void => {
  const { title, digest } = article

  switch (type) {
    case SHARE_TYPE.TWITTER: {
      const param = { url, text: title }

      openShareWindow('https://twitter.com/intent/tweet', param)
      return
      // return openShareWindow('https://twitter.com/share', param)
    }

    case SHARE_TYPE.TELEGRAM: {
      const param = { url, text: title }

      openShareWindow('https://telegram.me/share/url', param)
      return
    }

    case SHARE_TYPE.EMAIL: {
      const param = { subject: title, body: `${url}\n\n${digest}` }
      openShareWindow('mailto:', param)
      return
    }

    case SHARE_TYPE.FACEBOOK: {
      const param = { u: url }
      openShareWindow('https://facebook.com/share.php', param)
      return
    }

    case SHARE_TYPE.DOUBAN: {
      const param = { href: url, name: title }
      openShareWindow('https://shuo.douban.com/!service/share', param)
      return
    }

    case SHARE_TYPE.WEIBO: {
      const param = { url, title }
      openShareWindow('https://service.weibo.com/share/share.php', param)
      return
    }

    default: {
      // eslint-disable-next-line no-useless-return
      return
    }
  }
}
