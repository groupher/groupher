import { useCoverMotionTarget } from '../../../stores/coverMotion/context'
import { useCoverScene } from '../../../stores/coverScene/context'
import useSalon from '../salon/covers_preview/main_cover'

export default function MainCover() {
  const s = useSalon()
  const { scene } = useCoverScene()
  const registerCover = useCoverMotionTarget()

  return (
    <div ref={registerCover} className={`${s.wrapper} cover-scene-device`}>
      <div className={`${s.content} cover-scene-content`}>
        <div className='cover-scene-stage'>
          <img
            src='/landing/intro/home.webp'
            alt='Groupher community forum preview'
            className='cover-scene-product-image theme-light-branch'
            loading='eager'
          />
          <img
            src='/landing/intro/home-dark.webp'
            alt='Groupher community forum preview in dark theme'
            className='cover-scene-product-image theme-dark-branch'
            loading='eager'
          />
        </div>
      </div>

      <div
        aria-hidden='true'
        className={s.background}
        style={{
          backgroundImage: `url("${scene.wallpaperImage}")`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
    </div>
  )
}
