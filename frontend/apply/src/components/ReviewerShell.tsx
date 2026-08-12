import { Link, Outlet } from '@tanstack/react-router'

export default function ReviewerShell() {
  return (
    <section>
      <div className='apply-actions' style={{ marginTop: 0 }}>
        <div>
          <h1 className='apply-title'>Application review</h1>
          <p className='apply-copy'>Global reviewer workspace</p>
        </div>
        <Link to='/review'>Queue</Link>
      </div>
      <Outlet />
    </section>
  )
}
