import { Suspense } from 'react'

const NotFound = () => {
  return (
    <Suspense fallback={null}>
      <h2>not found</h2>
    </Suspense>
  )
}

export default NotFound
