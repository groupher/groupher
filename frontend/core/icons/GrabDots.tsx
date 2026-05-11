import type { SVGProps } from 'react'

const GrabDots = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width={32} height={32} viewBox='0 0 256 256' {...props}>
      <path d='M104 60a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm60 12a12 12 0 1 0-12-12 12 12 0 0 0 12 12Zm-72 44a12 12 0 1 0 12 12 12 12 0 0 0-12-12Zm72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12Zm-72 68a12 12 0 1 0 12 12 12 12 0 0 0-12-12Zm72 0a12 12 0 1 0 12 12 12 12 0 0 0-12-12Z' />
    </svg>
  )
}

export default GrabDots
