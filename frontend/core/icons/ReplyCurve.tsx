import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={100}
      height={100}
      stroke='currentColor'
      viewBox='0 0 24 24'
      {...props}
    >
      <circle cx={19} cy={5} r={2} />
      <circle cx={5} cy={19} r={2} />
      <path d='M5 17A12 12 0 0 1 17 5' />
    </svg>
  )
}

export default SVG
