import { type FC, memo } from 'react'

import type { TSubmitState } from '~/spec'

// import Header from './Header'
import BodyEditor from './BodyEditor'

import useActions from '../useLogic/useActions'
import useSalon from '../salon/editor/publish_editor'

type TProps = {
  body: string
  submitState: TSubmitState
}

const PublishEditor: FC<TProps> = ({ submitState, body }) => {
  const s = useSalon()
  const { commentOnChange } = useActions()

  return (
    <div className={s.wrapper}>
      {/* <Header accountInfo={accountInfo} showEditor={showEditor} /> */}
      <BodyEditor body={body} onChange={(v) => commentOnChange(v)} />

      {/* <Footer
        submitState={submitState}
        body={body}
        onPublish={createComment}
        onCancel={closeEditor}
      /> */}
    </div>
  )
}

export default memo(PublishEditor)
