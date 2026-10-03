/**
 * Federated sign-in through any OpenID Connect provider (Google, Microsoft
 * Entra, Keycloak, Auth0, etc.) for the STS identity service.
 *
 * Providers are configured with environment variables:
 *   OIDC_<NAME>_ISSUER         e.g. https://accounts.google.com
 *   OIDC_<NAME>_CLIENT_ID
 *   OIDC_<NAME>_CLIENT_SECRET
 *   OIDC_<NAME>_LABEL          (optional) label shown on the sign-in button
 *   OIDC_<NAME>_SCOPE          (optional) default "openid email profile"
 *
 * `<NAME>` becomes the provider key in lowercase (e.g. `google`). Without any
 * configured provider, the sign-in dialog only offers email/password.
 */
import * as client from 'openid-client'

import { logger } from '../lib/logger.ts'
import { appURL } from '../lib/url.ts'

export interface OidcProviderConfig {
  key: string
  label: string
  issuer: string
  clientId: string
  clientSecret: string
  scope: string
}

const ENV_PREFIX = 'OIDC_'
const KNOWN_ISSUERS: Record<string, string> = {
  google: 'https://accounts.google.com',
  microsoft: 'https://login.microsoftonline.com/common/v2.0',
}

function labelFor(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function getOidcProviders(): OidcProviderConfig[] {
  const providers: OidcProviderConfig[] = []
  for (const [name, value] of Object.entries(process.env)) {
    const match = name.match(/^OIDC_([A-Z0-9_]+)_CLIENT_ID$/)
    if (!match || !value) continue
    const upper = match[1]
    const key = upper.toLowerCase()
    const clientSecret = process.env[`${ENV_PREFIX}${upper}_CLIENT_SECRET`]
    const issuer = process.env[`${ENV_PREFIX}${upper}_ISSUER`] || KNOWN_ISSUERS[key]
    if (!clientSecret || !issuer) {
      logger.warn(
        `[auth] OIDC provider "${key}" ignored: missing CLIENT_SECRET or ISSUER.`
      )
      continue
    }
    providers.push({
      key,
      label: process.env[`${ENV_PREFIX}${upper}_LABEL`] || labelFor(key),
      issuer,
      clientId: value,
      clientSecret,
      scope: process.env[`${ENV_PREFIX}${upper}_SCOPE`] || 'openid email profile',
    })
  }
  return providers.sort((a, b) => a.key.localeCompare(b.key))
}

export function getOidcProvider(key: string): OidcProviderConfig | undefined {
  return getOidcProviders().find((p) => p.key === key)
}

const configCache = new Map<string, Promise<client.Configuration>>()

export function getOidcConfiguration(
  provider: OidcProviderConfig
): Promise<client.Configuration> {
  const cached = configCache.get(provider.key)
  if (cached) return cached
  const promise = client.discovery(
    new URL(provider.issuer),
    provider.clientId,
    provider.clientSecret
  )
  configCache.set(provider.key, promise)
  promise.catch(() => configCache.delete(provider.key))
  return promise
}

export function callbackUrlFor(provider: OidcProviderConfig): string {
  return `${appURL.origin}/services/auth/oidc/${provider.key}/callback`
}

export interface OidcStartResult {
  url: string
  state: string
  codeVerifier: string
  nonce: string
}

export async function startOidcSignIn(
  provider: OidcProviderConfig
): Promise<OidcStartResult> {
  const config = await getOidcConfiguration(provider)
  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()
  const nonce = client.randomNonce()

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrlFor(provider),
    scope: provider.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  })

  return { url: url.href, state, codeVerifier, nonce }
}

export interface OidcIdentityClaims {
  sub: string
  email?: string
  emailVerified?: boolean
  name?: string
  preferredUsername?: string
  picture?: string
}

export async function completeOidcSignIn(
  provider: OidcProviderConfig,
  currentUrl: URL,
  expected: { state: string; codeVerifier: string; nonce: string }
): Promise<OidcIdentityClaims> {
  const config = await getOidcConfiguration(provider)
  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: expected.codeVerifier,
    expectedState: expected.state,
    expectedNonce: expected.nonce,
  })
  const claims = tokens.claims()
  if (!claims?.sub) {
    throw new Error('OIDC provider returned no subject claim')
  }

  let userinfo: Record<string, unknown> = {}
  try {
    userinfo = await client.fetchUserInfo(config, tokens.access_token, claims.sub)
  } catch (err) {
    logger.warn(`[auth] Could not fetch userinfo from ${provider.key}: ${err}`)
  }

  const get = (key: string): unknown => userinfo[key] ?? claims[key]

  return {
    sub: claims.sub,
    email: typeof get('email') === 'string' ? (get('email') as string) : undefined,
    emailVerified: get('email_verified') === true,
    name: typeof get('name') === 'string' ? (get('name') as string) : undefined,
    preferredUsername:
      typeof get('preferred_username') === 'string'
        ? (get('preferred_username') as string)
        : undefined,
    picture:
      typeof get('picture') === 'string' ? (get('picture') as string) : undefined,
  }
}
