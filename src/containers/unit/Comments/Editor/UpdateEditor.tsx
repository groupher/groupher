import { type FC, memo } from 'react'

import type { TSubmitState } from '~/spec'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import CustomScroller from '~/widgets/CustomScroller'

import BodyEditor from './BodyEditor'
import Footer from './Footer'

import useLogic from '../useLogic'
import useSalon from '../styles/editor/update_editor'

type TProps = {
  body: string
  submitState: TSubmitState
  id: string | null
}

const UpdateEditor: FC<TProps> = ({ id, body, submitState }) => {
  const s = useSalon()
  const { commentOnChange, updateComment, closeUpdateEditor } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>修改评论</div>
      <CustomScroller direction="vertical" height="320px" showShadow={false} autoHide={false}>
        <div className={s.editorWrapper}>
          {id ? (
            <BodyEditor body={body} onChange={(v) => commentOnChange(v)} />
          ) : (
            <LavaLampLoading top={10} left={30} />
          )}
        </div>
      </CustomScroller>

      <div className={s.footer}>
        <Footer
          label="更 新"
          submitState={submitState}
          body={body}
          onPublish={updateComment}
          onCancel={closeUpdateEditor}
        />
      </div>
    </div>
  )
}

export default memo(UpdateEditor)
