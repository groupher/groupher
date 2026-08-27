import type { FC } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'
import type { TActive, TFooterOnelineLink } from '~/spec'
import CommunityBrand from '~/unit/CommunityBrand'
import SocialList from '~/unit/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../salon/templates/oneline'

type TProps = {
  links: readonly TFooterOnelineLink[]
  /**
   * When used as a layout selector preview, disable nested interactive elements
   * (e.g., anchors) to avoid interactive-in-interactive a11y violations.
   */
  previewOnly?: boolean
} & TActive

const RADIO_NAME = 'footer-layout'

const Oneline: FC<TProps> = ({ links, active, previewOnly = true }) => {
  const s = useSalon()
  const { edit } = useFooter()

  const radioId = 'footer-layout-oneline'

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(FOOTER_LAYOUT.ONELINE, 'footerLayout')}
        className='sr-only'
      />

      <CommunityBrand className='scale-95' />

      <div className={s.center}>
        {links.map((item) =>
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

export default Oneline
