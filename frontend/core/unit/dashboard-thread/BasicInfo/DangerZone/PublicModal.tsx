import { type FC, useState } from 'react'

import VIEW from '~/const/view'
import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import Modal from '~/widgets/Modal'
import NoticeBar from '~/widgets/NoticeBar'
import Tabs from '~/widgets/Switcher/Tabs'
import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/danger_zone/modal'
// import from '~/widgets/Alert'
import List from './List'

type TProps = {
  show: boolean
  onClose: () => void
}

const PublicModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { toggleVisiable } = useBaseInfo()

  const [visible, setVisible] = useState('public')
  const defaultPrivateNote = t('dsb.base_info.danger.visibility.modal.private_note')
  const [privateNote, setPrivateNote] = useState(defaultPrivateNote)

  const visibleOptions = [
    {
      title: t('dsb.base_info.danger.visibility.modal.option.public'),
      slug: 'public',
    },
    {
      title: t('dsb.base_info.danger.visibility.modal.option.private'),
      slug: 'private',
    },
  ]

  return (
    <Modal show={show} width='390px' offsetLeft='40%' onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>{t('dsb.base_info.danger.visibility.modal.title')}</h3>
        <div className={s.body}>
          <NoticeBar type='notice' content={t('dsb.base_info.danger.visibility.modal.notice')} />

          <List
            items={[
              t('dsb.base_info.danger.visibility.modal.item.invisible'),
              t('dsb.base_info.danger.visibility.modal.item.admins'),
              t('dsb.base_info.danger.visibility.modal.item.console'),
            ]}
            left={6}
            top={5}
          />
        </div>
        <div className={s.footer}>
          <Tabs
            items={visibleOptions}
            activeKey={visible}
            onChange={(value) => setVisible(value)}
            view={VIEW.DRAWER}
          />
          <div className='mt-5' />
          <div className={s.desc}>{t('dsb.base_info.danger.visibility.modal.external_note')}</div>
          <div className='mt-2' />
          <Input
            className={s.textarea}
            value={privateNote}
            placeholder={defaultPrivateNote}
            behavior='textarea'
            onChange={(e) => setPrivateNote(e.target.value)}
          />
          <div className='mt-4' />
          <Button onClick={() => toggleVisiable()}>
            {t('dsb.base_info.danger.visibility.modal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PublicModal
