import Typewriter from 'typewriter-effect'

import { fmt2CompStyle } from '~/fmt'
import useWallpaper from '~/hooks/useWallpaper'
import LockSVG from '~/icons/Lock'

import useSalon from '../salon/cover_image/desktop_device'
import ImageSlider from './ImageSlider'

export default function DesktopDevice() {
  const s = useSalon()
  const { background, effect } = useWallpaper()

  return (
    <div className={s.wrapper}>
      <div className={s.brower}>
        <div className={s.dot} />
        <div className={s.dot} />
        <div className={s.dot} />
        <div className='grow' />
        <div className={s.addrBar}>
          <LockSVG className={s.lock} />
          <div className={s.addtext}>https://</div>
          <div className={s.brand}>your-brand</div>
          <div className={s.addtext}>.groupher.com/</div>
          <div className={s.threadText} style={s.threadTextStyle}>
            <Typewriter
              options={{
                strings: ['posts', 'kanban', 'changelog', 'help', 'roadmap', 'docs'],
                autoStart: true,
                loop: true,
              }}
            />
          </div>
        </div>
        <div className='grow' />
      </div>
      <div className={s.content}>
        <ImageSlider />
      </div>

      <div className={s.background} style={{ background, ...fmt2CompStyle(effect) }} />
    </div>
  )
}
