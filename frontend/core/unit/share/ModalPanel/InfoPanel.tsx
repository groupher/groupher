import type { FC } from 'react'

import { SITE_SHARE_TYPE } from '../constant'
import useSalon from '../salon/modal_panel/info_panel'
import type { TLinksData } from '../spec'
import IFrameBoard from './IFrameBoard'
import LinkBoard from './LinkBoard'
import WechatBoard from './WechatBoard'

type TProps = {
  type: string
  linksData: TLinksData
}

const InfoPanel: FC<TProps> = ({ type, linksData }) => {
  const s = useSalon({ type })

  switch (type) {
    case SITE_SHARE_TYPE.EMBED: {
      return (
        <div className={s.wrapper}>
          <IFrameBoard />
        </div>
      )
    }
    case SITE_SHARE_TYPE.WECHAT: {
      return (
        <div className={s.wrapper}>
          <WechatBoard />
        </div>
      )
    }
    default: {
      return (
        <div className={s.wrapper}>
          <LinkBoard linksData={linksData} />
        </div>
      )
    }
  }
}

export default InfoPanel
