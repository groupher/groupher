import { isEmpty } from 'ramda'

import useAboutInfo from '~/hooks/useAboutInfo'
import SocialList from '~/unit/SocialList'
import Linker from '~/widgets/Linker'

import LabelList from './LabelList'
import MediaReports from './MediaReports'

import useSalon, { cn } from './salon/sidebar'

export default function Sidebar() {
  const s = useSalon()
  const { homepage, cities, techstacks, socialLinks, mediaReports } = useAboutInfo()

  const noMediaReports = !mediaReports.some((report) => report?.title)

  return (
    <div className={s.wrapper}>
      <div className={cn(s.block, isEmpty(homepage) && 'hidden')}>
        <h3 className={s.title}>官方主页</h3>
        <div className={s.desc}>
          <Linker src={homepage} left={-2} />
        </div>
      </div>
      <div className={cn(s.block, isEmpty(socialLinks) && 'hidden')}>
        <h3 className={s.title}>关注我们</h3>
        <SocialList size='small' selected={socialLinks} left={-10} top={12} />
      </div>
      <div className={s.divider} />
      <div className={cn(s.block, isEmpty(cities) && 'hidden')}>
        <h3 className={s.title}>所在地</h3>
        <div className={s.desc}>
          <LabelList items={cities} left={-2} />
        </div>
      </div>
      <div className={cn(s.block, isEmpty(techstacks) && 'hidden')}>
        <h3 className={s.title}>技术栈</h3>
        <div className={s.desc}>
          <LabelList items={techstacks} left={-2} />
        </div>
      </div>

      {!noMediaReports && <div className={s.divider} />}
      <div className={cn(s.block, noMediaReports && 'hidden')}>
        <h3 className={s.title}>媒体报道</h3>
        <MediaReports items={mediaReports} />
      </div>
    </div>
  )
}
