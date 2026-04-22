import useBase from '..'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    cats: 'grid grid-cols-1 gap-8 xl:grid-cols-3',
  }
}
