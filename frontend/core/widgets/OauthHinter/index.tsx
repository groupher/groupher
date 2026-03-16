/*
 *
 * OauthHinter
 *
 */

import LinkSVG from '~/icons/Link'
import GithubSVG from '~/icons/GithubCat'
import Linker from '~/widgets/Linker'

import useSalon from './salon'

export default function OauthHinter() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>
        <div className={s.icons}>
          <LinkSVG className={s.linkIcon} />
          <GithubSVG className={s.githubIcon} />
        </div>
        <div className={s.text}>
          <div className={s.hintTitle}>绑定成功，请稍等</div>
          <div className={s.hintDesc}>如果长时间未响应，请关闭页面重新尝试</div>
        </div>
      </div>
      <div className={s.footer}>
        please <Linker src="/feedback" external={false} text="feedback" inline left={4} right={4} />
        if you think sth goes wrong.
      </div>
    </div>
  )
}
