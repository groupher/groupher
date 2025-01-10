import { type FC, memo } from 'react'

import type { TSubmitState, TComment } from '~/spec'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import CustomScroller from '~/widgets/CustomScroller'

import BodyEditor from './BodyEditor'
import Footer from './Footer'

import useLogic from '../useLogic'
import useSalon from '../salon/editor/reply_editor'

type TProps = {
  body: string
  submitState: TSubmitState
  replyTo: TComment | null
}

const ReplyEditor: FC<TProps> = ({ body, submitState, replyTo }) => {
  const s = useSalon()
  const { commentOnChange, replyComment, closeReplyEditor } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.replyToHint}>
          回复 <div className={s.replyToAuthor}>{replyTo?.author?.nickname}</div>
        </div>
        <div
          className={s.replyToContent}
          dangerouslySetInnerHTML={{
            __html: replyTo?.bodyHtml,
          }}
        />
      </div>
      <CustomScroller direction="vertical" height="320px" showShadow={false} autoHide={false}>
        <div className={s.editorWrapper}>
          {replyTo.id ? (
            <BodyEditor
              body={body}
              placeholder="// 回复内容（'Tab' 键快速插入）"
              onChange={(v) => commentOnChange(v)}
            />
          ) : (
            <LavaLampLoading top={10} left={30} />
          )}
        </div>
      </CustomScroller>

      <div className={s.footer}>
        <Footer
          label="回 复"
          submitState={submitState}
          body={body}
          onPublish={replyComment}
          onCancel={closeReplyEditor}
        />
      </div>
    </div>
  )
}

export default memo(ReplyEditor)
