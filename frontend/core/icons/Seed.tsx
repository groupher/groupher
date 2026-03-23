import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className='icon'
      viewBox='0 0 1024 1024'
      xmlns='http://www.w3.org/2000/svg'
      width={200}
      height={200}
      {...props}
    >
      <path d='M128 192H0c0 247.4 200.6 448 448 448v288c0 17.6 14.4 32 32 32h64c17.6 0 32-14.4 32-32V640c0-247.4-200.6-448-448-448zM896 64c-168.4 0-314.8 93-391.4 230.4 55.4 60.4 96.4 133.8 118 215.2C848 486.2 1024 295.8 1024 64H896z' />
    </svg>
  )
}

export default SVG
