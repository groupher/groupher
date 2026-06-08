import useBase from '../../salon'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    cats: 'mx-auto w-full max-w-6xl column gap-16 px-4',
  }
}
