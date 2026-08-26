import { Link } from '@tanstack/react-router'

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center'>
      <p className='text-digest text-sm tracking-widest uppercase'>404</p>
      <h1 className='text-title mt-3 text-4xl font-semibold'>Platform not found</h1>
      <p className='text-digest mt-4'>The feedback platform you requested is unavailable.</p>
      <Link className='text-link mt-8 font-semibold no-underline hover:underline' to='/'>
        Back to Inspire Me
      </Link>
    </main>
  )
}
