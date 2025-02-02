import { type FC, useState } from 'react'

import VIEW from '~/const/view'

import Input from '~/widgets/Input'
import Modal from '~/widgets/Modal'
import Tabs from '~/widgets/Switcher/Tabs'
import Button from '~/widgets/Buttons/Button'
import NoticeBar from '~/widgets/NoticeBar'

// import from '~/widgets/Alert'
import List from './List'

import useBaseInfo from '../../logic/useBaseInfo'

import useSalon from '../../salon/basic_info/danger_zone/modal'

type TProps = {
  show: boolean
  onClose: () => void
}

export const VISIBLE_OPTIONS = [
  {
    title: '公开（默认）',
    slug: 'public',
  },
  {
    title: '隐藏',
    slug: 'private',
  },
]

const defaultPrivateNote = '当前社区为私有状态，只对管理员开放。'

const PublicModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()

  const { toggleVisiable } = useBaseInfo()

  const [visible, setVisible] = useState('public')
  const [privateNote, setPrivateNote] = useState(defaultPrivateNote)

  return (
    <Modal show={show} width="390px" offsetLeft="40%" onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>社区可见性</h3>
        <div className={s.body}>
          <NoticeBar type="notice" content="隐藏后所有内容只对管理员可见，当前为公开。" />

          <List
            items={[
              '所有帖子，看板，更新日志等等将不可见',
              '社区创建者以及管理员不受影响',
              '后台操作不受影响',
            ]}
            left={6}
            top={5}
          />
        </div>
        <div className={s.footer}>
          <Tabs
            items={VISIBLE_OPTIONS}
            activeKey={visible}
            onChange={(value) => setVisible(value)}
            view={VIEW.DRAWER}
          />
          <div className="mt-5" />
          <div className={s.desc}>对外提示信息（支持 Markdown）</div>
          <div className="mt-2" />
          <Input
            className={s.textarea}
            value={privateNote}
            placeholder={defaultPrivateNote}
            behavior="textarea"
            onChange={(e) => setPrivateNote(e.target.value)}
          />
          <div className="mt-4" />
          <Button type="primary" onClick={() => toggleVisiable()}>
            确定变更
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PublicModal
