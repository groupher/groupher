'use client'

import useTrans from '~/hooks/useTrans'

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export default function Page() {
  const { t } = useTrans()

  return (
    <>
      <h2>{t('dsb.page.proxy_error')}</h2>
      <p>{t('dsb.page.landing_proxy_hint')}</p>
    </>
  )
}
