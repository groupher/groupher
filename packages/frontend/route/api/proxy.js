export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  const url = new URL(request.url)

  // 确定目标网站
  let target
  if (url.pathname === '/' || url.pathname === '/pricing') {
    target = 'https://groupher-landing.vercel.app'
  } else {
    target = 'https://groupher-main.vercel.app'
  }

  // 处理静态文件请求
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/static/')) {
    const targetUrl = new URL(url.pathname + url.search, target)
    return fetch(targetUrl)
  }

  // 处理其他请求
  const targetUrl = new URL(url.pathname + url.search, target)
  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
}
