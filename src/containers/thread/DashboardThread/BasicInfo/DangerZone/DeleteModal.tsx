import type { FC } from 'react'

import Modal from '~/widgets/Modal'

import NoticeBar from '~/widgets/NoticeBar'

// import from '~/widgets/Alert'
import List from './List'
import ConfirmFooter from './ConfirmFooter'

import useSalon from '../../salon/basic_info/danger_zone/modal'

type TProps = {
  show: boolean
  onClose: () => void
}

const DeleteModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()

  return (
    <Modal show={show} width="390px" offsetLeft="40%" onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>删除社区</h3>
        <div className={s.body}>
          <NoticeBar type="notice" content="以下内容将被永久删除, 无法恢复, 请谨慎操作。" />

          <List
            items={[
              '社区信息，个性化设置等',
              '帖子，看板以及更新日志等内容',
              '所有评论以及点赞，表情等信息',
            ]}
            left={6}
            top={5}
          />
        </div>
        <ConfirmFooter bottom={6} />
      </div>
    </Modal>
  )
}

export default DeleteModal
