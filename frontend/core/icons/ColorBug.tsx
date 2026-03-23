import type { SVGProps } from 'react'

// see https://www.svgrepo.com/svg/317047/redbug?edit=true
const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' {...props}>
      <g fill='none' fillRule='evenodd'>
        <g stroke='#979797' strokeLinecap='round' strokeWidth={2}>
          <path d='m44 15.184 7.615-1.366L55.556 9M46 25.184l7.615-1.366L57.556 19M49.866 31.143 57 39.242l4.852 1.214' />
        </g>
        <g stroke='#979797' strokeLinecap='round' strokeWidth={2}>
          <path d='m22 15.184-7.615-1.366L10.444 9M20 25.184l-7.615-1.366L8.444 19M16.134 31.143 9 39.242l-4.852 1.214' />
        </g>
        <path
          fill='#E43535'
          d='M33 58c9.941 0 20-10.745 20-24S42.941 10 33 10 13 20.745 13 34s10.059 24 20 24Z'
        />
        <path
          fill='#595959'
          d='M33 25.005c2.587 0 12-5.691 12-9.005 0-3.314-5.373-6-12-6s-12 2.686-12 6 9.413 9.005 12 9.005Z'
        />
        <ellipse cx={33} cy={10} fill='#979797' rx={8} ry={2} />
        <path stroke='#595959' strokeLinecap='round' strokeWidth={2} d='M33.023 57V24.502' />
        <circle cx={44} cy={29} r={2} fill='#fff' />
        <circle cx={42} cy={43} r={2} fill='#fff' />
        <circle cx={27} cy={43} r={2} fill='#fff' />
        <circle cx={20} cy={32} r={2} fill='#fff' />
      </g>
    </svg>
  )
}

export default SVG
