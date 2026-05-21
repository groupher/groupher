import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import InfoSVG from '~/icons/Info'
import Button from '~/widgets/Buttons/Button'

import useSalon, { cn } from '../salon/danger_zone'
import ArchiveModal from './ArchiveModal'
import DeleteModal from './DeleteModal'
import PublicModal from './PublicModal'

const ActionButton = ({ children, onClick }) => {
  return (
    <Button red ghost size='small' width='w-auto' className='-mt-0.5' onClick={onClick}>
      {children}
    </Button>
  )
}

const DangerZone: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  const [showPublicModal, setPublicModal] = useState(false)
  const [showArchiveModal, setArchiveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <div className={s.wrapper}>
      <h3 className={s.dangerTitle}>{t('dsb.base_info.danger.title')}</h3>

      <div className={cn(s.item, 'border-b-0 border-t-2 rounded-t-2xl')}>
        <h3 className={s.title}>
          {t('dsb.base_info.danger.visibility.title')}
          <InfoSVG className={s.icon} />
          <div className='grow' />
          <ActionButton onClick={() => setPublicModal(true)}>
            {t('dsb.base_info.danger.visibility.action')}
          </ActionButton>
        </h3>
        <p className={s.desc}>{t('dsb.base_info.danger.visibility.desc')}</p>
      </div>

      <div className={cn(s.item, 'border-b-0')}>
        <h3 className={s.title}>
          {t('dsb.base_info.danger.archive.title')}
          <InfoSVG className={s.icon} />
          <div className='grow' />
          <ActionButton onClick={() => setArchiveModal(true)}>
            {t('dsb.base_info.danger.archive.action')}
          </ActionButton>
        </h3>
        <p className={s.desc}>{t('dsb.base_info.danger.archive.desc')}</p>
      </div>

      <div className={cn(s.item, 'border-b-0 rounded-b-2xl')}>
        <h3 className={s.title}>
          {t('dsb.base_info.danger.delete.title')}
          <InfoSVG className={s.icon} />
          <div className='grow' />
          <ActionButton onClick={() => setShowDeleteModal(true)}>
            {t('dsb.base_info.danger.delete.action')}
          </ActionButton>
        </h3>
        <p className={s.desc}>{t('dsb.base_info.danger.delete.desc')}</p>
      </div>
      <PublicModal show={showPublicModal} onClose={() => setPublicModal(false)} />
      <ArchiveModal show={showArchiveModal} onClose={() => setArchiveModal(false)} />
      <DeleteModal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  )
}

export default DangerZone
