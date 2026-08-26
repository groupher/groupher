import Img from '~/Img'

import useSalon from '../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/emotion_bar'

const EMOTION_STATIC = 'icons/emotion'

export default function EmotionBar() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/tada.png`} className={s.emoji} />
        <div className={s.count}>41</div>
      </div>

      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/beer.png`} className={s.emoji} />
        <div className={s.count}>32</div>
      </div>

      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/biceps.png`} className={s.emoji} />
        <div className={s.count}>17</div>
      </div>

      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/popcorn.png`} className={s.emoji} />
        <div className={s.count}>10</div>
      </div>
    </div>
  )
}
