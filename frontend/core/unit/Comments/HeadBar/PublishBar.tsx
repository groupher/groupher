import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import EditPublishSVG from '~/icons/EditPublish'
import Img from '~/Img'
import { mockUsers } from '~/mock'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../salon/head_bar/publish_bar'

type TProps = {
  closeEditor: () => void
}

const PublishBar: FC<TProps> = ({ closeEditor }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.account}>
        <Img src={mockUsers(3)[0].avatar} className={s.avatar} />
        <div className={s.username}>mydearxym</div>
      </div>
      <div className={s.actions}>
        <Button size='small' space={3} ghost noBorder onClick={() => closeEditor()}>
          {t('comment.publish.cancel')}
        </Button>
        <Button size='small' space={3}>
          <EditPublishSVG className={s.pubIcon} />
          {t('comment.publish.publish')}
        </Button>
      </div>
    </div>
  )
}

export default PublishBar
