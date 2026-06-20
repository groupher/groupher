import useBase from '../../useAppearanceBaseSalon'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.baseSection,
  }
}
