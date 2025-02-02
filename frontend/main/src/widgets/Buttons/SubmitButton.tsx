import { type FC, memo } from 'react'

import type { TSubmitState } from '~/spec'

import CheckedSVG from '~/icons/Checked'

import YesOrNoButtons from './YesOrNoButtons'
import Button from './Button'
import useSalon from './salon/submit_button'

const space = 22

type TProps = {
  submitState?: TSubmitState

  okText?: string
  cancelText?: string
  withCancel?: boolean
  onCancel?: () => void
  onPublish?: () => void
}

const TheButton: FC<TProps> = ({
  okText,
  cancelText,
  withCancel,
  onCancel,
  onPublish,
  submitState,
}) => {
  const { publishing, isReady } = submitState

  return withCancel ? (
    <YesOrNoButtons
      cancelText={cancelText}
      confirmText={okText}
      onConfirm={onPublish}
      loading={publishing}
      disabled={!isReady}
      onCancel={onCancel}
    />
  ) : (
    <Button
      loading={publishing}
      onClick={() => onPublish()}
      size="small"
      space={space}
      disabled={!isReady}
    >
      {okText}
    </Button>
  )
}

const SubmitButton: FC<TProps> = ({
  okText = '发 布',
  cancelText = '取 消',
  withCancel = false,
  onCancel = console.log,
  onPublish = console.log,
  submitState = {
    publishing: false,
    publishDone: false,
    isReady: false,
    isArchived: false,
    mode: 'publish',
    isArticleAuthor: false,
  },
}) => {
  const s = useSalon()
  const { publishDone, isArchived, mode, isArticleAuthor } = submitState

  if (mode === 'update' && !isArticleAuthor) {
    return (
      <Button size="small" disabled space={space}>
        无权限
      </Button>
    )
  }

  if (isArchived) {
    return (
      <Button size="small" disabled space={space}>
        已存档
      </Button>
    )
  }

  return (
    <div>
      {publishDone ? (
        <div className={s.donwWrapper}>
          <CheckedSVG className={s.doneIcon} />
          <div className={s.downHint}>已提交</div>
        </div>
      ) : (
        <TheButton
          submitState={submitState}
          okText={okText}
          cancelText={cancelText}
          withCancel={withCancel}
          onCancel={onCancel}
          onPublish={onPublish}
        />
      )}
    </div>
  )
}

export default memo(SubmitButton)
