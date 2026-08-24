import { Link, type ErrorComponentProps } from '@tanstack/react-router'

export default function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className='column-center min-h-80 w-full justify-center px-6 py-12'>
      <div className='column w-full max-w-md items-start rounded-xl bg-white p-6 shadow-sm dark:bg-neutral-900'>
        <h1 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
          Community page could not be loaded
        </h1>
        <p className='mt-2 text-sm text-neutral-500 dark:text-neutral-400'>
          {error.message || 'An unexpected route error occurred.'}
        </p>
        <div className='row mt-6 gap-3'>
          <button
            type='button'
            className='min-h-10 rounded-lg bg-neutral-900 px-4 text-sm text-white'
            onClick={reset}
          >
            Try again
          </button>
          <Link to='/' className='row-center min-h-10 px-4 text-sm text-neutral-600'>
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
