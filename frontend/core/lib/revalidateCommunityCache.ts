export const revalidateCommunityCache = async (community: string): Promise<void> => {
  if (!community) return

  try {
    const response = await fetch('/api/revalidate/community', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ community }),
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')

      throw new Error(
        `revalidate failed for ${community}: ${response.status} ${response.statusText} ${details}`,
      )
    }
  } catch (error) {
    // Dashboard layouts hydrate community data from Next `use cache`.
    // Keep mutation success non-blocking, but surface failures because stale cache
    // makes refreshed dashboard pages show old moderators, colors, tags, etc.
    console.error('## revalidate community cache error: ', error)
  }
}
