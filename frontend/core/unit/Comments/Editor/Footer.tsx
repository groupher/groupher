import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TSubmitState } from '~/spec'
import SubmitButton from '~/widgets/Buttons/SubmitButton'
import WordsCounter from '~/widgets/WordsCounter'

import useActions from '../useLogic/useActions'
import useSalon from './salon/footer'

type TProps = {
  body: string
  label?: string
  submitState: TSubmitState
  onPublish: () => void
  onCancel: () => void
}

const EditorFooter: FC<TProps> = ({ body, label, submitState, onPublish, onCancel }) => {
  const s = useSalon()
  const { setWordsCountState } = useActions()
  const { t } = useTrans()
  const resolvedLabel = label ?? t('comment.submit.publish')

  return (
    <div className={s.wrapper}>
      <WordsCounter body={body} bottom={3} min={10} max={1000} onChange={setWordsCountState} />
      <SubmitButton
        okText={resolvedLabel}
        submitState={submitState}
        onPublish={onPublish}
        onCancel={onCancel}
      />
    </div>
  )
}

export default EditorFooter
