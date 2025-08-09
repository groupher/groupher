import { range } from 'ramda'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Carousel, Slide, Slider, SliderBarDotGroup } from 'react-scroll-snap-anime-slider'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import useInterval from '~/hooks/useInterval'
import useLoaded from '~/hooks/useLoaded'
import useTheme from '~/hooks/useTheme'
import Img from '~/Img'
import ArrowSVG from '~/icons/ArrowSimple'
import ThemeRulerSVG from '~/icons/ThemeRuler'
import useSalon from '../salon/cover_image/image_slider'
import Scrollbar from './Scrollbar'
import ScrollbarDark from './ScrollbarDark'

export const MAX_INTRO_IMAGES_COUNT = 5
export const MAX_THEMES_COUNT = 5

// see: https://karanokara.github.io/react-scroll-snap-anime-slider/docs/component-api/carousel
const VISIBLE_SLIDES = 1
const SLIDE_STEP = 3
const LOOP_TIMMER = 5000

export default () => {
  const { loaded } = useLoaded()
  const { changeWallpaper, changePatternWallpaper } = useFullWallpaper()
  const [loopTimer, toggleLoop] = useState(true)

  const sliderRef = useRef<Slider>(null)

  const [curImageIndex, setCurImageIndex] = useState(0)
  const [themeIndex, setThemeIndex] = useState(0)

  const [imgSrc, setImgSrc] = useState('/landing/intro/home.webp')
  const [imgSrc2, _] = useState('/landing/intro/home-dark.webp')
  const s = useSalon()

  const { isLightTheme } = useTheme()

  const localCurrentSlide = useMemo(() => {
    return {
      index: 0,
    }
  }, [])

  useInterval(
    () => {
      const slider = sliderRef.current
      if (slider) {
        const maxSlideIndex = MAX_INTRO_IMAGES_COUNT - VISIBLE_SLIDES
        let nextSlideIndex = localCurrentSlide.index + 1
        nextSlideIndex = nextSlideIndex > maxSlideIndex ? 0 : nextSlideIndex
        slider.slideTo(nextSlideIndex)
      }
    },
    loopTimer ? LOOP_TIMMER : null,
  )

  useEffect(() => {
    setImgSrc(isLightTheme ? '/landing/intro/home.webp' : '/landing/intro/home-dark.webp')
  }, [isLightTheme])

  useEffect(() => {
    switch (themeIndex) {
      case 1: {
        changePatternWallpaper('newspaper')
        break
      }

      case 2: {
        changePatternWallpaper('cartoon')
        break
      }

      case 3: {
        changePatternWallpaper('idian')
        break
      }

      case 4: {
        changePatternWallpaper('country1')
        break
      }

      case 5: {
        changePatternWallpaper('mac')
        break
      }

      default: {
        changeWallpaper('pink')
        return
      }
    }
  }, [themeIndex])

  return (
    <button className={s.slideBox} onClick={() => toggleLoop(false)}>
      {loaded && (
        <Carousel
          totalSlides={MAX_INTRO_IMAGES_COUNT}
          visibleSlides={VISIBLE_SLIDES}
          step={SLIDE_STEP}
          slideMargin='20px'
          onSlide={({ currentSlide }) => {
            localCurrentSlide.index = currentSlide
          }}
        >
          <Slider ref={sliderRef}>
            {range(0, MAX_INTRO_IMAGES_COUNT).map((_, i) => (
              <Slide key={i}>
                <div className={s.slideImage}>
                  {i !== 1 && <Img src={imgSrc} alt='cover page' className={s.coverImg} />}
                  {i === 1 && <Img src={imgSrc2} alt='cover page' className={s.coverImg} />}
                  {/* <Img src={imgSrc} alt="cover page" className={s.coverImg} /> */}
                </div>
              </Slide>
            ))}
          </Slider>

          <button
            className={s.leftNavi}
            onClick={() => {
              let targetSlideIndex = 0

              if (curImageIndex === 0) {
                targetSlideIndex = MAX_INTRO_IMAGES_COUNT - 1
              } else {
                targetSlideIndex =
                  curImageIndex <= 0 ? MAX_INTRO_IMAGES_COUNT - 1 : curImageIndex - 1
              }

              sliderRef.current.slideTo(targetSlideIndex)
              setCurImageIndex(targetSlideIndex)
            }}
          >
            <ArrowSVG className={s.leftArrow} />
          </button>

          <button
            className={s.rightNavi}
            onClick={() => {
              let targetSlideIndex = 0

              if (curImageIndex === MAX_INTRO_IMAGES_COUNT - 1) {
                targetSlideIndex = 0
              } else {
                targetSlideIndex =
                  curImageIndex >= MAX_INTRO_IMAGES_COUNT - 1 ? 0 : curImageIndex + 1
              }

              sliderRef.current.slideTo(targetSlideIndex)
              setCurImageIndex(targetSlideIndex)
            }}
          >
            <ArrowSVG className={s.rightArrow} />
          </button>

          {/* tmp solution due to the react version conflict, can't use hooks inside it */}
          {isLightTheme ? (
            <SliderBarDotGroup renderDots={Scrollbar} />
          ) : (
            <SliderBarDotGroup renderDots={ScrollbarDark} />
          )}
        </Carousel>
      )}
      {loaded && (
        <button
          className={s.themeSwitch}
          onClick={() => {
            if (themeIndex >= MAX_THEMES_COUNT) {
              setThemeIndex(0)
              return
            }
            setThemeIndex(themeIndex + 1)
          }}
        >
          <ThemeRulerSVG className={s.themeIcon} />
        </button>
      )}
    </button>
  )
}
