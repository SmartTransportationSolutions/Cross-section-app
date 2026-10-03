/**
 * Build-time switches for the static (GitHub Pages) deployment target.
 *
 * Parcel inlines `process.env.*` at build time. In the default server build
 * these are unset, so STATIC_MODE is false and every helper is a no-op.
 */

function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value : ''
}

let rawStatic = ''
let rawBase = ''
let rawApi = ''
try {
  rawStatic = readEnv(process.env.STATIC_MODE)
  rawBase = readEnv(process.env.APP_BASE_PATH)
  rawApi = readEnv(process.env.GITHUB_API_URL)
} catch {
  // `process` is not defined: not a Parcel build (e.g. some test runners)
}

/** True when the app is built to run without the STS Street server. */
export const STATIC_MODE: boolean = rawStatic === 'true'

/**
 * Path prefix the app is served under, without a trailing slash.
 * Example: "/Cross-section-app" for a GitHub Pages project site.
 */
export const APP_BASE: string = normalizeBase(rawBase)

/** GitHub REST API root (configurable for GitHub Enterprise and tests). */
export const GITHUB_API: string = (
  rawApi || 'https://api.github.com'
).replace(/\/+$/, '')

export function normalizeBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === '' || trimmed === '/') return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Prefixes a root-relative path with the base path. */
export function withBase(path: string, base: string = APP_BASE): string {
  if (!base || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === base || path.startsWith(`${base}/`)) return path
  return `${base}${path}`
}

/** Removes the base path from a pathname (for URL routing). */
export function stripBase(pathname: string, base: string = APP_BASE): string {
  if (!base) return pathname
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length)
  return pathname
}
