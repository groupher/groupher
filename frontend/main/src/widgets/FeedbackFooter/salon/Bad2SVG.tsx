import { memo, type SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient
          id="a"
          x1={-296.91}
          x2={-161.11}
          y1={469.34}
          y2={499.08}
          gradientTransform="translate(207.72 -1011.9) scale(2.3797)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A6C9ED" offset={0} />
          <stop stopColor="#DCBCE2" offset={1} />
        </linearGradient>
      </defs>
      <g transform="matrix(.07017 0 0 .07017 -3.284 -5.149)">
        <circle
          transform="rotate(246.32)"
          cx={-320.7}
          cy={104.99}
          r={178.15}
          fill="url(#a)"
          fillRule="evenodd"
          style={{
            paintOrder: 'stroke fill markers',
          }}
        />
        <g transform="translate(51.15 65.205) scale(.69522)" fill="#664f27" strokeWidth={0}>
          <path
            d="M325.77 390.11c.02-4.924-7.274-8.895-16.351-8.905 0 0-39.282-10.613-59.39-10.634-20.108-.02-59.39 10.506-59.39 10.506-9.076-.008-16.398 3.946-16.416 8.87-.018 4.923 7.274 8.895 16.351 8.905 0 0 39.282-10.527 59.39-10.506 20.108.02 59.39 10.634 59.39 10.634 9.076.008 16.398-3.946 16.416-8.87z"
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
          <ellipse
            cx={163.96}
            cy={270.08}
            rx={30.25}
            ry={33.935}
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
          <ellipse
            cx={163.96}
            cy={270.08}
            rx={30.25}
            ry={33.935}
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
          <path
            transform="rotate(195)"
            d="M-112.77-184.87a82.353 19.962 0 0 1-58.176 19.082 82.353 19.962 0 0 1-92.335-7.878 82.353 19.962 0 0 1 3.96-23.708l64.197 12.503z"
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
          <ellipse
            transform="scale(-1 1)"
            cx={-336.04}
            cy={270.08}
            rx={30.25}
            ry={33.935}
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
          <path
            transform="scale(1 -1) rotate(15)"
            d="M370.2-314.27a82.353 19.962 0 0 1-58.176 19.082 82.353 19.962 0 0 1-92.335-7.878 82.353 19.962 0 0 1 3.96-23.708l64.197 12.503z"
            style={{
              paintOrder: 'stroke fill markers',
            }}
          />
        </g>
      </g>
    </svg>
  )
}

export default memo(SVG)
