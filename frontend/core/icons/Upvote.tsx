import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={200}
      height={200}
      className='icon'
      viewBox='0 0 1024 1024'
      {...props}
    >
      <path d='M476.693 276.032 151.872 754.709a42.667 42.667 0 0 0 35.307 66.624H836.82a42.667 42.667 0 0 0 35.307-66.624L547.307 276.032a42.667 42.667 0 0 0-70.614 0z' />
    </svg>
  )
}

export default SVG
