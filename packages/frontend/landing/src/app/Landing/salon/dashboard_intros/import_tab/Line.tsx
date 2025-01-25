import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" {...props}>
      <path
        fill="none"
        stroke='url("#a")'
        strokeDasharray="19 29"
        strokeLinecap="round"
        strokeWidth={5}
        d="m269.058 157.848 266.368-2.691"
      />
      <defs>
        <linearGradient id="a">
          <stop offset={0} stopColor="hsl(0, 0%, 100%)" />
          <stop offset={1} stopColor="hsl(0, 0%, 54%)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default memo(SVG)
