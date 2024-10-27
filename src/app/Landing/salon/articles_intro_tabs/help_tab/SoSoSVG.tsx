import { memo, type SVGProps } from 'react'

const COLOR = '#4a3509'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 36 36" {...props}>
      <g transform="matrix(-1 0 0 1 36 0)">
        <path
          fill="#FEE79D"
          d="M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18"
        />
        <ellipse cx={11.5} cy={16.5} fill={COLOR} rx={2.5} ry={3.5} />
        <ellipse cx={24.5} cy={16.5} fill={COLOR} rx={2.5} ry={3.5} />
        <path fill={COLOR} d="M25 26H11a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2z" />
      </g>
    </svg>
  )
}

export default memo(SVG)
