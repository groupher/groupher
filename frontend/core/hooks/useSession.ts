import { useEffect } from 'react'

import type { TAccount } from '~/spec'

const useSession = (): TAccount | null => {
  useEffect(() => {
    const deleteCookie = async () => {
      await fetch('/api/auth-cleanup', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })
    }

    // TODO, delete auth.js token, and delete groupher.token(after move it to local storage)
    deleteCookie()
  }, [])

  return null
}

export default useSession
