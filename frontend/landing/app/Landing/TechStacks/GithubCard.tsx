import GithubSVG from '~/icons/social/Github'
import useSalon from '../salon/tech_stacks/github_card'
import RepoPreview from './RepoPreview'
import Teams from './Teams'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper} style={s.backgroundStyle}>
      <GithubSVG className={s.githubIcon} />

      <div className={s.topping}>
        <div className={s.githubTitle} style={s.gradientTextStyle}>
          OpenSource
        </div>
      </div>
      <RepoPreview name='groupher_web' desc='groupher.com 前端代码，基于 next.js/tailwind 构建' />

      <Teams />
    </div>
  )
}
