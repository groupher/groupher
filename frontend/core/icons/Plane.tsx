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
      <path d='M397.632 634.496 833.28 279.04l-435.584 468.8v133.248L620.8 761.92 833.408 884.8l87.04-737.28L183.68 515.84l213.952 118.592 431.104-351.616.512.576-346.88 373.312 350.912-377.6-435.648 355.328zM1024 0 903.168 1024 619.2 859.84 312.128 1024V684.992L0 512 1024 0z' />
    </svg>
  )
}

export default SVG
