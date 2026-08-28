import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/ui/Buttons/Button'
import Modal from '~/ui/Modal'

import type { TSideTreeTab } from '../../SideTree/spec'
import useSalon from './salon'

type TProps = {
  tab: TSideTreeTab | null
  onClose: () => void
  onConfirm: (tabId: string) => void
}

const DeleteTabModal: FC<TProps> = ({ tab, onClose, onConfirm }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Modal show={tab !== null} width='390px' compact showCloseBtn offsetTop='28%' onClose={onClose}>
      <div className={s.deleteBody}>
        <h3 className={s.deleteTitle}>{t('dsb.doc.tabs.delete_title')}</h3>
        <div className={s.deleteTabTitle}>{tab?.title}</div>
        <p className={s.deleteDesc}>{t('dsb.doc.tabs.delete_desc')}</p>
        <div className={s.deleteActions}>
          <Button ghost noBorder onClick={onClose}>
            {t('dsb.doc.tabs.cancel')}
          </Button>
          <Button
            red
            onClick={() => {
              if (!tab) return
              onConfirm(tab.id)
              onClose()
            }}
          >
            {t('dsb.doc.tabs.confirm_delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteTabModal
