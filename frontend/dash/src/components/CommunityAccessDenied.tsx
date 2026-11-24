import { Link } from '@tanstack/react-router'

export default function CommunityAccessDenied() {
  return (
    <div className='column-center min-h-80 w-full justify-center px-6 py-12'>
      <div className='column w-full max-w-md items-start rounded-xl bg-white p-6 shadow-sm dark:bg-neutral-900'>
        <h1 className='text-lg font-semibold text-balance text-neutral-900 dark:text-neutral-100'>
          You do not have access to this community
        </h1>
        <p className='mt-2 text-sm leading-6 text-pretty text-neutral-500 dark:text-neutral-400'>
          Ask a community administrator to add you as a moderator, or switch to an account that
          already has dashboard access.
        </p>
        <Link
          to='/$community/dash'
          params={true}
          className='row-center mt-6 min-h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white'
        >
          Back to overview
        </Link>
      </div>
    </div>
  )
}
