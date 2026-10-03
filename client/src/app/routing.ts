import { URL_NEW_STREET, JUST_SIGNED_IN_PATH } from './constants.js'

export function goReload(): void {
  window.location.reload()
}

export function goHome(): void {
  window.location.href = '/'
}

export function goNewStreet(sameWindow?: boolean): void {
  if (sameWindow) {
    window.location.replace(URL_NEW_STREET)
  } else {
    window.location.href = URL_NEW_STREET
  }
}

/**
 * STS identity service client.
 *
 * All sign-in methods end with the server setting session cookies and the
 * browser navigating to JUST_SIGNED_IN_PATH, where the app promotes any
 * anonymous street to the new account.
 */
const AUTH_BASE = '/services/auth'

export interface AuthMethods {
  password: boolean
  signUp: boolean
  magicLink: boolean
  passwordReset: boolean
  passwordMinLength: number
  providers: Array<{ key: string; label: string }>
}

export class AuthRequestError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'AuthRequestError'
    this.status = status
    this.code = code
  }
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const response = await window.fetch(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })

  let data: Record<string, unknown> = {}
  try {
    data = await response.json()
  } catch {
    // no body
  }

  if (!response.ok) {
    throw new AuthRequestError(
      response.status,
      typeof data.msg === 'string' ? data.msg : 'Request failed.',
      typeof data.code === 'string' ? data.code : undefined
    )
  }

  return data as T
}

export async function getAuthMethods(): Promise<AuthMethods> {
  const response = await window.fetch(`${AUTH_BASE}/config`, {
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new AuthRequestError(response.status, 'Could not load sign-in options.')
  }
  return response.json()
}

export function goJustSignedIn(): void {
  window.location.href = JUST_SIGNED_IN_PATH
}

export function goProviderSignIn(providerKey: string): void {
  window.location.href = `${AUTH_BASE}/oidc/${encodeURIComponent(providerKey)}`
}

export async function goEmailSignIn(email: string): Promise<void> {
  await postJson('/email/start', { email })
}

export async function goPasswordSignIn(
  email: string,
  password: string
): Promise<void> {
  await postJson('/login', { email, password })
  goJustSignedIn()
}

export async function goPasswordSignUp(
  email: string,
  password: string,
  nickname?: string
): Promise<void> {
  await postJson('/signup', { email, password, nickname })
  goJustSignedIn()
}

export async function requestPasswordReset(email: string): Promise<void> {
  await postJson('/password/forgot', { email })
}

export async function completePasswordReset(
  token: string,
  password: string
): Promise<void> {
  await postJson('/password/reset', { token, password })
  goJustSignedIn()
}

export async function signOutOnServer(): Promise<void> {
  await window.fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'same-origin',
  })
}
