import GithubSVG from '~/icons/social/Github'
import useSalon from '../salon/tech_stacks/github_card'
import RepoPreview from './RepoPreview'
import Teams from './Teams'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <GithubSVG className={s.githubIcon} />

      <div className={s.topping}>
        <div className={s.githubTitle} style={s.gradientTextStyle}>
          OpenSource
        </div>
      </div>
      <RepoPreview name='groupher' desc='由久经考验的开源技术栈构建，持续跟进业界趋势。' />
      <RepoPreview name='groupher' desc='由久经考验的开源技术栈构建，持续跟进业界趋势。' />
      <Teams />
    </div>
  )
}
