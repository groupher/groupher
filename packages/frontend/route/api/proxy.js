export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  const url = new URL(request.url)

  // 决定目标 URL
  let target
  if (url.pathname === '/' || url.pathname === '/pricing') {
    target = 'https://groupher-landing.vercel.app'
  } else {
    target = 'https://groupher-main.vercel.app'
  }

  // 构建新的请求 URL
  const targetUrl = new URL(url.pathname + url.search, target)

  // 转发请求
  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
}
