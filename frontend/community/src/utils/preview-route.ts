import { redirect } from '@tanstack/react-router'

type TPreviewLocation = {
  maskedLocation?: {
    pathname: string
  }
}

/** True only when the raw preview route is hidden behind its canonical detail URL. */
export const isCanonicalPreviewNavigation = (
  location: TPreviewLocation,
  canonicalPath: string,
): boolean => location.maskedLocation?.pathname === canonicalPath

/** Prevents internal preview routes from becoming directly addressable public pages. */
export const requireCanonicalPreviewMask = (
  location: TPreviewLocation,
  canonicalPath: string,
): void => {
  if (isCanonicalPreviewNavigation(location, canonicalPath)) return

  throw redirect({
    href: canonicalPath,
    replace: true,
    statusCode: 308,
  })
}
