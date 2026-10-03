/**
 * Installs the in-browser backend for the static (GitHub Pages) build.
 *
 * Wraps `window.fetch` so that requests to `/api/*` and `/services/*` are
 * answered by `backend.ts`, and other root-relative URLs (images, sprites,
 * templates) are resolved under the site's base path.
 *
 * Import this module before anything else in main.tsx. In the server build
 * STATIC_MODE is false and this module does nothing.
 */
import { APP_BASE, STATIC_MODE, stripBase, withBase } from './env.js'
import { createStaticBackend, type StaticBackend } from './backend.js'

let backend: StaticBackend | null = null

export function getStaticBackend(): StaticBackend | null {
  return backend
}

function isBackendPath(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/services/')
}

async function readBody(input: RequestInfo | URL, init?: RequestInit) {
  const body = init?.body ?? (input instanceof Request ? await input.clone().text() : null)
  if (body === null || body === undefined) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof Blob) return await body.text()
  return String(body)
}

export function installStaticBackend(): void {
  if (!STATIC_MODE || backend !== null) return

  const originalFetch = window.fetch.bind(window)
  backend = createStaticBackend({
    fetchImpl: originalFetch,
    base: APP_BASE,
    storage: window.localStorage,
  })
  const active = backend

  window.fetch = async function staticFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(rawUrl, window.location.href)

    if (url.origin !== window.location.origin) {
      return await originalFetch(input, init)
    }

    const appPath = stripBase(url.pathname)
    if (isBackendPath(appPath)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      )
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      const routed = new URL(url.href)
      routed.pathname = appPath
      return await active.handle({
        method,
        url: routed,
        headers,
        body: await readBody(input, init),
      })
    }

    // Root-relative static resources live under the base path.
    const prefixed = withBase(url.pathname)
    if (prefixed !== url.pathname) {
      url.pathname = prefixed
      if (input instanceof Request) {
        return await originalFetch(new Request(url.href, input), init)
      }
      return await originalFetch(url.href, init)
    }
    return await originalFetch(input, init)
  }
}

installStaticBackend()
