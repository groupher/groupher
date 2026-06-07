import useBase from '..'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    cols: 'columns-1 gap-6 md:columns-2 xl:columns-3',
  }
}
