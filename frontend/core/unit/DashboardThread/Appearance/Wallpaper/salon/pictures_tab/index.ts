import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, fill, primary } = useTwBelt()
  const texturePatternStyle = (type: string) => {
    switch (type) {
      case 'pixelate': {
        return {
          backgroundImage:
            'linear-gradient(90deg, rgba(80,65,50,.28) 50%, transparent 50%), linear-gradient(rgba(80,65,50,.28) 50%, transparent 50%)',
          backgroundSize: '5px 5px',
        }
      }
      case 'beam': {
        return {
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,.55) 0 1px, transparent 2px 7px, rgba(80,65,50,.22) 8px 10px, transparent 11px), linear-gradient(90deg, rgba(255,255,255,.32) 0 2px, transparent 3px)',
          backgroundSize: '12px 100%, 19px 100%',
        }
      }
      case 'ascii': {
        return {
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='40' viewBox='0 0 56 40'%3E%3Crect width='56' height='40' fill='%23efe7dc'/%3E%3Cg font-family='monospace' font-size='8' fill='%235d4a35' opacity='.68'%3E%3Ctext x='2' y='9'%3E@8X%23x%3C/text%3E%3Ctext x='0' y='20'%3Ex%2B=%238%3C/text%3E%3Ctext x='4' y='31'%3E%23@8Xx%3C/text%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: '56px 40px',
        }
      }
      case 'screentone': {
        return {
          backgroundImage: 'radial-gradient(circle, rgba(80,60,45,.48) 0 .9px, transparent 1.4px)',
          backgroundSize: '5px 5px',
        }
      }
      case 'dither': {
        return {
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(92,55,35,.48) 0 .9px, transparent 1.4px), radial-gradient(circle at 75% 75%, rgba(210,88,48,.5) 0 .9px, transparent 1.4px)',
          backgroundSize: '6px 6px',
        }
      }
      default: {
        return {
          backgroundImage:
            'radial-gradient(circle at 24% 34%, rgba(92,55,35,.48) 0 .9px, transparent 1.4px), radial-gradient(circle at 64% 26%, rgba(92,55,35,.38) 0 .8px, transparent 1.4px), radial-gradient(circle at 48% 70%, rgba(92,55,35,.42) 0 .9px, transparent 1.4px)',
          backgroundSize: '7px 7px',
        }
      }
    }
  }

  return {
    wrapper: 'grid grid-cols-4 gap-3 s-full mt-2.5 relative',
    block: cn(
      'w-full h-24 rounded-md overflow-hidden relative border border-2 border-transparent pointer trans-all-200',
      `hover:${br('digest')}`,
    ),
    blockActive: cn(br('digest')),
    image: 'object-cover w-full h-full',
    activeSign: cn(
      'size-5 circle absolute -top-1 -right-0.5 z-20 border',
      primary('bg'),
      br('title'),
    ),
    checkIcon: cn('size-3.5 absolute top-0.5 left-0.5', fill('button.fg')),
    texturePanel: 'column gap-4 w-full min-w-0',
    textureControls: 'column gap-4 w-full min-w-0',
    textureRow: 'flex items-center gap-3',
    textureLabel: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    textureOptions: 'row-center gap-1.5',
    textureSwatch: cn(
      'size-6 circle overflow-hidden relative border-2 pointer trans-all-200 align-both shadow-sm',
      bg('card'),
    ),
    textureSwatchIdle: cn(br('divider'), `hover:${br('digest')}`),
    textureSwatchActive: cn(primary('border'), 'shadow-sm'),
    textureSwatchPreview: cn('s-full circle bg-center', bg('card')),
    texturePatternStyle,
    textureIntensity: 'w-full min-w-0',
  }
}
