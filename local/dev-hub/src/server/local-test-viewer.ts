/** Verifies the browser's real same-origin viewer without exposing credentials or error bodies. */
export const verifyLocalTestViewer = async (expectedLogin: string): Promise<void> => {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
    body: JSON.stringify({ query: '{ sessionState { isValid user { login } } }' }),
  })
  if (!response.ok)
    throw new Error(
      `Local viewer query failed (HTTP ${response.status}). Check the app service logs.`,
    )

  let payload: {
    errors?: unknown[]
    data?: { sessionState?: { isValid?: boolean; user?: { login?: string } } }
  } | null
  try {
    payload = await response.json()
  } catch {
    throw new Error('Local viewer query returned invalid JSON. Check the app service logs.')
  }
  if (payload?.errors?.length)
    throw new Error('Local viewer query returned GraphQL errors. Check the app service logs.')

  const viewer = payload?.data?.sessionState
  if (viewer?.isValid !== true || viewer.user?.login !== expectedLogin)
    throw new Error('Local viewer did not match the selected registered account.')
}
