import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' {...props}>
      <g fill='none' fillRule='evenodd'>
        <path
          fill='#b7c4d2'
          d='M9 21h15v10h-6.998c-2.762 0-5.646-2.145-6.44-4.795L9 21ZM57 21H42v10h6.998c2.762 0 5.646-2.145 6.44-4.795L57 21ZM20.147 12.934S5.492 12.176 10.468 2c0 0-8.189 6.85-4.524 11.096 3.664 4.246 14.644 5.849 14.644 5.849M45.44 12.934S60.097 12.176 55.12 2c0 0 8.189 6.85 4.524 11.096C55.98 17.342 45 18.945 45 18.945'
        />
        <path
          fill='#F7BE34'
          d='M16.312 16.965C16.692 13.67 19.687 11 23 11h20c3.314 0 6.307 2.66 6.688 5.965L52 37H14l2.312-20.035Z'
        />
        <path
          fill='#CA0726'
          d='M12 40.993C12 37.131 15.14 34 19.006 34h27.988C50.864 34 54 37.13 54 40.993v8.011C54 56.182 48.182 62 40.999 62H25C17.821 62 12 56.181 12 49.004v-8.01Z'
        />
        <circle cx={42} cy={48} r={4} fill='#b7c4d2' />
        <circle cx={24} cy={48} r={4} fill='#b7c4d2' />
        <circle cx={27} cy={27} r={2} fill='#CA0726' />
        <circle cx={39} cy={27} r={2} fill='#CA0726' />
      </g>
    </svg>
  )
}

export default SVG
