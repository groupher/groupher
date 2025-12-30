import useSalon from '../salon/cover_image'
import DesktopDevice from './DesktopDevice'

export default () => {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <DesktopDevice />
    </section>
  )
}
