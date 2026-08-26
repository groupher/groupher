import type { TImageProps } from './context'

const resolveSrc = (src: TImageProps['src']): string => (typeof src === 'string' ? src : src.src)

export default function Image({
  fill,
  priority,
  src,
  style,
  unoptimized: _unoptimized,
  ...props
}: TImageProps) {
  return (
    <img
      {...props}
      src={resolveSrc(src)}
      style={fill ? { height: '100%', objectFit: 'cover', width: '100%', ...style } : style}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
    />
  )
}
