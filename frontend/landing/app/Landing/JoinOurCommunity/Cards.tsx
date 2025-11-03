import GithubSVG from '~/icons/Github8'
import GroupSVG from '~/icons/Group'
import EmailSVG from '~/icons/social/Email'
import WeChatSVG from '~/icons/social/WeChat'
import useSalon from '../salon/join_our_community/cards'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <WeChatSVG className={s.icon} />
        </div>

        <div className={s.title}>微信群</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <GithubSVG className={s.icon} />
        </div>

        <div className={s.title}>Github</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <GroupSVG className={s.icon} />
        </div>

        <div className={s.title}>论坛</div>
      </div>
      <div className={s.divider} />
      <div className={s.card}>
        <div className={s.iconBox}>
          <EmailSVG className={s.icon} />
        </div>

        <div className={s.title}>Email</div>
      </div>
    </div>
  )
}
