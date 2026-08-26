import useTrans from '~/hooks/useTrans'
import GithubSVG from '~/icons/Github8'
import GroupSVG from '~/icons/Group'
import EmailSVG from '~/icons/social/Email'
import WeChatSVG from '~/icons/social/WeChat'

import useSalon from '../salon/join_our_community/cards'

export default function Cards() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <WeChatSVG className={s.icon} />
        </div>

        <div className={s.title}>{t('landing.join.card.wechat')}</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <GithubSVG className={s.icon} />
        </div>

        <div className={s.title}>{t('landing.join.card.github')}</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <GroupSVG className={s.icon} />
        </div>

        <div className={s.title}>{t('landing.join.card.forum')}</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <EmailSVG className={s.icon} />
        </div>

        <div className={s.title}>{t('landing.join.card.email')}</div>
      </div>
    </div>
  )
}
