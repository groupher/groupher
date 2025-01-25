import Img from '~/Img'
import { mockUsers } from '~/mock'

import useSalon, {} from '../../../salon/articles_intro_tabs/help_tab/help_demo/inline_comment'

export default () => {
  const s = useSalon()

  const user = mockUsers(1)

  return (
    <div className={s.wrapper}>
      <div className={s.user}>
        <Img className={s.avatar} src={user[0].avatar} />
        <div className={s.nickname}>{user[0].nickname}</div>
      </div>
      <div>可以在行内评论里支持富文本内容吗？</div>
    </div>
  )
}
