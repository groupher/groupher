import CommentSVG from '~/icons/Comment'
import HeartSVG from '~/icons/Heart'
import RetweetSVG from '~/icons/Retweet'
import ViewSVG from '~/icons/TwView'
import TwMarkSVG from '~/icons/BookMark'
import XSVG from '~/icons/X'

import useSalon, { cn } from '../../salon/dashboard_intros/seo_tab/twitter_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.cover}>
          <XSVG className={s.xLogo} />
        </div>
        <div className={s.content}>
          <div className={s.url}>https://motuojie.com</div>
          <div className={s.title}>Motojie - (摩界)</div>
          <div className={s.url}>发现复古摩托车的魅力。我们专..</div>
        </div>
      </div>
      <div className={s.footer}>
        <CommentSVG className={s.icon} />
        <div className={s.count}>12</div>
        <div className="mr-9" />
        <HeartSVG className={cn(s.icon, s.fillRed)} />
        <div className={s.count}>29</div>
        <div className="mr-9" />
        <RetweetSVG className={s.icon} />
        <div className={s.count}>8</div>
        <div className="mr-9" />
        <ViewSVG className={s.icon} />
        <div className={s.count}>248</div>
        <div className="mr-9" />
        <TwMarkSVG className={cn(s.icon, s.fillBlue)} />
      </div>
    </div>
  )
}
