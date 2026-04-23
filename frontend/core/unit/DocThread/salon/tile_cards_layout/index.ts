import useBase from '..'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    cats: 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3',
  }
}
