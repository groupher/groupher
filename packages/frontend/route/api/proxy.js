import { NextResponse } from 'next/server'

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  console.log('Received request:', request.method, request.url)

  const url = new URL(request.url)
  const targetUrl = new URL(url.pathname + url.search, 'https://groupher-landing.vercel.app')

  console.log('Proxying to:', targetUrl.toString())

  // 记录请求头
  console.log('Request headers:', Object.fromEntries(request.headers))

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow', // 允许跟随重定向
    })

    console.log('Received response:', response.status, response.statusText)

    // 记录响应头
    console.log('Response headers:', Object.fromEntries(response.headers))

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

    // 处理特定的内容类型
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/javascript')) {
      newResponse.headers.set('Content-Type', 'application/javascript')
    }

    return newResponse
  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 })
  }
}
