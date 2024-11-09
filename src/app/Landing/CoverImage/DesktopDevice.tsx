import { useEffect, useState } from 'react'
import Typewriter from 'typewriter-effect'

import { ButtonBack, ButtonNext, Carousel, Slide, Slider } from 'react-scroll-snap-anime-slider'
import { range } from 'ramda'

import Img from '~/Img'

// import Image from 'next/image'
import { fmt2CompStyle } from '~/fmt'

import LockSVG from '~/icons/Lock'
import ArrowSVG from '~/icons/ArrowSimple'

import useLoaded from '~/hooks/useLoaded'
import useTheme from '~/hooks/useTheme'
import useWallpaper from '~/hooks/useWallpaper'

import Scrollbar from './Scrollbar'
import useSalon from '../salon/cover_image/desktop_device'

export const MAX_INTRO_IMAGES_COUNT = 5

const total = 10
const visible = 1
const step = 3

export default () => {
  const { loaded } = useLoaded()

  const [curImageIndex, setCurImageIndex] = useState(0)

  const [imgSrc, setImgSrc] = useState('/landing/intro/home.webp')
  const [imgSrc2, _] = useState('/landing/intro/home-dark.webp')
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
        <div className={s.slideBox}>
          {loaded && (
            <Carousel totalSlides={total} visibleSlides={visible} step={step} slideMargin="20px">
              <Slider>
                {range(0, total).map((_, i) => (
                  <Slide key={i}>
                    <div className={s.slideImage}>
                      {i !== 1 && <Img src={imgSrc} alt="cover page" className={s.coverImg} />}
                      {i === 1 && <Img src={imgSrc2} alt="cover page" className={s.coverImg} />}
                      {/* <Img src={imgSrc} alt="cover page" className={s.coverImg} /> */}
                    </div>
                  </Slide>
                ))}
              </Slider>

              <ButtonBack>
                <div
                  className={s.leftNavi}
                  onClick={() =>
                    setCurImageIndex(
                      curImageIndex <= 0 ? MAX_INTRO_IMAGES_COUNT - 1 : curImageIndex - 1,
                    )
                  }
                >
                  <ArrowSVG className={s.leftArrow} />
                </div>
              </ButtonBack>

              <ButtonNext>
                <div
                  className={s.rightNavi}
                  onClick={() =>
                    setCurImageIndex(
                      curImageIndex >= MAX_INTRO_IMAGES_COUNT - 1 ? 0 : curImageIndex + 1,
                    )
                  }
                >
                  <ArrowSVG className={s.rightArrow} />
                </div>
              </ButtonNext>
            </Carousel>
          )}
        </div>
        <Scrollbar imageIndex={curImageIndex} onChange={(index) => setCurImageIndex(index)} />
      </div>
      <div className={s.background} style={{ background, ...fmt2CompStyle(effect) }} />
    </div>
  )
}
