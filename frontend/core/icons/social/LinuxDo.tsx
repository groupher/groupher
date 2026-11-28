import { memo, type SVGProps } from 'react'

const LinuxDo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 120 120' aria-hidden='true' {...props}>
    <circle cx='60' cy='60' r='50' fill='#f0f0f0' />
    <path d='M16 40a47 47 0 0 1 88 0z' fill='#1c1c1e' />
    <path d='M17 80h86a47 47 0 0 1-86 0z' fill='#ffb003' />
  </svg>
)

export default memo(LinuxDo)
