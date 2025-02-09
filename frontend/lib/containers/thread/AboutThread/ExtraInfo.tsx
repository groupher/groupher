import { isEmpty } from 'ramda'

import useAboutInfo from '~/hooks/useAboutInfo'
import SocialList from '~/widgets/SocialList'

import LabelList from './LabelList'
import MediaReports from './MediaReports'

import useSalon, { cn } from './salon/extra_info'

export default () => {
  const s = useSalon()
  const { cities, techstacks, socialLinks, mediaReports } = useAboutInfo()

  const noMediaReports = mediaReports.length <= 1 && !mediaReports[0].title

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={cn(s.block, isEmpty(cities) && 'hidden')}>
        <h4 className={s.title}>所在地</h4>
        <LabelList items={cities} left={-2} />
      </div>

      <div className={s.block}>
        <h3 className={s.title}>技术栈</h3>
        <LabelList items={techstacks} left={-2} />
      </div>
      <div className={s.divider} />
      <div className={cn(s.block, isEmpty(socialLinks) && 'hidden')}>
        <h4 className={s.title}>关注我们</h4>
        <SocialList size="small" selected={socialLinks} left={-10} top={12} />
      </div>

      <div className={cn(s.block, noMediaReports && 'hidden')}>
        <div className={s.title}>媒体报道</div>
        <MediaReports items={mediaReports} />
      </div>
      <div className={s.divider} />
    </div>
  )
}
