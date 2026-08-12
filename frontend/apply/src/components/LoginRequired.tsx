import { requestLogin } from '~/auth'

export default function LoginRequired() {
  return (
    <section className='apply-card'>
      <h1 className='apply-title'>Create your community</h1>
      <p className='apply-copy'>Sign in before starting an application.</p>
      <button
        className='apply-button apply-primary'
        type='button'
        onClick={() => requestLogin({ returnTo: window.location.href })}
      >
        Sign in to continue
      </button>
    </section>
  )
}
