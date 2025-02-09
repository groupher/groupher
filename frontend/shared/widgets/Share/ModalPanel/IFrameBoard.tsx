import { type FC, memo } from 'react'

import Input from '~/widgets/Input'
import CopyButton from '~/widgets/Buttons/CopyButton'

import useSalon from '../salon/modal_panel/iframe_board'

const IFrameBoard: FC = () => {
  const s = useSalon()

  const code =
    '<iframe width="560" height="315" src="https://groupher.com/embed/example" title="example" frameborder="0"></iframe>'

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>嵌入网页</div>
        <CopyButton value={code} />
      </div>
      <div className={s.codeWrapper}>
        <Input behavior="textarea" value={code} className={s.inputer} />
      </div>
    </div>
  )
}

export default memo(IFrameBoard)
