import type { FC } from 'react'
import Button from '~/widgets/Buttons/Button'
import Modal from '~/widgets/Modal'
import NoticeBar from '~/widgets/NoticeBar'
import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/danger_zone/modal'
// import from '~/widgets/Alert'
import List from './List'

type TProps = {
  show: boolean
  onClose: () => void
}

const ArchiveModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { archiveCommunity } = useBaseInfo()

  return (
    <Modal show={show} width='390px' offsetLeft='40%' onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>社区归档</h3>
        <div className={s.body}>
          <NoticeBar type='notice' content='归档后社区将变为只读，可再次切换。' />

          <List
            items={[
              '无法发布帖子，更新日志以及文档等',
              '无法评论，点增等互动操作',
              '相关的操作队列将停止运行',
            ]}
            left={6}
            top={5}
          />
        </div>
        <div className={s.footer}>
          <div className='grow' />
          <Button space={10} right={10} bottom={8} onClick={() => archiveCommunity()}>
            已了解，确定归档
          </Button>
          <div className='grow' />
        </div>
      </div>
    </Modal>
  )
}

export default ArchiveModal
