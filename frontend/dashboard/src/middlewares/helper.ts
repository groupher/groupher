import { NextResponse } from 'next/server'

/**
 * chain the middlewares and apply them to the request
 */
export function applyMiddleware(middlewareFns, req) {
  for (const middlewareFn of middlewareFns) {
    const response = middlewareFn(req)
    // 如果中间件执行结果是重定向或重写，那么就返回该响应并且不再执行后续中间件

    if (response instanceof NextResponse) {
      // 检查状态码是否代表重定向
      if (response.status >= 300 && response.status < 400) {
        return response
      }
    }
  }

  return NextResponse.next()
}
