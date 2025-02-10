import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  const { style, ...otherProps } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      className="icon"
      viewBox="0 0 1024 1024"
      style={style}
      {...otherProps}
    >
      <path d="M316.032 106.07c-39.125-26.113-96.043 1.962-91.819 52.82l1.238 14.806a3670.016 3670.016 0 0 0 119.04 669.568c14.378 52.224 86.613 56.747 108.544 8.32l90.837-200.405c8.661-19.158 29.739-31.446 52.65-29.014l224.683 24.064c51.584 5.547 88.022-57.429 46.678-97.322a3876.821 3876.821 0 0 0-539.222-434.39l-12.629-8.448z" />
    </svg>
  )
}

export default SVG
