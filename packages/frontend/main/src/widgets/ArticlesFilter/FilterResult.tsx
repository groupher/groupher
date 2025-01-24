import { type FC, memo } from 'react'

import DotDivider from '~/widgets/DotDivider'

import useSalon from './salon/filter_result'

type TProps = {
  totalCount: number
  pageNumber: number
}

const FilterResult: FC<TProps> = ({ pageNumber, totalCount }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.text}>第 {pageNumber} 页</div>
      <DotDivider className="mx-2" />
      <div className={s.text}>共 {totalCount} 条</div>
    </div>
  )
}

export default memo(FilterResult)
