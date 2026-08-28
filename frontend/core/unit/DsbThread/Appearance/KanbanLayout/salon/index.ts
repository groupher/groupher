import useBase from '../../../useDsbSalon'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.section,
  }
}
