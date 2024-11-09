// import useLoaded from '~/hooks/useLoaded'

// import { ButtonBack, ButtonNext, Carousel, Slide, Slider } from 'react-scroll-snap-anime-slider'
// import { range } from 'ramda'

// import Img from '~/Img'

import DesktopDevice from './DesktopDevice'

import useSalon from '../salon/cover_image'

export default () => {
  const s = useSalon()
  // const { loaded } = useLoaded()

  // const total = 20
  // const visible = 1
  // const step = 3

  return (
    <div className={s.wrapper}>
      {/* <div className={s.test}>
        {loaded && (
          <Carousel totalSlides={total} visibleSlides={visible} step={step}>
            <Slider>
              {range(0, total).map((_, i) => {
                return (
                  <Slide key={i}>
                    {i === 0 && (
                      <Img src="/landing/intro/home.webp" alt="cover page" className={s.coverImg} />
                    )}
                    {i === 1 && (
                      <Img
                        src="/landing/intro/home-dark.webp"
                        alt="cover page"
                        className={s.coverImg}
                      />
                    )}
                    <Img src="/landing/intro/home.webp" alt="cover page" className={s.coverImg} />
                  </Slide>
                )
              })}
            </Slider>
          </Carousel>
        )}
      </div> */}

      <DesktopDevice />
    </div>
  )
}
