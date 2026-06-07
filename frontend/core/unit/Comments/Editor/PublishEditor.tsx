import { type FC, memo } from 'react'

import type { TSubmitState } from '~/spec'

import useSalon from './salon/publish_editor'
import useActions from '../useLogic/useActions'
// import Header from './Header'
import BodyEditor from './BodyEditor'

type TProps = {
  body: string
  submitState: TSubmitState
}

const PublishEditor: FC<TProps> = ({ submitState: _submitState, body }) => {
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
