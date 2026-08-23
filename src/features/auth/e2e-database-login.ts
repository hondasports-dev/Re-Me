export const AUTH0_DATABASE_CONNECTION = 'Username-Password-Authentication'

export function shouldStartE2eDatabaseLogin(
  allowFlag: string | undefined,
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  return allowFlag === '1' && searchParams.get('e2e_db') === '1'
}
