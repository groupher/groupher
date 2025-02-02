type TRet = {
  setCSSVar: (name: string, value: string) => void
  getCSSVar: (name: string) => void
}

export default (): TRet => {
  const setCSSVar = (name: string, value: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(name, value)
    }
  }

  const getCSSVar = (name: string): string => {
    if (typeof document !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(name)
    }
    return ''
  }

  return { setCSSVar, getCSSVar }
}
