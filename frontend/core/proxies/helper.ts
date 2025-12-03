import { NextResponse } from 'next/server'

/**
 * 链式调用多个中间件，并合并它们的 headers 和 cookies
 */
export function applyProxy(proxyFns, req) {
  // 初始化一个空的 response
  const finalResponse = NextResponse.next()

  for (const proxyFn of proxyFns) {
    const currentResponse = proxyFn(req)

    // 如果当前中间件返回了重定向，直接返回（不再执行后续中间件）
    if (currentResponse.redirected) {
      return currentResponse
    }

    // ✅ 合并 headers
    currentResponse.headers.forEach((value, key) => {
      finalResponse.headers.set(key, value)
    })

    // ✅ 合并 cookies
    // currentResponse.cookies.getAll().forEach((cookie) => {
    //   finalResponse.cookies.set(cookie)
    // })
  }

  return finalResponse
}
