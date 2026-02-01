import { readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const PID_FILE = path.resolve(process.cwd(), '.playwright/mock-server.pid')

export default async () => {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf8'))
    if (Number.isFinite(pid)) {
      // kill the whole process group (detached: true)
      process.kill(-pid, 'SIGTERM')
    }
  } catch {
    // ignore
  }

  try {
    unlinkSync(PID_FILE)
  } catch {
    // ignore
  }
}
