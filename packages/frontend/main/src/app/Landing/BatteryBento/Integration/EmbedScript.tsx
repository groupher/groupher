import TerminalSVG from '~/icons/Terminal'

import useSalon from '../../salon/battery_bento/integration/embed_script'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <TerminalSVG className={s.icon} />

      <div className={s.codes}>
        script: groupher/<span className={s.embed}>embed</span>?id=
        <span className={s.redText}>your-site</span>
      </div>

      <div className={s.cursor} />
    </div>
  )
}
