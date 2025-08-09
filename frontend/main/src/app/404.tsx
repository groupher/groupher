import ErrorPage from 'next/error'
import { Suspense } from 'react'

const NotFound = () => {
  return (
    <Suspense fallback={null}>
      <ErrorPage statusCode={404} title='Page Not Found' />
    </Suspense>
  )
}

export default NotFound
