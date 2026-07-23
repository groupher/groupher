import ArrowLink from '~/widgets/Buttons/ArrowLink'
import Tooltip from '~/widgets/Tooltip'

import useSalon from './salon'
import type { TLogoListProps } from './spec'

export default function LogoList({ items, wrap = false, suffix, ...spacing }: TLogoListProps) {
  const s = useSalon({ wrap, ...spacing })

  if (items.length === 0) return null

  return (
    <ul className={s.wrapper}>
      {items.map(({ logoSrc, text, slogan, href, markdownHref }, index) => {
        const isLast = index === items.length - 1

        return (
          <li key={text} className={s.item}>
            <Tooltip
              placement='top'
              delay={200}
              maxWidth={280}
              portalToBody
              accessibleContent
              content={
                <div className={s.tooltip}>
                  <img
                    aria-hidden='true'
                    alt=''
                    className={s.tooltipLogo}
                    src={logoSrc}
                    width={32}
                    height={32}
                  />
                  <div className={s.tooltipContent}>
                    <div className={s.tooltipTitle}>{text}</div>
                    <p className={s.tooltipBody}>{slogan}</p>
                    <ArrowLink href={markdownHref} className={s.tooltipLink}>
                      Read the doc
                    </ArrowLink>
                  </div>
                </div>
              }
            >
              <a aria-label={text} className={s.link} href={href} target='_blank' rel='noreferrer'>
                <img
                  aria-hidden='true'
                  alt=''
                  className={s.logo}
                  src={logoSrc}
                  width={14}
                  height={14}
                />
              </a>
            </Tooltip>
            {isLast && suffix && <span className={s.suffix}>{suffix}</span>}
          </li>
        )
      })}
    </ul>
  )
}
