import type { FC } from 'react'

import QRCodeSolidSVG from '~/icons/QRCodeSolid'
import LinkSVG from '~/icons/Share'
import WeChatSVG from '~/icons/social/WeChat'
import TwitterSVG from '~/icons/TwitterX'

import useSalon, { cn } from '../../salon/battery_bento/mobile_first/blocks'

type TProps = {
  hovering: boolean
}

const Blocks: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.block, hovering && 'rotate-180')} />
      <div className={cn(s.block, s.blockSolid)}>
        <QRCodeSolidSVG className={cn(s.featureIcon, 'size-5')} />
      </div>
      <div className={cn(s.block, s.blockSolid)}>
        <TwitterSVG className={s.featureIcon} />
      </div>
      <div className={cn(s.block, s.blockSolid)}>
        <WeChatSVG className={s.featureIcon} />
      </div>
      <div className={cn(s.block, hovering && 'rotate-180')} />
      <div className={cn(s.block, hovering && 'rotate-180')} />
      <div className={cn(s.block, hovering && 'rotate-180')} />
      <div className={cn(s.block, s.blockSolid)}>
        <LinkSVG className={s.featureIcon} />
      </div>
      <div className={cn(s.block, hovering && 'rotate-180')} />
    </div>
  )
}

export default Blocks
