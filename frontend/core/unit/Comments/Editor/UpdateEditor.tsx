import { type FC, memo } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TSubmitState } from '~/spec'
import CustomScroller from '~/ui/CustomScroller'
import LavaLampLoading from '~/ui/Loading/LavaLampLoading'

import useActions from '../useLogic/useActions'
import BodyEditor from './BodyEditor'
import Footer from './Footer'
import useSalon from './salon/update_editor'

type TProps = {
  body: string
  submitState: TSubmitState
  innerId: string | null
}

const UpdateEditor: FC<TProps> = ({ innerId, body, submitState }) => {
  const s = useSalon()
  const { commentOnChange, updateComment, closeUpdateEditor } = useActions()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>{t('comment.update.title')}</div>
      <CustomScroller direction='vertical' height='320px' showShadow={false} autoHide={false}>
        <div className={s.editorWrapper}>
          {innerId ? (
            <BodyEditor body={body} onChange={(v) => commentOnChange(v)} />
          ) : (
            <LavaLampLoading top={10} left={30} />
          )}
        </div>
      </CustomScroller>

      <div className={s.footer}>
        <Footer
          label={t('comment.submit.update')}
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
