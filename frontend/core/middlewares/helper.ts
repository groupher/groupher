import { NextResponse } from 'next/server'

/**
 * 链式调用多个中间件，并合并它们的 headers 和 cookies
 */
export function applyMiddleware(middlewareFns, req) {
  // 初始化一个空的 response
  const finalResponse = NextResponse.next()

  for (const middlewareFn of middlewareFns) {
    const currentResponse = middlewareFn(req)

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

// import { NextResponse } from 'next/server'

// /**
//  * chain the middlewares and apply them to the request
//  */
// export function applyMiddleware(middlewareFns, req) {
//   for (const middlewareFn of middlewareFns) {
//     const response = middlewareFn(req)
//     // 如果中间件执行结果是重定向或重写，那么就返回该响应并且不再执行后续中间件

//     if (response instanceof NextResponse) {
//       // 检查状态码是否代表重定向
//       if (response.status >= 300 && response.status < 400) {
//         return response
//       }
//     }
//   }

//   return NextResponse.next()
// }
