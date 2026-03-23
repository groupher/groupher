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
      <path d='M448 867.84h-64V276.8L189.76 471.04l-45.44-45.44L448 122.24zm128 5.76V128h64v591.36l194.24-194.24 45.44 45.12z' />
    </svg>
  )
}

export default SVG
