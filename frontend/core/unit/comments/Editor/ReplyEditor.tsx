import { type FC, memo } from 'react'
import useTrans from '~/hooks/useTrans'
import type { TComment, TSubmitState } from '~/spec'
import CustomScroller from '~/widgets/CustomScroller'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useSalon from '../salon/editor/reply_editor'
import useActions from '../useLogic/useActions'
import BodyEditor from './BodyEditor'
import Footer from './Footer'

type TProps = {
  body: string
  submitState: TSubmitState
  replyTo: TComment | null
}

const ReplyEditor: FC<TProps> = ({ body, submitState, replyTo }) => {
  const s = useSalon()
  const { commentOnChange, replyComment, closeReplyEditor } = useActions()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.replyToHint}>
          {t('comment.reply.to')} <div className={s.replyToAuthor}>{replyTo?.author?.nickname}</div>
        </div>
        <div
          className={s.replyToContent}
          dangerouslySetInnerHTML={{
            __html: replyTo?.bodyHtml,
          }}
        />
      </div>
      <CustomScroller direction='vertical' height='320px' showShadow={false} autoHide={false}>
        <div className={s.editorWrapper}>
          {replyTo.id ? (
            <BodyEditor
              body={body}
              placeholder={t('comment.reply.placeholder')}
              onChange={(v) => commentOnChange(v)}
            />
          ) : (
            <LavaLampLoading top={10} left={30} />
          )}
        </div>
      </CustomScroller>

      <div className={s.footer}>
        <Footer
          label={t('comment.submit.reply')}
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
