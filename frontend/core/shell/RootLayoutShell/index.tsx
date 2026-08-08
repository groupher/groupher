import { type ReactNode, Suspense } from 'react'

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
        </head>
        <body>{children}</body>
      </Suspense>
    </html>
  )
}
