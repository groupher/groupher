import { includes, keys } from 'ramda'
import { type FC, useState } from 'react'

import useInterval from '~/hooks/useInterval'
import APISVG from '~/icons/API'
import CircleSVG from '~/icons/CircleDuo'
import CloudSVG from '~/icons/CloudDuo'
import DiamandSVG from '~/icons/DiamandDuo'
import FingerSVG from '~/icons/FingerPrintDuo'
import EmojiSVG from '~/icons/HeartDuo'
import SearchSVG from '~/icons/SearchDuo'
import SqaureSrewSVG from '~/icons/SqaureSrewDuo'
import SquareSVG from '~/icons/SquareDuo'
import StarSVG from '~/icons/StarDuo'
import TriangleSVG from '~/icons/TriangleDuo'
import UserSVG from '~/icons/UserDuo'
import useSalon, { cn } from '../../salon/battery_bento/grid_blocks'
import { SHINE_DOTS } from './constant'
import Slogan from './Slogan'

const GridBlocks: FC = () => {
  const s = useSalon()
  const [shineIdx, setShineIdx] = useState(0)

  useInterval(() => {
    const nextIdx = shineIdx >= keys(SHINE_DOTS).length - 1 ? 0 : shineIdx + 1
    setShineIdx(nextIdx)
  }, 2000)

  return (
    <div className={s.wrapper}>
      <Slogan />
      <div className={s.inner}>
        <div className={cn(s.rowLine, 'top-0')} />
        <div className={cn(s.line, 'left-80 ml-3')} />
        <div className={cn(s.line, 'right-80 mr-8')} />
        <div className={cn(s.rowLine, 'top-40 mt-3')} />

        <SquareSVG
          className={cn(
            s.vibeIcon,
            'left-80 ml-1 -mt-1.5',
            includes('1', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />
        <CircleSVG
          className={cn(
            s.vibeIcon,
            'right-80 mr-6 -mt-1.5',
            includes('2', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />
        <SqaureSrewSVG
          className={cn(
            s.vibeIcon,
            'left-80 top-40 ml-1 mt-1.5',
            includes('3', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />

        <DiamandSVG
          className={cn(
            s.vibeIcon,
            'right-80 top-40 mr-6 mt-1.5',
            includes('4', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />

        <TriangleSVG
          className={cn(
            s.vibeIcon,
            'left-80 -bottom-2 ml-1 mb-0.5',
            includes('5', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />

        <StarSVG
          className={cn(
            s.vibeIcon,
            'right-80 -bottom-2 mr-6 mb-0.5',
            includes('5', SHINE_DOTS[shineIdx]) && s.vibeDown,
          )}
        />

        <div className={s.block}>
          <div className={s.iconBox}>
            <CloudSVG className={cn(s.blockIcon, s.fillPurple, 'opacity-65')} />
          </div>
          <h3 className={s.title}>灵活部署</h3>
          <div className={s.desc}>支持托管，以及国内外各种云服务提供商，一键私有部署。</div>
        </div>

        <div className={s.block}>
          <div className={s.iconBox}>
            <SearchSVG className={cn(s.blockIcon, s.fillBlue)} />
          </div>
          <h3 className={s.title}>全文搜索</h3>
          <div className={s.desc}>基于业界领先的 Meilisearch，功能强大 & 快捷的全文搜索体验。</div>
        </div>

        <div className={s.block}>
          <div className={s.iconBox}>
            <FingerSVG className={cn(s.blockIcon, s.fillGreen)} />
          </div>
          <h3 className={s.title}>OAuth</h3>
          <div className={s.desc}>只需少量配置，即可支持国内外主流 Oauth 登录方式。</div>
        </div>

        <div className={s.block}>
          <div className={s.iconBox}>
            <UserSVG className={cn(s.blockIcon, s.fillOrange)} />
          </div>
          <h3 className={s.title}>消息通知</h3>
          <div className={s.desc}>
            通过站内，邮件，微信等渠道及时通知用户，支持 webhook 自定义。
          </div>
        </div>

        <div className={s.block}>
          <div className={s.iconBox}>
            <EmojiSVG className={cn(s.blockIcon, s.fillRed)} />
          </div>
          <h3 className={s.title}>Emoji 反馈</h3>
          <div className={s.desc}>
            帖子、更新日志等内容以及所有评论都支持 Emoji 表情，增加用户互动乐趣。
          </div>
        </div>

        <div className={s.block}>
          <div className={s.iconBox}>
            <APISVG className={cn(s.blockIcon, s.fillCyan, 'opacity-60')} />
          </div>
          <h3 className={s.title}>开发者友好</h3>
          <div className={s.desc}>
            完全开源，前后端分离架构，可基于平台 API 二次开发自定义需求。
          </div>
        </div>

        <div className={cn(s.rowLine, 'bottom-0')} />
      </div>
    </div>
  )
}

export default GridBlocks
