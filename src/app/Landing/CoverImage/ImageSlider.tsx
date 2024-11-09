import { useEffect, useState, useRef } from 'react'

import {
  ButtonBack,
  ButtonNext,
  Carousel,
  Slide,
  Slider,
  SliderBarDotGroup,
} from 'react-scroll-snap-anime-slider'
import { range } from 'ramda'

import Img from '~/Img'

// import Image from 'next/image'
import ArrowSVG from '~/icons/ArrowSimple'

import useLoaded from '~/hooks/useLoaded'
import useTheme from '~/hooks/useTheme'

import Scrollbar from './Scrollbar'
import ScrollbarDark from './ScrollbarDark'
import useSalon from '../salon/cover_image/image_slider'

export const MAX_INTRO_IMAGES_COUNT = 5

// see: https://karanokara.github.io/react-scroll-snap-anime-slider/docs/component-api/carousel
const visible = 1
const step = 3

export default () => {
  const { loaded } = useLoaded()
  const sliderRef = useRef<Slider>(null)

  const [curImageIndex, setCurImageIndex] = useState(0)

  const [imgSrc, setImgSrc] = useState('/landing/intro/home.webp')
  const [imgSrc2, _] = useState('/landing/intro/home-dark.webp')
  const s = useSalon()

  const { isLightTheme } = useTheme()

  useEffect(() => {
    setImgSrc(isLightTheme ? '/landing/intro/home.webp' : '/landing/intro/home-dark.webp')
  }, [isLightTheme])

  return (
    <div className={s.slideBox}>
      {loaded && (
        <Carousel
          totalSlides={MAX_INTRO_IMAGES_COUNT}
          visibleSlides={visible}
          step={step}
          slideMargin="20px"
        >
          <Slider ref={sliderRef}>
            {range(0, MAX_INTRO_IMAGES_COUNT).map((_, i) => (
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

          {/* tmp solution due to the react version conflict, can't use hooks inside it */}
          {isLightTheme ? (
            <SliderBarDotGroup renderDots={Scrollbar} />
          ) : (
            <SliderBarDotGroup renderDots={ScrollbarDark} />
          )}
        </Carousel>
      )}
    </div>
  )
}
