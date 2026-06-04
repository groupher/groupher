import type { CSSProperties, FC } from 'react'

import type { TColorName, TSpace } from '~/spec'

import useSalon from './salon'
import type { TIcon, TProvider } from './spec'
import { getIconFilePath, getIconSpriteHref } from './sprite'

type TMode = 'sprite' | 'mask'

type TProps = {
  testid?: string
  size?: number
  icon?: TIcon
  provider?: TProvider
  mode?: TMode
  color?: TColorName
  opacity?: number
  className?: string
} & TSpace

const IconHub: FC<TProps> = ({
  testid: _testid = 'icon-hub',
  size = 3.5,
  icon = 'user',
  provider = 'fa',
  mode = 'mask',
  color,
  opacity,
  className,
  ...spacing
}) => {
  const s = useSalon({ ...spacing, color, size, className, mode })
  const style = {
    opacity,
    ...(mode === 'mask'
      ? {
          WebkitMaskImage: `url(${getIconFilePath(provider, icon)})`,
          maskImage: `url(${getIconFilePath(provider, icon)})`,
        }
      : {}),
  } as CSSProperties

  return (
    <div className={s.wrapper} data-testid={_testid}>
      {mode === 'sprite' ? (
        <svg aria-hidden='true' focusable='false' className={s.icon} style={style}>
          <use href={getIconSpriteHref(provider, icon)} />
        </svg>
      ) : (
        <span aria-hidden='true' className={s.icon} style={style} />
      )}
    </div>
  )
}

export default IconHub
