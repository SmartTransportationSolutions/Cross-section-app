/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for GitHub JSON */
import { describe, it, expect, beforeEach } from 'vitest'

import { createStaticBackend } from './backend.js'
import { setGitHubSession, clearGitHubSession } from './session.js'
import { normalizeBase, stripBase, withBase } from './env.js'

/** Minimal in-memory GitHub REST fake, called through fetch(). */
function createFakeGitHub(users: Record<string, string>) {
  // users: token -> login
  const gists = new Map<string, any>()
  let seq = 0
  const writes: string[] = []

  const meta = (g: any, withContent: boolean) => ({
    id: g.id,
    description: g.description,
    public: g.public,
    created_at: g.created_at,
    updated_at: g.updated_at,
    owner: { login: g.owner },
    files: Object.fromEntries(
      Object.entries(g.files).map(([name, content]) => [
        name,
        withContent
          ? { filename: name, content, truncated: false }
          : { filename: name, raw_url: `https://raw.test/${g.id}/${name}` },
      ])
    ),
  })

  async function fetchImpl(input: RequestInfo | URL, init?: RequestInit) {
    const url = new URL(String(input), 'https://example.github.io')
    const method = init?.method ?? 'GET'
    const auth = new Headers(init?.headers).get('Authorization')
    const login = auth ? users[auth.replace('Bearer ', '')] : undefined
    const json = (status: number, body?: unknown) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status })

    if (url.host === 'raw.test') {
      const [, id, name] = url.pathname.split('/')
      const g = gists.get(id)
      return g ? new Response(g.files[name]) : new Response('', { status: 404 })
    }
    if (url.pathname.startsWith('/Cross-section-app/data/members.json')) {
      return json(200, { plus: ['Member'], admin: [] })
    }
    if (url.pathname.startsWith('/Cross-section-app/locales/')) {
      return json(200, { hello: 'world' })
    }
    if (url.host !== 'api.github.com') return json(404)
    if (auth && !login) return json(401, { message: 'Bad credentials' })

    const p = url.pathname
    let m: RegExpExecArray | null
    if (p === '/user') return login ? json(200, { login, name: login, avatar_url: '' }) : json(401)
    if ((m = /^\/users\/([^/]+)$/.exec(p))) return json(200, { login: m[1], name: null, avatar_url: '' })
    if ((m = /^\/users\/([^/]+)\/gists$/.exec(p))) {
      return json(200, [...gists.values()].filter((g) => g.owner.toLowerCase() === m![1].toLowerCase() && g.public).map((g) => meta(g, false)))
    }
    if (p === '/gists' && method === 'GET') {
      return json(200, [...gists.values()].filter((g) => g.owner === login).map((g) => meta(g, false)))
    }
    if (p === '/gists' && method === 'POST') {
      if (!login) return json(401)
      const body = JSON.parse(String(init?.body))
      const id = (++seq).toString(16).padStart(32, 'b')
      const now = new Date(1700000000000 + seq * 1000).toISOString()
      const files = Object.fromEntries(Object.entries(body.files).map(([k, v]: any) => [k, v.content]))
      const g = { id, description: body.description, public: body.public, created_at: now, updated_at: now, owner: login, files }
      gists.set(id, g)
      writes.push(`POST ${id}`)
      return json(201, meta(g, true))
    }
    if ((m = /^\/gists\/([^/]+)$/.exec(p))) {
      const g = gists.get(m[1])
      if (!g) return json(404)
      if (method === 'GET') return json(200, meta(g, true))
      if (g.owner !== login) return json(404)
      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body))
        if (body.description) g.description = body.description
        for (const [k, v] of Object.entries(body.files ?? {}) as any) g.files[k] = v.content
        g.updated_at = new Date(1700000000000 + ++seq * 1000).toISOString()
        writes.push(`PATCH ${g.id}`)
        return json(200, meta(g, true))
      }
      if (method === 'DELETE') {
        gists.delete(g.id)
        writes.push(`DELETE ${g.id}`)
        return new Response(null, { status: 204 })
      }
    }
    return json(404)
  }

  return { fetchImpl, gists, writes }
}

function request(method: string, path: string, body?: unknown, headers: HeadersInit = {}) {
  return {
    method,
    url: new URL(path, 'https://example.github.io'),
    headers: new Headers(headers),
    body: body === undefined ? null : JSON.stringify(body),
  }
}

const STREET_DATA = { street: { schemaVersion: 35, segments: [], width: 20 } } as any

describe('static backend', () => {
  let fake: ReturnType<typeof createFakeGitHub>
  let backend: ReturnType<typeof createStaticBackend>

  beforeEach(() => {
    window.localStorage.clear()
    clearGitHubSession()
    fake = createFakeGitHub({ 'tok-owner': 'Owner', 'tok-other': 'other', 'tok-member': 'Member' })
    backend = createStaticBackend({
      fetchImpl: fake.fetchImpl,
      base: '/Cross-section-app',
      storage: window.localStorage,
      writeIntervalMs: 50,
    })
  })

  function signIn(login: string, token: string) {
    setGitHubSession({ login, token, name: login, avatarUrl: null })
  }

  it('stores anonymous streets in browser storage only', async () => {
    const res = await backend.handle(request('POST', '/api/v1/streets', { name: 'Local', data: STREET_DATA }))
    expect(res.status).toBe(201)
    const street = await res.json()
    expect(street.creatorId).toBeNull()
    expect(street.namespacedId).toBe(1)
    expect(fake.writes).toHaveLength(0)

    const put = await backend.handle(request('PUT', `/api/v1/streets/${street.id}`, { name: 'Renamed' }))
    expect(put.status).toBe(204)
    const found = await backend.handle(request('GET', '/api/v1/streets?namespacedId=1'))
    expect((await found.json()).name).toBe('Renamed')
  })

  it('creates a public gist for signed-in users and finds it by creator and number', async () => {
    signIn('Owner', 'tok-owner')
    const res = await backend.handle(request('POST', '/api/v1/streets', { name: 'Main St', data: STREET_DATA }))
    expect(res.status).toBe(201)
    const street = await res.json()
    expect(street.creatorId).toBe('owner')
    const gist = fake.gists.get(street.id)
    expect(gist.public).toBe(true)
    expect(Object.keys(gist.files)).toEqual(['sts-street-1.json'])

    clearGitHubSession()
    const found = await backend.handle(request('GET', '/api/v1/streets?namespacedId=1&creatorId=owner'))
    expect(found.status).toBe(200)
    expect((await found.json()).name).toBe('Main St')
  })

  it('numbers streets per account', async () => {
    signIn('Owner', 'tok-owner')
    await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))
    const second = await (await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))).json()
    expect(second.namespacedId).toBe(2)
  })

  it('coalesces rapid updates and resolves only after GitHub accepted the write', async () => {
    signIn('Owner', 'tok-owner')
    const street = await (await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))).json()
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => backend.handle(request('PUT', `/api/v1/streets/${street.id}`, { name: `v${i}` })))
    )
    expect(results.every((r) => r.status === 204)).toBe(true)
    const patches = fake.writes.filter((w) => w.startsWith('PATCH'))
    expect(patches.length).toBeLessThanOrEqual(2)
    const content = JSON.parse(fake.gists.get(street.id).files['sts-street-1.json'])
    expect(content.name).toBe('v5')
  })

  it('refuses to modify or delete another user\'s street', async () => {
    signIn('Owner', 'tok-owner')
    const street = await (await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))).json()
    signIn('other', 'tok-other')
    const fresh = createStaticBackend({ fetchImpl: fake.fetchImpl, base: '/Cross-section-app', storage: window.localStorage })
    expect((await fresh.handle(request('PUT', `/api/v1/streets/${street.id}`, { name: 'x' }))).status).toBe(403)
    expect((await fresh.handle(request('DELETE', `/api/v1/streets/${street.id}`))).status).toBe(403)
    clearGitHubSession()
    expect((await fresh.handle(request('PUT', `/api/v1/streets/${street.id}`, { name: 'x' }))).status).toBe(401)
  })

  it('takes ownership from GitHub, not from file content', async () => {
    signIn('Owner', 'tok-owner')
    const street = await (await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))).json()
    const g = fake.gists.get(street.id)
    g.files['sts-street-1.json'] = JSON.stringify({ ...JSON.parse(g.files['sts-street-1.json']), creatorId: 'mallory' })
    const res = await backend.handle(request('GET', `/api/v1/streets/${street.id}`))
    expect((await res.json()).creatorId).toBe('owner')
  })

  it('echoes the request id header used for stale-response detection', async () => {
    const street = await (await backend.handle(request('POST', '/api/v1/streets', { data: STREET_DATA }))).json()
    const res = await backend.handle(request('GET', `/api/v1/streets/${street.id}`, undefined, { 'x-streetmix-request-id': '42' }))
    expect(res.headers.get('x-streetmix-request-id')).toBe('42')
  })

  it('lists a user gallery from gists, newest first, and deletes streets', async () => {
    signIn('Owner', 'tok-owner')
    const a = await (await backend.handle(request('POST', '/api/v1/streets', { name: 'A', data: STREET_DATA }))).json()
    await backend.handle(request('POST', '/api/v1/streets', { name: 'B', data: STREET_DATA }))
    const gallery = await (await backend.handle(request('GET', '/api/v1/users/owner/streets'))).json()
    expect(gallery.streets.map((s: any) => s.name)).toEqual(['B', 'A'])
    expect(gallery.pagination.total).toBe(2)
    expect((await backend.handle(request('DELETE', `/api/v1/streets/${a.id}`))).status).toBe(204)
    expect(fake.gists.has(a.id)).toBe(false)
  })

  it('derives Plus membership from members.json', async () => {
    signIn('Member', 'tok-member')
    const profile = await (await backend.handle(request('GET', '/api/v1/users/member'))).json()
    expect(profile.roles).toContain('SUBSCRIBER_1')
    const other = await (await backend.handle(request('GET', '/api/v1/users/someone'))).json()
    expect(other.roles).toEqual(['USER'])
  })

  it('reports an expired token as 401 so the client signs out', async () => {
    signIn('Owner', 'revoked-token')
    const res = await backend.handle(request('GET', '/api/v1/users/owner'))
    expect(res.status).toBe(401)
  })

  it('stores settings in a secret gist', async () => {
    signIn('Owner', 'tok-owner')
    expect((await backend.handle(request('PUT', '/api/v1/users/owner', { units: 1 }))).status).toBe(204)
    const settings = [...fake.gists.values()].find((g) => 'sts-street-settings.json' in g.files)
    expect(settings.public).toBe(false)
    const profile = await (await backend.handle(request('GET', '/api/v1/users/owner'))).json()
    expect(profile.data).toEqual({ units: 1 })
    expect((await backend.handle(request('PUT', '/api/v1/users/other', { units: 1 }))).status).toBe(403)
  })

  it('rejects path traversal in translation requests', async () => {
    expect((await backend.handle(request('GET', '/api/v1/translate/de/main'))).status).toBe(200)
    expect((await backend.handle(request('GET', '/api/v1/translate/..%2F..%2Fx/main'))).status).toBe(400)
    expect((await backend.handle(request('GET', '/api/v1/translate/de/secrets'))).status).toBe(400)
  })

  it('serves the reserved examples account from static data, never from GitHub', async () => {
    const res = await backend.handle(request('GET', '/api/v1/users/examples'))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('examples')
  })

  it('answers unavailable server features with non-5xx statuses', async () => {
    expect((await backend.handle(request('GET', '/services/geoip'))).status).toBe(404)
    expect((await backend.handle(request('POST', '/services/newsletter', {}))).status).toBe(404)
  })
})

describe('base path helpers', () => {
  it('normalizes, prefixes and strips the base path', () => {
    expect(normalizeBase('Cross-section-app/')).toBe('/Cross-section-app')
    expect(normalizeBase('/')).toBe('')
    expect(withBase('/new', '/app')).toBe('/app/new')
    expect(withBase('/app/new', '/app')).toBe('/app/new')
    expect(withBase('https://x.test/a', '/app')).toBe('https://x.test/a')
    expect(withBase('//cdn.test/a', '/app')).toBe('//cdn.test/a')
    expect(stripBase('/app/user/1', '/app')).toBe('/user/1')
    expect(stripBase('/app', '/app')).toBe('/')
    expect(stripBase('/other', '/app')).toBe('/other')
    expect(withBase('/new', '')).toBe('/new')
  })
})
