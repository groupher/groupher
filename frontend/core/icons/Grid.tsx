import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1066.667' {...props}>
      <g>
        {/* 水平线 */}
        <path d='M0 0h1200v1H0z' />
        <path d='M0 266.667h1200v1H0z' />
        <path d='M0 533.333h1200v1H0z' />
        <path d='M0 800h1200v1H0z' />
        <path d='M0 1066.667h1200v1H0z' />

        {/* 垂直线 */}
        <path d='M0 0h1v1066.667H0z' />
        <path d='M400 0h1v1066.667h-1z' />
        <path d='M800 0h1v1066.667h-1z' />
        <path d='M1200 0h1v1066.667h-1z' />
      </g>
    </svg>
  )
}

export default SVG
