/*
 *
 * Pagi
 *
 */

import type { FC, ReactNode } from 'react'

import type { TPagi, TSpace } from '~/spec'
import RealPagi from './RealPagi'
import useSalon, { cn } from './salon'

export type TProps = {
  children?: ReactNode
  type?: 'bottom' | 'center'
  emptyMsg?: string
  noMoreMsg?: string
  showBottomMsg?: boolean
  onChange?: (page: number) => void
} & TPagi &
  TSpace

const hasExtraPage = (totalCount, pageSize) => totalCount > pageSize

const Pagi: FC<TProps> = ({
  onChange = console.log,
  showBottomMsg = false,
  emptyMsg = '还没有讨论',
  noMoreMsg = '没有更多讨论了',
  pageNumber,
  pageSize,
  totalCount,
  totalPages,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  const handlePageChange = (page: number) => {
    onChange(page)
  }

  if (totalCount === 0) {
    return (
      <div className={cn(s.wrapper, s.empty)}>
        {showBottomMsg && <div className={s.bottomMsg}>{emptyMsg}</div>}
      </div>
    )
  }

  return hasExtraPage(totalCount, pageSize) ? (
    <RealPagi
      pageNumber={pageNumber}
      totalCount={totalCount}
      totalPages={totalPages}
      pageSize={pageSize}
      onChange={handlePageChange}
      {...spacing}
    />
  ) : (
    <div className={cn(s.wrapper, s.empty)}>
      {showBottomMsg && <div className={s.bottomMsg}>{noMoreMsg}</div>}
    </div>
  )
}

export default Pagi
