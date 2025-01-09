import type { FC } from 'react'

import { mockUsers } from '~/mock'
import Img from '~/Img'

import EditPublishSVG from '~/icons/EditPublish'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../styles/head_bar/publish_bar'

type TProps = {
  closeEditor: () => void
}

const PublishBar: FC<TProps> = ({ closeEditor }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.account}>
        <Img src={mockUsers(3)[0].avatar} className={s.avatar} />
        <div className={s.username}>mydearxym</div>
      </div>
      <div className={s.actions}>
        <Button size="small" space={3} ghost noBorder onClick={() => closeEditor()}>
          取消
        </Button>
        <Button size="small" space={3}>
          <EditPublishSVG className={s.pubIcon} />
          发布
        </Button>
      </div>
    </div>
  )
}

export default PublishBar
