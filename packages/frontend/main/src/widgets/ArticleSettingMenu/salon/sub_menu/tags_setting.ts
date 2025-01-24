import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, menu } = useTwBelt()

  return {
    wrapper: '',
    item: cn(menu('bar'), '-ml-0.5 py-1.5 pl-1 pr-0.5'),
    title: cn(menu('title'), 'text-sm'),
  }
}
