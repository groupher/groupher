import '../src/env'
import { smokeR2 } from '../src/r2'

try {
  const result = await smokeR2()
  console.log(JSON.stringify({ ok: true, result }, null, 2))
} catch (error) {
  console.error(
    JSON.stringify(
      {
        error: {
          message: error instanceof Error ? error.message : 'R2 smoke failed.',
        },
        ok: false,
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
}
