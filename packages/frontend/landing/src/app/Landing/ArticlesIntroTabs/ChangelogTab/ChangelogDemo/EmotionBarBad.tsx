import Img from '~/Img'

import useSalon from '../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/emotion_bar_bad'

const EMOTION_STATIC = '/icons/static/emotion'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/downvote.png`} className={s.emoji} />
        <div className={s.count}>14</div>
      </div>

      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/confused.png`} className={s.emoji} />
        <div className={s.count}>12</div>
      </div>

      <div className={s.item}>
        <Img src={`${EMOTION_STATIC}/pill.png`} className={s.emoji} />
        <div className={s.count}>35</div>
      </div>
    </div>
  )
}
