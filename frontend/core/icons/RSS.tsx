/* eslint-disable max-len */
import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' {...props}>
      <title>{'rss-feed'}</title>
      <g data-name='Layer 2'>
        <path fill='none' d='M0 0h48v48H0z' data-name='invisible box' />
        <g data-name='Q3 icons'>
          <path d='M11 35a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-4a6 6 0 1 0 6 6 6 6 0 0 0-6-6ZM7 18a2 2 0 0 0 0 4 19 19 0 0 1 19 19 2 2 0 0 0 4 0A23 23 0 0 0 7 18Z' />
          <path d='M7 5a2 2 0 0 0 0 4 32.1 32.1 0 0 1 32 32 2 2 0 0 0 4 0A36 36 0 0 0 7 5Z' />
        </g>
      </g>
    </svg>
  )
}

export default SVG
