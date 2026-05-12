import type { FC } from 'react'

import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'
import type { TActive, TLinkItem } from '~/spec'
import CommunityBrand from '~/unit/CommunityBrand'
import SocialList from '~/unit/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates/simple'
import { isValidFooterLink } from '../Editors/model'

type TProps = {
  links: readonly TLinkItem[]
  /**
   * When used as a layout selector preview, disable nested interactive elements
   * (e.g., anchors) to avoid interactive-in-interactive a11y violations.
   */
  previewOnly?: boolean
} & TActive

const RADIO_NAME = 'footer-layout'

const Simple: FC<TProps> = ({ links, active, previewOnly = true }) => {
  const s = useSalon()
  const { edit } = useFooter()

  const radioId = 'footer-layout-simple'

  const validLinks = links.every(isValidFooterLink) ? links : []
  const firstGroupLinks =
    validLinks.find((item) => item.type === DASHBOARD_LINK_TYPE.GROUP)?.links || []

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(FOOTER_LAYOUT.SIMPLE, 'footerLayout')}
        className='sr-only'
      />

      <CommunityBrand className='scale-95' />

      <div className={s.center}>
        {firstGroupLinks.map((item) =>
          previewOnly ? (
            <span className={s.linkItem} key={item.title}>
              {item.title}
            </span>
          ) : (
            <a className={s.linkItem} key={item.title} href={item.url}>
              {item.title}
            </a>
          ),
        )}
      </div>

      <div className={s.right}>
        <SocialList top={0} size='tiny' selected={DEME_SOCIALS} />
      </div>
    </label>
  )
}

export default Simple
