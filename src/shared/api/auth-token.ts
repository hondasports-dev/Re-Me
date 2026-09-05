import type { useAuth0 } from '@auth0/auth0-react'

export async function readAuth0IdToken(
  getAccessTokenSilently: ReturnType<typeof useAuth0>['getAccessTokenSilently'],
): Promise<string | null> {
  try {
    const response = await getAccessTokenSilently({ cacheMode: 'on', detailedResponse: true })
    return response.id_token || null
  } catch {
    return null
  }
}
