import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className="icon"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      {...props}
    >
      <path d="m266.4 220-157-156L64 109.1l157 156L97.5 387.8h292.3V97.3z" />
      <path d="M257.6 960h-64c0-103.5 20.3-203.8 60.2-298.3 38.6-91.2 93.8-173.2 164.2-243.5 70.4-70.3 152.3-125.5 243.6-164.1C756 214.2 856.5 194 960 194v64c-387.3 0-702.4 314.9-702.4 702z" />
    </svg>
  )
}

export default SVG
