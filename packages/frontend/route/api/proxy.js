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

  // 构建目标 URL
  const targetUrl = new URL(url.pathname + url.search, target)

  console.log('Proxying to:', targetUrl.toString())

  try {
    // 处理静态文件请求
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/static/')) {
      const response = await fetch(targetUrl)
      if (!response.ok) {
        console.error('Static resource not found:', targetUrl.toString())
        return new Response('Static resource not found', { status: 404 })
      }
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      })
    }

    // 处理其他请求
    const body =
      request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
    const headers = new Headers(request.headers)

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
    })

    if (!response.ok) {
      console.error('Resource not found:', targetUrl.toString())
      return new Response('Resource not found', { status: 404 })
    }

    // 返回代理响应
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
