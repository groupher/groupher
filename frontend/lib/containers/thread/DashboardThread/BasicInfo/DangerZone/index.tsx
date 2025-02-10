import { type FC, useState } from 'react'

import InfoSVG from '~/icons/Info'
import Button from '~/widgets/Buttons/Button'

import PublicModal from './PublicModal'
import ArchiveModal from './ArchiveModal'
import DeleteModal from './DeleteModal'

import useSalon, { cn } from '../../salon/basic_info/danger_zone'

const ActionButton = ({ children, onClick }) => {
  return (
    <Button type="red" ghost size="small" width="w-20" className="-mt-0.5" onClick={onClick}>
      {children}
    </Button>
  )
}

const DangerZone: FC = () => {
  const s = useSalon()

  const [showPublicModal, setPublicModal] = useState(false)
  const [showArchiveModal, setArchiveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <div className={s.wrapper}>
      <h3 className={s.dangerTitle}>危险操作</h3>

      <div className={cn(s.item, 'border-b-0 border-t-2 rounded-t-2xl')}>
        <h3 className={s.title}>
          社区可见性
          <InfoSVG className={s.icon} />
          <div className="grow" />
          <ActionButton onClick={() => setPublicModal(true)}>隐藏</ActionButton>
        </h3>
        <p className={s.desc}>当前社区为公开，任何人可以访问</p>
      </div>

      <div className={cn(s.item, 'border-b-0')}>
        <h3 className={s.title}>
          社区归档
          <InfoSVG className={s.icon} />
          <div className="grow" />
          <ActionButton onClick={() => setArchiveModal(true)}>归档</ActionButton>
        </h3>
        <p className={s.desc}>归档后社区将变为只读</p>
      </div>

      <div className={cn(s.item, 'border-b-0 rounded-b-2xl')}>
        <h3 className={s.title}>
          删除社区
          <InfoSVG className={s.icon} />
          <div className="grow" />
          <ActionButton onClick={() => setShowDeleteModal(true)}>删除</ActionButton>
        </h3>
        <p className={s.desc}>关联删除所有帖子评论等，删除后无法恢复。</p>
      </div>
      <PublicModal show={showPublicModal} onClose={() => setPublicModal(false)} />
      <ArchiveModal show={showArchiveModal} onClose={() => setArchiveModal(false)} />
      <DeleteModal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  )
}

export default DangerZone
