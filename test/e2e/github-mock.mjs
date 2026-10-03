/**
 * In-memory stand-in for the parts of the GitHub REST API that the static
 * (GitHub Pages) edition uses: /user, /users/:login, and gists CRUD.
 *
 * It follows GitHub's documented behaviour that matters to the app:
 * - list endpoints return file metadata without content,
 * - only the owner can PATCH or DELETE a gist (others get 404),
 * - secret gists are not listed under /users/:login/gists,
 * - CORS headers are sent, and preflight requests are answered.
 *
 * The sandbox that runs these tests cannot reach api.github.com, so this
 * mock is how the storage layer is exercised in a real browser.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'X-OAuth-Scopes, X-RateLimit-Remaining',
}

export function createGitHubMock({ users }) {
  // users: { [token]: { login, name, avatar_url, scopes } }
  const gists = new Map()
  const calls = []
  let seq = 0

  const byLogin = (login) =>
    Object.values(users).find((u) => u.login.toLowerCase() === login.toLowerCase())

  function meta(g) {
    const files = {}
    for (const [name, f] of Object.entries(g.files)) {
      files[name] = { filename: name, size: f.content.length, raw_url: `https://gist.githubusercontent.com/${g.owner.login}/${g.id}/raw/${name}` }
    }
    return { id: g.id, description: g.description, public: g.public, created_at: g.created_at, updated_at: g.updated_at, owner: { login: g.owner.login }, files }
  }

  function full(g) {
    const m = meta(g)
    for (const [name, f] of Object.entries(g.files)) {
      m.files[name] = { ...m.files[name], content: f.content, truncated: false }
    }
    return m
  }

  async function handle(route) {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const auth = req.headers()['authorization'] ?? ''
    const token = auth.replace(/^Bearer\s+/i, '') || null
    const me = token ? users[token] : null
    const reply = (status, body, headers = {}) =>
      route.fulfill({
        status,
        headers: { ...CORS, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? '' : JSON.stringify(body),
      })

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    calls.push({ method, path: url.pathname, token })
    if (token && !me) return reply(401, { message: 'Bad credentials' })

    const p = url.pathname
    let m
    if (p === '/user' && method === 'GET') {
      if (!me) return reply(401, { message: 'Requires authentication' })
      const headers = me.scopes === null ? {} : { 'X-OAuth-Scopes': me.scopes.join(', ') }
      return reply(200, { login: me.login, name: me.name, avatar_url: me.avatar_url }, headers)
    }
    if ((m = /^\/users\/([^/]+)$/.exec(p)) && method === 'GET') {
      const u = byLogin(decodeURIComponent(m[1]))
      return u ? reply(200, { login: u.login, name: u.name, avatar_url: u.avatar_url }) : reply(404, { message: 'Not Found' })
    }
    if ((m = /^\/users\/([^/]+)\/gists$/.exec(p)) && method === 'GET') {
      const login = decodeURIComponent(m[1]).toLowerCase()
      const list = [...gists.values()].filter((g) => g.owner.login.toLowerCase() === login && g.public)
      return reply(200, list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(meta))
    }
    if (p === '/gists' && method === 'GET') {
      if (!me) return reply(401, { message: 'Requires authentication' })
      const list = [...gists.values()].filter((g) => g.owner.login === me.login)
      return reply(200, list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(meta))
    }
    if (p === '/gists' && method === 'POST') {
      if (!me) return reply(401, { message: 'Requires authentication' })
      if (me.scopes && !me.scopes.includes('gist')) return reply(404, { message: 'Not Found' })
      const body = JSON.parse(req.postData() ?? '{}')
      const now = new Date(Date.now() + seq).toISOString()
      const id = (++seq).toString(16).padStart(32, 'a')
      const files = {}
      for (const [name, f] of Object.entries(body.files ?? {})) files[name] = { content: f.content }
      const g = { id, description: body.description ?? '', public: body.public !== false, created_at: now, updated_at: now, owner: { login: me.login }, files }
      gists.set(id, g)
      return reply(201, full(g))
    }
    if ((m = /^\/gists\/([^/]+)$/.exec(p))) {
      const g = gists.get(m[1])
      if (!g) return reply(404, { message: 'Not Found' })
      if (method === 'GET') {
        if (!g.public && (!me || me.login !== g.owner.login)) return reply(404, { message: 'Not Found' })
        return reply(200, full(g))
      }
      if (!me || me.login !== g.owner.login) return reply(404, { message: 'Not Found' })
      if (method === 'PATCH') {
        const body = JSON.parse(req.postData() ?? '{}')
        if (typeof body.description === 'string') g.description = body.description
        for (const [name, f] of Object.entries(body.files ?? {})) {
          if (f === null) delete g.files[name]
          else g.files[name] = { content: f.content }
        }
        g.updated_at = new Date(Date.now() + ++seq).toISOString()
        return reply(200, full(g))
      }
      if (method === 'DELETE') {
        gists.delete(g.id)
        return route.fulfill({ status: 204, headers: CORS })
      }
    }
    return reply(404, { message: 'Not Found' })
  }

  async function handleRaw(route) {
    const url = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const [, , id, , name] = url.pathname.split('/')
    const g = gists.get(id)
    const f = g?.files[decodeURIComponent(name ?? '')]
    calls.push({ method: 'GET', path: `raw:${url.pathname}`, token: null })
    if (!g || !f) return route.fulfill({ status: 404, headers: CORS, body: '404: Not Found' })
    return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' }, body: f.content })
  }

  async function install(context) {
    await context.route('https://api.github.com/**', handle)
    await context.route('https://gist.githubusercontent.com/**', handleRaw)
  }

  return { gists, calls, install, handle }
}
