import { Suspense } from 'react'
import ErrorPage from 'next/error'

const NotFound = () => {
  return (
    <Suspense fallback={null}>
      <ErrorPage statusCode={404} title="Page Not Found" />
    </Suspense>
  )
}

export default NotFound
