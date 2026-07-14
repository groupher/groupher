import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Modal from '~/widgets/Modal'

import useSalon from './salon'
import type { TTrashedPost } from './spec'

type TProps = {
  item: TTrashedPost | null
  loading: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<boolean>
}

const ConfirmPermanentDeleteModal: FC<TProps> = ({ item, loading, onClose, onConfirm }) => {
  const s = useSalon()
  const { t } = useTrans()

  const confirm = async (): Promise<void> => {
    if (!item) return
    const deleted = await onConfirm(item.id)
    if (deleted) onClose()
  }

  const mentionWarning = t('dsb.cms.trash.confirm_mentions').replace(
    '{count}',
    String(item?.mentionedByCount ?? 0),
  )

  return (
    <Modal
      show={item !== null}
      width='410px'
      compact
      showCloseBtn
      offsetTop='28%'
      onClose={onClose}
    >
      <div className={s.modalBody}>
        <h3 className={s.modalTitle}>{t('dsb.cms.trash.confirm_title')}</h3>
        <div className={s.modalArticleTitle}>{item?.article?.title || item?.articleRef}</div>
        <p className={s.modalDesc}>{t('dsb.cms.trash.confirm_desc')}</p>
        {(item?.mentionedByCount ?? 0) > 0 ? (
          <p className={s.mentionWarning}>{mentionWarning}</p>
        ) : null}
        <div className={s.modalActions}>
          <Button ghost noBorder className={s.modalButton} disabled={loading} onClick={onClose}>
            {t('dsb.cms.trash.cancel')}
          </Button>
          <Button red className={s.modalButton} loading={loading} onClick={() => void confirm()}>
            {t('dsb.cms.trash.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmPermanentDeleteModal
