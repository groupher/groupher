import DesktopDevice from './DesktopDevice'

import useSalon from '../salon/cover_image'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DesktopDevice />
    </div>
  )
}
