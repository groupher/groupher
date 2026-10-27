const origin = new URL(process.env.PUBLIC_LANDING_ORIGIN || 'https://groupher.com/')
const attempts = Number.parseInt(process.env.PUBLIC_LANDING_ATTEMPTS || '1', 10)
const retryMs = Number.parseInt(process.env.PUBLIC_LANDING_RETRY_MS || '0', 10)

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

const checkPublicLanding = async () => {
  const cacheBust = Date.now().toString()
  const pages = [
    { pathname: '/', marker: 'landing-page' },
    { pathname: '/pricing/', marker: 'pricing-page' },
    { pathname: '/book-demo/', marker: 'book-demo-page' },
  ]
  const pageHtml = await Promise.all(
    pages.map(async ({ pathname, marker }) => {
      const pageUrl = new URL(pathname, origin)
      pageUrl.searchParams.set('public-smoke', cacheBust)
      const response = await fetch(pageUrl, { headers: { 'cache-control': 'no-cache' } })
      if (response.status !== 200) {
        throw new Error(`${pathname} returned HTTP ${response.status}`)
      }
      if (!response.headers.get('content-type')?.includes('text/html')) {
        throw new Error(
          `${pathname} returned an unexpected content type: ${response.headers.get('content-type')}`,
        )
      }
      const html = await response.text()
      if (!html.includes(`data-testid="${marker}"`)) {
        throw new Error(`${pathname} did not contain its page marker: ${marker}`)
      }

      return html
    }),
  )
  const html = pageHtml.join('\n')
  const assetPaths = [
    ...new Set(
      [...html.matchAll(/(?:href|src)="(\/landing\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)].map(
        ([, assetPath]) => assetPath,
      ),
    ),
  ]
  const publicAssetPaths = new Set([
    '/landing/intro/home.webp',
    '/landing/intro/home-dark.webp',
    '/landing/catpaw.png',
    '/landing/wallpaper/amber-mauve-wide.webp',
    '/landing/wallpaper/amber-mauve-desktop.webp',
    '/landing/wallpaper/amber-mauve-tablet.webp',
    '/landing/wallpaper/amber-mauve-phone.webp',
    ...[
      ...html.matchAll(
        /\/landing\/(?!assets\/)[^\s"'<>?#)]+\.(?:avif|gif|ico|jpe?g|json|png|svg|txt|webp|xml)/g,
      ),
    ].map(([assetPath]) => assetPath),
  ])
  assetPaths.push(...publicAssetPaths)
  const cssPaths = assetPaths.filter((assetPath) => assetPath.endsWith('.css'))
  const jsPaths = assetPaths.filter((assetPath) => assetPath.endsWith('.js'))

  if (cssPaths.length === 0 || jsPaths.length === 0) {
    throw new Error(`Landing page did not expose both CSS and JS assets: ${assetPaths.join(', ')}`)
  }

  for (const assetPath of assetPaths) {
    const assetUrl = new URL(assetPath, origin)
    assetUrl.searchParams.set('public-smoke', cacheBust)
    const response = await fetch(assetUrl, { headers: { 'cache-control': 'no-cache' } })
    if (response.status !== 200) {
      throw new Error(`${assetPath} returned HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (assetPath.endsWith('.css') && !contentType.includes('text/css')) {
      throw new Error(`${assetPath} returned unexpected content type: ${contentType}`)
    }
    if (assetPath.endsWith('.js') && !contentType.includes('javascript')) {
      throw new Error(`${assetPath} returned unexpected content type: ${contentType}`)
    }

    const bodyStart = (await response.text()).trimStart().slice(0, 32).toLowerCase()
    if (bodyStart.startsWith('<!doctype') || bodyStart.startsWith('<html')) {
      throw new Error(`${assetPath} returned HTML instead of a static asset`)
    }
  }

  console.log(
    `[public-landing] verified ${assetPaths.length} assets (${cssPaths.length} CSS, ${jsPaths.length} JS, ${publicAssetPaths.size} public) from ${origin.origin}`,
  )
}

let lastError
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await checkPublicLanding()
    process.exit(0)
  } catch (error) {
    lastError = error
    if (attempt < attempts) {
      console.warn(`[public-landing] attempt ${attempt}/${attempts} failed: ${error.message}`)
      await sleep(retryMs)
    }
  }
}

console.error(
  `[public-landing] failed after ${attempts} attempts: ${lastError?.message || 'unknown error'}`,
)
process.exit(1)
