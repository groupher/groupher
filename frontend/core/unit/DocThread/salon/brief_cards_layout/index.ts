import useBase from '..'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    groups: 'mx-auto w-full max-w-6xl column gap-16 pl-5',
  }
}
