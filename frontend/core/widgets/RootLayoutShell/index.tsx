import { type ReactNode, Suspense } from 'react'
import { ssrThemeInitScript } from '~/utils/ssr/script'

// import { Analytics } from '@vercel/analytics/react'
// import { SpeedInsights } from '@vercel/speed-insights/next'

type TProps = {
  children: ReactNode
  lang?: string
}

export default function RootLayoutShell({ children, lang = 'en' }: TProps) {
  // Suspense wrapper is a workaround for disable global streaming
  // if use Suspense inside body, will cause a global loading(fallback or loading.js) when page request
  // ref: https://github.com/vercel/next.js/issues/86739?utm_source=chatgpt.com

  return (
    <html lang={lang} suppressHydrationWarning>
      <Suspense fallback={null}>
        <head>
          <script
            // eslint-disable-next-line react/no-danger -- inline boot script is required before hydration to avoid theme flicker
            dangerouslySetInnerHTML={{
              __html: ssrThemeInitScript(),
            }}
          />
        </head>
        <body>
          {children}

          {/* <Analytics />
          <SpeedInsights /> */}
        </body>
      </Suspense>
    </html>
  )
}
