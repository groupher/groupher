import useSalon from '../salon/cover_image'
import DesktopDevice from './DesktopDevice'

export default function CoverImage() {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <DesktopDevice />
    </section>
  )
}
