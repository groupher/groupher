import type { FC } from 'react'

import type { TEditMode, TSubmitState } from '~/spec'

import SubmitButton from '~/widgets/Buttons/SubmitButton'

import WordsCounter from '~/widgets/WordsCounter'

import type { TEditData } from './spec'
import useLogic from './useLogic'
import useSalon from './styles/footer'

type TProps = {
  mode: TEditMode
  editData: TEditData
  submitState: TSubmitState
}

const Footer: FC<TProps> = ({ mode, editData, submitState }) => {
  const s = useSalon()
  const { onPublish, onCancel, setWordsCountState } = useLogic()

  const { body } = editData

  return (
    <div className={s.wrapper}>
      <div className={s.publishFooter}>
        <WordsCounter body={body} bottom={3} onChange={setWordsCountState} min={40} />
        <div className="grow" />
        <SubmitButton
          submitState={submitState}
          okText={mode === 'publish' ? '发 布' : '更 新'}
          onPublish={onPublish}
          onCancel={onCancel}
        />
      </div>
    </div>
  )
}

export default Footer
