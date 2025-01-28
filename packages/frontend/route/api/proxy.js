import { NextResponse } from 'next/server'

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  const url = new URL(request.url)
  const { pathname, search } = url

  console.log('Received request:', request.method, pathname)

  // 定义目标 URL 的基础路径
  let targetBaseUrl

  if (pathname === '/' || pathname === '/pricing') {
    // 根路径或 /pricing，路由到 landing
    targetBaseUrl = 'https://groupher-landing.vercel.app'
  } else if (pathname.startsWith('/_next')) {
    // 静态资源请求，判断来源
    const referer = request.headers.get('referer') || ''
    if (referer.includes('groupher-landing')) {
      // 来自 landing 的静态资源
      targetBaseUrl = 'https://groupher-landing.vercel.app'
    } else {
      // 默认路由到 main 的静态资源
      targetBaseUrl = 'https://groupher-main.vercel.app'
    }
  } else {
    // 其他路径，路由到 main
    targetBaseUrl = 'https://groupher-main.vercel.app'
  }

  // 构建目标 URL
  const targetUrl = new URL(pathname + search, targetBaseUrl)

  console.log('Proxying to:', targetUrl.toString())

  try {
    // 读取请求体
    const body =
      request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()

    // 复制请求头
    const headers = new Headers(request.headers)

    // 发起代理请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'follow',
    })

    console.log('Received response:', response.status, response.statusText)

    // 创建新的响应对象
    const newResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })

    // 设置 CORS 头
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return newResponse
  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
