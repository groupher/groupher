import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" {...props}>
      <path
        d="M340.359 14.35c13.303 10.463 59.79 8.221 79.82 62.78 20.03 54.56 20.18 212.855 40.36 264.574 20.178 51.719 67.264 38.117 80.717 45.74"
        fill="none"
        strokeWidth={6}
        stroke='url("#cl-2")'
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="cl-2">
          <stop stopColor="#FCEBD9" offset={0} />
          <stop stopColor="#eea123" offset={1} />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default memo(SVG)
