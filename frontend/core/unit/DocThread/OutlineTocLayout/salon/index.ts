import useBase from '../../salon'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    cats: 'mx-auto w-full max-w-5xl column gap-10 px-5',
  }
}
