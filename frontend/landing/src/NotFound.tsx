import { Link } from '@tanstack/react-router'

export default function NotFound() {
  return (
    <section
      className='column-align-both min-h-screen px-6 text-center'
      data-testid='not-found-page'
    >
      <p className='mb-3 text-sm tracking-widest uppercase opacity-60'>404</p>
      <h1 className='mb-4 text-4xl font-bold'>Page not found</h1>
      <p className='mb-8 max-w-lg text-base opacity-70'>
        The page you requested does not exist or may have moved.
      </p>
      <Link className='rounded-lg border px-5 py-2.5 hover:opacity-80' to='/'>
        Back to Groupher
      </Link>
    </section>
  )
}
