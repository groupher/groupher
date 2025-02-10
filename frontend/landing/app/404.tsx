import ErrorPage from 'next/error'

const NotFound = () => {
  return <ErrorPage statusCode={404} title="Page Not Found" />
}

export default NotFound
