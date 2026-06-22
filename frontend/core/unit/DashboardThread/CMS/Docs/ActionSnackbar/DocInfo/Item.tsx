import type { FC, ReactNode } from 'react'

import { DOC_INFO_MODAL } from '../constant'
import useSalon from '../salon/doc_info/item'

type TProps = {
  label: string
  value?: ReactNode
}

const DocInfoItem: FC<TProps> = ({ label, value }) => {
  const s = useSalon()

  return (
    <div className={s.item}>
      <div className={s.value}>{value ?? DOC_INFO_MODAL.EMPTY}</div>
      <div className={s.label}>{label}</div>
    </div>
  )
}

export default DocInfoItem
