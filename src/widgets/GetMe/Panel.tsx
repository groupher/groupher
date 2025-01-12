import type { FC } from 'react'

import FirefoxSVG from '~/icons/Firefox'
import ChromeWebStoreSVG from '~/icons/ChromeWebStore'
import GooglePlaySVG from '~/icons/GooglePlay'
import AppStoreSVG from '~/icons/AppStore'
import GithubSVG from '~/icons/social/Github'

import LinkSVG from '~/icons/ArrowUpRight'
import { SexyDivider } from '~/widgets/Common'

import useSalon from './salon/panel'

const Panel: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.appStoreBar}>
        <GooglePlaySVG className={s.storeIcon} />
      </div>

      <div className={s.appStoreBar}>
        <AppStoreSVG className={s.storeIcon} />
      </div>

      <SexyDivider top={8} bottom={6} />

      <div className={s.menuBar}>
        <div className={s.iconBox}>
          <ChromeWebStoreSVG className={s.icon} />
        </div>
        <div className={s.info}>
          <div className={s.platform}>Chrome 应用商店</div>
          <h3 className={s.title}>Groupher</h3>
        </div>
        <div className="grow" />
        <LinkSVG className={s.linkIcon} />
      </div>

      <div className={s.menuBar}>
        <div className={s.iconBox}>
          <FirefoxSVG className={s.icon} />
        </div>
        <div className={s.info}>
          <div className={s.platform}>火狐插件市场</div>
          <h3 className={s.title}>Groupher</h3>
        </div>
        <div className="grow" />
        <LinkSVG className={s.linkIcon} />
      </div>

      <div className={s.menuBar}>
        <div className={s.iconBox}>
          <GithubSVG className={s.icon} />
        </div>
        <div className={s.info}>
          <div className={s.platform}>Github</div>
          <h3 className={s.title}>Groupher</h3>
        </div>
        <div className="grow" />
        <LinkSVG className={s.linkIcon} />
      </div>
    </div>
  )
}

export default Panel
