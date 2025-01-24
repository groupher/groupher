import HashTagSVG from '~/icons/HashTagBold'

import useSalon from '../../salon/dashboard_intros/tags_tab/tag_barnner'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <HashTagSVG className={s.hashIcon} />
        <div className={s.title}>使用分享</div>
      </div>
      <div className={s.desc}>这里搜集各位亲们的日常使用分享、实用技巧以及攻略等，Have fun !</div>
    </div>
  )
}
