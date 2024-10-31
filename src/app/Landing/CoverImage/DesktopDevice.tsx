import { useEffect, useState } from 'react'
import Typewriter from 'typewriter-effect'

import Img from '~/Img'

// import Image from 'next/image'
import { fmt2CompStyle } from '~/fmt'

import LockSVG from '~/icons/Lock'

import useTheme from '~/hooks/useTheme'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon from '../salon/cover_image/desktop_device'

export default () => {
  const [imgSrc, setImgSrc] = useState('/landing/intro/home.webp')
  const s = useSalon()

  const { isLightTheme } = useTheme()
  const { background, effect } = useWallpaper()

  useEffect(() => {
    setImgSrc(isLightTheme ? '/landing/intro/home.webp' : '/landing/intro/home-dark.webp')
  }, [isLightTheme])

  return (
    <div className={s.wrapper}>
      <div className={s.brower}>
        <div className={s.dot} />
        <div className={s.dot} />
        <div className={s.dot} />
        <div className="grow" />
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
        <div className="grow" />
      </div>
      <div className={s.content}>
        <div className={s.imageBox}>
          <Img src={imgSrc} className={s.coverImg} alt="home page cover" />
        </div>
        {/* <div className={s.imageBox}>
          <Image
            src={imageSrc}
            width={900}
            height={760}
            alt="cover page"
            className="z-10 object-cover"
          />
        </div> */}
      </div>
      <div className={s.background} style={{ background, ...fmt2CompStyle(effect) }} />
    </div>
  )
}
