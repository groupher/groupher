import { isEmpty } from 'ramda'
import { type FC, memo } from 'react'

import ArrowSVG from '~/icons/Arrow'
import LockSVG from '~/icons/Lock'
import MoreSVG from '~/icons/menu/MoreL'
import RefreshSVG from '~/icons/Refresh'
import StarSVG from '~/icons/Star5'

import useSalon, { cn } from '../salon/fake_browser/browser_head'
import Favicon from './Favicon'

type TProps = {
  domain?: string
  title?: string
  desc?: string
  activePath: string
  logo?: string | null
}

const BrowserHead: FC<TProps> = ({ domain = '', title = '', activePath = '', logo = null }) => {
  const s = useSalon()

  const tabTitle = title || domain || 'groupher'

  return (
    <>
      <div className={s.header}>
        <div className={s.tab}>
          <div className={s.tabLeft} />
          <div className={s.tabRight} />
          <Favicon title={title} logo={logo} />
          <div className={s.tabContent}>{tabTitle}</div>
        </div>
      </div>
      <div className={s.addrBar}>
        <div className={s.toolbar}>
          <ArrowSVG className={cn(s.toolIcon, 'size-3 opacity-40')} />
          <ArrowSVG className={cn(s.toolIcon, 'size-3 rotate-180')} />
          <RefreshSVG className={s.toolIcon} />
        </div>
        <div className={s.form}>
          <LockSVG className={s.lockIcon} />
          <div className={s.input}>
            {isEmpty(domain) ? (
              <div className={s.mainDomain}>groupher.com</div>
            ) : (
              <div className='row-center'>
                <div className={s.mainDomainActive}>groupher.com</div>
                <div className={s.slash}>/</div>
                <div className={s.domainText} style={s.domainTextStyle}>
                  {domain.toLowerCase()}
                </div>
                <div className={cn(s.threadPath, activePath ? 'opacity-100' : 'opacity-0')}>
                  <div className={s.slash}>/</div>
                  <div className={s.threadText}>{activePath}</div>
                </div>
              </div>
            )}
            <div className='grow' />
            <StarSVG className={s.starIcon} />
          </div>
        </div>
        <MoreSVG className={s.moreIcon} />
      </div>
    </>
  )
}

export default memo(BrowserHead)
