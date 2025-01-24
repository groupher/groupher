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
      <path d="M864.555 268.501a42.667 42.667 0 0 1 0 60.331L412.032 781.397a42.453 42.453 0 0 1-22.613 11.819l-5.035.597h-5.077a42.496 42.496 0 0 1-27.648-12.416l-211.2-211.2a42.667 42.667 0 1 1 60.33-60.33l180.992 180.992 422.4-422.4a42.667 42.667 0 0 1 60.331 0z" />
    </svg>
  )
}

export default SVG
