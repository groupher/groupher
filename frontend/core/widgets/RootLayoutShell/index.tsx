import { type ReactNode, Suspense } from 'react'

import { prePaintThemeDetectScript } from '~/utils/ssr/script'
import ThemeFirstPaintScript from '~/widgets/ThemeFirstPaintScript'

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
          <meta name='color-scheme' content='light dark' />
          <script
            // oxlint-disable-next-line react/no-danger -- Inline pre-paint script is required before hydration to avoid theme flicker.
            dangerouslySetInnerHTML={{
              __html: prePaintThemeDetectScript(),
            }}
          />
        </head>
        <body>
          {children}
          <ThemeFirstPaintScript />

          {/* <Analytics />
          <SpeedInsights /> */}
        </body>
      </Suspense>
    </html>
  )
}
