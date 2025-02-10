import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" strokeWidth={0.003} {...props}>
      <path d="M240.59 128a15.848 15.848 0 0 1-10.531 15.037l-63.816 23.206-23.206 63.816a16.001 16.001 0 0 1-30.074 0l-23.206-63.816-63.816-23.206a16.001 16.001 0 0 1 0-30.074l63.816-23.206 23.206-63.816a16.001 16.001 0 0 1 30.074 0l23.206 63.816 63.816 23.206A15.848 15.848 0 0 1 240.589 128Z" />
    </svg>
  )
}

export default memo(SVG)
