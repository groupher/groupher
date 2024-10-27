import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, bg, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute w-48 h-36 rounded-xl top-5 right-6 border border-dotted',
      'bg-cover bg-center',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    gradientBg:
      'url("data:image/svg+xml;utf8,%3Csvg height=%22auto%22 viewBox=%220 0 2000 1000%22 xmlns=%22http:%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath d=%22M0 982.022c30.8-9.292 92.4-34.42 154-46.46 61.6-12.04 92.4 9.655 154-13.738 61.6-23.394 92.4-69.905 154-103.232 61.6-33.326 92.4-46.487 154-63.4 61.6-16.912 92.4 13.59 154-21.162 61.6-34.752 92.4-137.413 154-152.598 61.6-15.186 92.4 108.537 154 76.67 61.6-31.866 92.4-176.662 154-236.001 61.6-59.34 92.4-92.359 154-60.697 61.6 31.662 92.4 178.069 154 219.005 61.6 40.937 92.4 62.086 154-14.322 61.6-76.408 92.4-266.757 154-367.72 61.6-100.963 123.2-109.675 154-137.094L2000 1000H0Z%22 fill=%22%23ff93191a%22%2F%3E%3Cpath d=%22M0 982.022c30.8-9.292 92.4-34.42 154-46.46 61.6-12.04 92.4 9.655 154-13.738 61.6-23.394 92.4-69.905 154-103.232 61.6-33.326 92.4-46.487 154-63.4 61.6-16.912 92.4 13.59 154-21.162 61.6-34.752 92.4-137.413 154-152.598 61.6-15.186 92.4 108.537 154 76.67 61.6-31.866 92.4-176.662 154-236.001 61.6-59.34 92.4-92.359 154-60.697 61.6 31.662 92.4 178.069 154 219.005 61.6 40.937 92.4 62.086 154-14.322 61.6-76.408 92.4-266.757 154-367.72 61.6-100.963 123.2-109.675 154-137.094%22 fill=%22none%22 stroke=%22%23ff9319%22 stroke-width=%227%22%2F%3E%3C%2Fsvg%3E")',
    trendText: cn('absolute top-3 left-3 text-xs scale-90', fg('text.hint')),
    trendNum: cn('absolute top-8 left-3.5 text-base', fg('text.title')),
    //
    bottomGradient: 'absolute w-full h-14 bottom-0 right-0 rounded-xl z-20',
    bottomGradientBg: 'linear-gradient(360deg, rgb(255 255 255) 5%, rgb(0 0 0 / 0%) 80%)',

    topGradient: 'absolute w-2/3 h-10 top-0 right-0 rounded-xl z-20',
    topGradientBg: 'linear-gradient(rgb(255 255 255) 25%, rgb(0 0 0 / 0%) 90%)',
    //
    highlightColumn: cn(
      'absolute right-24 mr-1 top-10 w-0.5 h-28 z-10 opacity-40 trans-all-200',
      rainbow(COLOR_NAME.ORANGE, 'bg'),
    ),
    highlightColumnHover: 'opacity-100 right-16 mr-3',

    highlightDot: cn(
      'absolute size-3 circle top-24 mt-1 right-24 trans-all-200 z-30 opacity-65',
      'border-2',
      rainbow(COLOR_NAME.ORANGE, 'bg'),
    ),
    highlightDotHover: 'top-16 mt-0.5 right-16 mr-1.5 opacity-100',
    dotBorderStyle: { borderColor: 'white' },
    //
    column: cn('absolute top-12 w-px h-28 opacity-15 z-10 trans-all-100', bg('text.digest')),
  }
}
