import { requestLogin } from '~/auth'

type TProps = {
  action: string
}

export default function AuthRequired({ action }: TProps) {
  return (
    <div className='column-center min-h-80 w-full justify-center px-6 py-12'>
      <div className='column w-full max-w-md items-start rounded-xl bg-white p-6 shadow-sm dark:bg-neutral-900'>
        <h1 className='text-lg font-semibold text-neutral-900 dark:text-neutral-100'>
          Sign in required
        </h1>
        <p className='mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400'>
          Sign in to {action}. Public dashboard information remains available without an account.
        </p>
        <button
          type='button'
          className='mt-6 min-h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white'
          onClick={() => requestLogin({ returnTo: window.location.href })}
        >
          Sign in to continue
        </button>
      </div>
    </div>
  )
}
