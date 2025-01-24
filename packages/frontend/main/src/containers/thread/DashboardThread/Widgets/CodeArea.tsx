import type { FC } from 'react'

import CopyButton from '~/widgets/Buttons/CopyButton'

import useSalon from '../salon/widgets/code_area'

const CodeArea: FC = () => {
  const id = 'your-id'
  const value = `<script async src="https://groupher.com/xxx" id="${id}" data-token="yyy" data-width="normal" />`

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {value}
      <div className={s.copyBtn}>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

export default CodeArea
