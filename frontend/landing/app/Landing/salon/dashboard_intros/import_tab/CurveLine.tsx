import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" {...props}>
      <path
        fill="none"
        stroke='url("#a")'
        strokeDasharray="18 26"
        strokeLinecap="round"
        strokeWidth={4}
        d="M783.857 9.865c-15.92 29.08-10.592 75.537-67.265 122.87-56.673 47.334-45.055 44.655-172.197 77.13-127.142 32.476-239.791 16.79-365.023 60.09-125.231 43.3-125.282 93.79-164.125 122.87"
      />
      <defs>
        <linearGradient id="a">
          <stop offset={0} stopColor="hsl(0, 0%, 86%)" />
          <stop
            offset={1}
            stopColor="hsl(142.50000000000003, 5.333333333333333%, 29.411764705882355%)"
          />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default memo(SVG)
