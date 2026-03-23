import type { FC } from 'react'

import { roundUpNumber } from '~/fmt'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TPagi, TSpace } from '~/spec'
import type { TProps as TPagiProps } from '.'
import useSalon, { cn } from './salon'

type TProps = Pick<TPagiProps, 'onChange'> & TPagi & TSpace

const RealPagi: FC<TProps> = ({
  pageNumber,
  totalCount,
  pageSize,
  totalPages,
  onChange,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  const leftDisabled = pageNumber === 1
  const rightDisabled = pageNumber >= roundUpNumber(totalCount / pageSize)

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.arrowBlock} onClick={() => !leftDisabled && onChange(pageNumber - 1)}>
          <ArrowSVG className={cn(s.arrowIcon, pageNumber === 1 && s.arrowDisabled)} />
        </div>

        <div className={s.main}>
          <input
            className={cn(s.numInputer, pageNumber >= 10 ? 'w-9' : 'w-6')}
            type='number'
            min={1}
            max={999}
            value={pageNumber}
            onChange={(e) => onChange(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // @ts-expect-error
                onChange(Number(e.target.value))
              }
            }}
          />
          <div className={s.slash}>/</div>
          <div className={s.total}>{totalPages}</div>
        </div>
        <div className={s.arrowBlock} onClick={() => !rightDisabled && onChange(pageNumber + 1)}>
          <ArrowSVG className={cn(s.arrowIcon, 'rotate-180', rightDisabled && s.arrowDisabled)} />
        </div>
      </div>
    </div>
  )
}

export default RealPagi
