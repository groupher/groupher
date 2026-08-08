import { Link, type ErrorComponentProps } from '@tanstack/react-router'

export default function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className='column-center min-h-80 w-full justify-center px-6 py-12'>
      <div className='column w-full max-w-md items-start rounded-xl bg-white p-6 shadow-sm dark:bg-neutral-900'>
        <h1 className='text-lg font-semibold text-balance text-neutral-900 dark:text-neutral-100'>
          This dashboard section could not be loaded
        </h1>
        <p className='mt-2 text-sm leading-6 text-pretty text-neutral-500 dark:text-neutral-400'>
          {error.message || 'An unexpected route error occurred.'}
        </p>

        <div className='row mt-6 gap-3'>
          <button
            type='button'
            className='min-h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white'
            onClick={reset}
          >
            Try again
          </button>
          <Link
            to='/$community/dash'
            params={true}
            className='row-center min-h-10 rounded-lg px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
          >
            Back to overview
          </Link>
        </div>

        {import.meta.env.DEV && error.stack && (
          <pre className='mt-6 max-h-52 w-full overflow-auto rounded-lg bg-neutral-100 p-3 text-xs leading-5 whitespace-pre-wrap text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400'>
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  )
}
