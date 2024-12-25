/*
 *
 * Share
 *
 */

import { type FC, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import copy from 'copy-to-clipboard'
import QRCode from 'qrcode.react'

import type { TSpace } from '~/spec'
import useViewingArticle from '~/hooks/useViewingArticle'
import { toast } from '~/signal'

import LinkSVG from '~/icons/Link'
// import QRCodeSVG from '~/icons/QRCodeSolid'
import MoreSVG from '~/icons/ShareArrow'
import WeiboRawSVG from '~/icons/social/WeiboRaw'
import WeChatRawSVG from '~/icons/social/WeChatRaw'
import Tooltip from '~/widgets/Tooltip'

import { SITE_SHARE_TYPE, SHARE_TYPE } from './constant'
import { parseLinksData, toPlatform } from './helper'
import useSalon, { cn } from './styles'

let ModalPanel = null

type TProps = {
  modalOffset?: string
} & TSpace

const Share: FC<TProps> = ({ modalOffset = '', ...spacing }) => {
  const s = useSalon({ ...spacing })

  const { article, articleLink } = useViewingArticle()
  const linksData = parseLinksData(article, articleLink)

  const [showMore, setShowMore] = useState(false)
  const [shareType, setShareType] = useState(SITE_SHARE_TYPE.LINKS)

  useEffect(() => {
    ModalPanel = dynamic(() => import('./ModalPanel'), {
      ssr: false,
    })
  }, [showMore])

  return (
    <div className={s.wrapper}>
      <Tooltip content={<div className={s.linkTip}>复制链接</div>} placement="bottom" delay={500}>
        <div
          className={s.iconBox}
          onClick={() => {
            copy(articleLink)
            toast('已复制到剪切板')
          }}
        >
          <LinkSVG className={cn(s.icon, 'size-6')} />
        </div>
      </Tooltip>

      <Tooltip
        content={
          <div className={s.panel}>
            <QRCode value={articleLink} size={120} />

            <div className={s.qrTip}>打开微信 &gt; 发现 &gt; 扫一扫，即可将本文分享到微信。</div>
          </div>
        }
        placement="bottom"
        delay={200}
      >
        <div className={cn(s.iconBox, '-mt-px')}>
          <WeChatRawSVG className={cn(s.icon, 'size-5')} />
        </div>
      </Tooltip>

      <Tooltip content={<div className={s.linkTip}>分享到微博</div>} placement="bottom" delay={500}>
        <div
          className={cn(s.iconBox, '-mt-0.5')}
          onClick={() => {
            toPlatform(article, SHARE_TYPE.WEIBO, articleLink)
          }}
        >
          <WeiboRawSVG className={cn(s.icon, 'size-5')} />
        </div>
      </Tooltip>

      <Tooltip content={<div className={s.linkTip}>更多分享</div>} placement="bottom" delay={500}>
        <div className={s.iconBox} onClick={() => setShowMore(true)}>
          <MoreSVG className={cn(s.icon, 'size-5')} />
        </div>
      </Tooltip>

      {ModalPanel && (
        <ModalPanel
          show={showMore}
          offsetLeft={modalOffset}
          siteShareType={shareType}
          changeType={(type) => {
            setShareType(type)
            toPlatform(article, type, articleLink)
          }}
          linksData={linksData}
          article={article}
          onClose={() => {
            setShowMore(false)
            setShareType(SITE_SHARE_TYPE.LINKS)
          }}
        />
      )}
    </div>
  )
}

export default Share
