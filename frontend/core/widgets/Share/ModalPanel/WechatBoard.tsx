import { QRCodeSVG } from 'qrcode.react'
import { type FC, memo } from 'react'

import useSalon from '../salon/modal_panel/wechat_board'

const WechatBoard: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.qrCode}>
        <QRCodeSVG value='hello world' size={100} />
      </div>
      <div className={s.desc}>
        <div className={s.descTitle}>分享到微信</div>
        <div>打开微信 &gt; 发现 &gt; 扫一扫</div>
        <div>即可将本文分享到微信。</div>
      </div>
    </div>
  )
}

export default memo(WechatBoard)
