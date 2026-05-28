import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, fill, primary } = useTwBelt()
  const texturePatternStyle = (type: string) => {
    switch (type) {
      case 'beam': {
        return {
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,.78) 0 2px, rgba(98,76,52,.58) 2px 4px, transparent 4px 9px, rgba(74,55,38,.42) 9px 12px, transparent 12px), linear-gradient(90deg, rgba(255,255,255,.46) 0 1px, transparent 1px)',
          backgroundSize: '13px 100%, 5px 100%',
        }
      }
      case 'ascii': {
        return {
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='28' viewBox='0 0 34 28'%3E%3Crect width='34' height='28' fill='%23efe7dc'/%3E%3Cg font-family='monospace' font-size='8.5' font-weight='700' fill='%234f3a2a' opacity='.86'%3E%3Ctext x='1' y='8'%3E@8%23%3C/text%3E%3Ctext x='6' y='18'%3ExY%3C/text%3E%3Ctext x='0' y='27'%3E%238X%3C/text%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: '24px 20px',
        }
      }
      case 'tile': {
        return {
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='44' viewBox='0 0 32 44'%3E%3Crect width='32' height='44' fill='%23efe7dc'/%3E%3Cg fill='%23746350' opacity='.72'%3E%3Crect x='2' y='1' width='9' height='15' rx='1.3'/%3E%3Crect x='12' y='1' width='9' height='15' rx='1.3'/%3E%3Crect x='22' y='1' width='8' height='15' rx='1.3'/%3E%3Crect x='2' y='17' width='9' height='15' rx='1.3'/%3E%3Crect x='12' y='17' width='9' height='15' rx='1.3'/%3E%3Crect x='22' y='17' width='8' height='15' rx='1.3'/%3E%3Crect x='2' y='33' width='9' height='10' rx='1.3'/%3E%3Crect x='12' y='33' width='9' height='10' rx='1.3'/%3E%3Crect x='22' y='33' width='8' height='10' rx='1.3'/%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: '24px 33px',
        }
      }
      case 'dots': {
        return {
          backgroundImage:
            'radial-gradient(circle, rgba(74,54,39,.74) 0 1.45px, transparent 2.1px), radial-gradient(circle, rgba(74,54,39,.5) 0 1.1px, transparent 1.8px)',
          backgroundPosition: '0 0, 4px 4px',
          backgroundSize: '8px 8px',
        }
      }
      default: {
        return {
          backgroundImage:
            'radial-gradient(circle at 24% 34%, rgba(92,55,35,.48) 0 .65px, transparent 1.05px), radial-gradient(circle at 64% 26%, rgba(92,55,35,.38) 0 .55px, transparent 1px), radial-gradient(circle at 48% 70%, rgba(92,55,35,.42) 0 .65px, transparent 1.05px)',
          backgroundSize: '4.5px 4.5px',
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
      'size-6 circle overflow-hidden relative border pointer trans-all-200 align-both shadow-sm',
      bg('card'),
    ),
    textureSwatchIdle: cn(br('divider'), `hover:${br('digest')}`),
    textureSwatchActive: cn(primary('border'), 'shadow-sm'),
    textureSwatchPreview: cn('s-full circle bg-center', bg('card')),
    texturePatternStyle,
    textureIntensity: 'w-full min-w-0',
  }
}
