/*
 *
 * Linker
 *
 */

import type { FC } from 'react'
import { prettyURL } from '~/fmt'
import LinkSVG from '~/icons/Link'
import type { TSpace } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon'

type TProps = TSpace & {
  testid?: string
  src: string
  text?: string
  // link to external or some domain
  external?: boolean
  inline?: boolean
  plainColor?: boolean
}

const Linker: FC<TProps> = ({
  testid = 'linker',
  src,
  text = '',
  external = true,
  inline = false,
  plainColor = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  if (!src) return null

  return (
    <div className={cn(s.wrapper, inline ? 'inline-flex' : 'flex')}>
      <LinkSVG className={s.linkIcon} />
      <Tooltip
        content={<div className={s.popHint}>{src}</div>}
        placement='bottom'
        hideOnClick={false}
        delay={300}
        offset={[-10, 0] as [number, number]}
        noPadding
      >
        <a
          className={cn(s.sourceLink, plainColor && s.plainColor)}
          href={src}
          target='_blank'
          rel='noreferrer'
        >
          {prettyURL(src)}
        </a>
      </Tooltip>
    </div>
  )
}

export default Linker
