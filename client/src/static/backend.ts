/**
 * In-browser implementation of the STS Street HTTP API for the static
 * (GitHub Pages) deployment.
 *
 * The client keeps calling the same `/api/v1/*` and `/services/*` URLs it
 * uses with the Node server. `install.ts` routes those requests here, and
 * this module answers them from:
 *
 * - GitHub Gists owned by the signed-in GitHub user (streets and settings),
 * - static files published with the site (translations, membership list,
 *   changelog),
 * - this browser's localStorage, for people who are not signed in.
 *
 * Permissions are enforced by GitHub itself: only the owner of a gist can
 * change or delete it. The checks below mirror the server's status codes so
 * the client shows the same messages.
 */
import { brand } from '@sts-street/branding'

import {
  GitHubClient,
  GitHubError,
  SETTINGS_FILE,
  getStreetNamespacedId,
  streetFileName,
  type FetchLike,
  type Gist,
} from './github.js'
import { LocalStreetStore } from './local_store.js'
import {
  clearGitHubSession,
  getGitHubSession,
  normalizeLogin,
  setGitHubSession,
  type GitHubSession,
} from './session.js'
import { withBase } from './env.js'

import type {
  StreetAPIPayload,
  StreetAPIResponse,
  GalleryAPIResponse,
} from '@streetmix/types'

export interface BackendRequest {
  method: string
  url: URL
  headers: Headers
  body: string | null
}

export interface StaticBackendOptions {
  /** The browser's original fetch (before install.ts wraps it). */
  fetchImpl: FetchLike
  /** Base path the site is published under ('' for the domain root). */
  base: string
  storage: Storage
  /** Minimum delay between two writes of the same street to GitHub. */
  writeIntervalMs?: number
  githubApi?: string
}

interface StoredStreet {
  format: 'sts-street/1'
  namespacedId: number
  name: string | null
  clientUpdatedAt: string
  originalStreetId: string | null
  data: StreetAPIResponse['data']
}

interface Members {
  plus: string[]
  admin: string[]
}

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const RESOURCES = new Set(['main', 'segment-info'])
const GALLERY_DEFAULT_LIMIT = 100
const GALLERY_MAX_LIMIT = 200
/** Gist ids are hexadecimal; local street ids are UUIDs (with dashes). */
const GIST_ID_PATTERN = /^[0-9a-f]{20,40}$/i
/**
 * Reserved account name for the built-in examples gallery. It is never
 * resolved against GitHub, so a GitHub user with this login cannot inject
 * content into the Examples gallery.
 */
const EXAMPLES_USER = 'examples'

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function error(status: number, msg: string) {
  return json(status, { status, msg })
}

function noContent(headers: HeadersInit = {}) {
  return new Response(null, { status: 204, headers })
}

function fromGitHubError(err: unknown, notFound = 'Not found.') {
  if (err instanceof GitHubError) {
    if (err.rateLimited) {
      return error(
        503,
        'GitHub API rate limit reached. Sign in with GitHub or try again later.'
      )
    }
    if (err.status === 404) return error(404, notFound)
    if (err.status === 401) return error(401, 'GitHub sign-in expired.')
    if (err.status === 403) return error(403, 'GitHub refused this request.')
    if (err.status === 0) return error(503, 'GitHub is unreachable.')
    return error(502, err.message)
  }
  return error(500, 'Unexpected error.')
}

function parseBody<T>(body: string | null): T | null {
  if (!body) return null
  try {
    return JSON.parse(body) as T
  } catch {
    return null
  }
}

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for very old browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function gistDescription(name: string | null): string {
  return `${brand.productName}: ${name || 'Unnamed street'}`
}

export function gistToStreet(gist: Gist, content: string): StreetAPIResponse {
  const stored = JSON.parse(content) as Partial<StoredStreet>
  const namespacedId = getStreetNamespacedId(gist) ?? stored.namespacedId ?? 0
  return {
    id: gist.id,
    namespacedId,
    name: stored.name ?? null,
    clientUpdatedAt: stored.clientUpdatedAt ?? gist.updated_at,
    data: stored.data as StreetAPIResponse['data'],
    createdAt: gist.created_at,
    updatedAt: gist.updated_at,
    originalStreetId: stored.originalStreetId ?? null,
    // Ownership comes from GitHub, never from file content.
    creatorId: gist.owner?.login ? normalizeLogin(gist.owner.login) : null,
  }
}

function serializeStreet(
  namespacedId: number,
  payload: Partial<StreetAPIPayload>,
  previous?: StreetAPIResponse
): string {
  const stored: StoredStreet = {
    format: 'sts-street/1',
    namespacedId,
    name:
      typeof payload.name !== 'undefined'
        ? payload.name
        : (previous?.name ?? null),
    clientUpdatedAt:
      payload.clientUpdatedAt ??
      previous?.clientUpdatedAt ??
      new Date().toISOString(),
    originalStreetId:
      payload.originalStreetId ?? previous?.originalStreetId ?? null,
    data: (payload.data ?? previous?.data) as StoredStreet['data'],
  }
  return JSON.stringify(stored, null, 1)
}

interface PendingWrite {
  payload: Partial<StreetAPIPayload>
  waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }>
}

export function createStaticBackend(options: StaticBackendOptions) {
  const github = new GitHubClient(options.fetchImpl, options.githubApi)
  const local = new LocalStreetStore(options.storage)
  const writeInterval = options.writeIntervalMs ?? 2000

  const streetCache = new Map<string, StreetAPIResponse>()
  const lookupCache = new Map<string, string>() // `${login}/${n}` -> gist id
  const profileCache = new Map<string, { name: string | null; avatar: string | null }>()
  let membersPromise: Promise<Members> | null = null
  let examplesPromise: Promise<StreetAPIResponse[]> | null = null

  // Coalesced writes: at most one GitHub write per street per interval.
  const pending = new Map<string, PendingWrite>()
  const inflight = new Map<string, Promise<void>>()
  const lastWrite = new Map<string, number>()

  function session(): GitHubSession | null {
    return getGitHubSession()
  }

  async function loadMembers(): Promise<Members> {
    membersPromise ??= (async () => {
      try {
        const res = await options.fetchImpl(withBase('/data/members.json', options.base), {
          cache: 'no-store',
        })
        if (!res.ok) return { plus: [], admin: [] }
        const data = (await res.json()) as Partial<Members>
        return {
          plus: (data.plus ?? []).map(normalizeLogin),
          admin: (data.admin ?? []).map(normalizeLogin),
        }
      } catch {
        return { plus: [], admin: [] }
      }
    })()
    return await membersPromise
  }

  /** Built-in example streets (public/data/examples.json). */
  async function loadExamples(): Promise<StreetAPIResponse[]> {
    examplesPromise ??= (async () => {
      try {
        const res = await options.fetchImpl(withBase('/data/examples.json', options.base))
        if (!res.ok) return []
        const data = (await res.json()) as { streets?: StreetAPIResponse[] }
        return data.streets ?? []
      } catch {
        return []
      }
    })()
    return await examplesPromise
  }

  async function rolesFor(login: string): Promise<string[]> {
    const members = await loadMembers()
    const roles = ['USER']
    if (members.plus.includes(login) || members.admin.includes(login)) {
      roles.push('SUBSCRIBER_1')
    }
    if (members.admin.includes(login)) roles.push('ADMIN')
    return roles
  }

  function isSelf(login: string): boolean {
    const s = session()
    return s !== null && normalizeLogin(s.login) === normalizeLogin(login)
  }

  // ---------------------------------------------------------------------
  // Settings (stored in a secret gist, mirrored in localStorage)

  function settingsKey(login: string) {
    return `sts-street:settings:${normalizeLogin(login)}`
  }

  function settingsGistKey(login: string) {
    return `sts-street:settings-gist:${normalizeLogin(login)}`
  }

  async function findSettingsGist(s: GitHubSession): Promise<Gist | null> {
    const cachedId = options.storage.getItem(settingsGistKey(s.login))
    if (cachedId) {
      try {
        return await github.getGist(cachedId, s.token)
      } catch (err) {
        if (!(err instanceof GitHubError) || err.status !== 404) throw err
      }
    }
    const gists = await github.listGists(s.login, s.token, true)
    const found = gists.find((g) => g.files && SETTINGS_FILE in g.files)
    if (!found) return null
    options.storage.setItem(settingsGistKey(s.login), found.id)
    return await github.getGist(found.id, s.token)
  }

  async function loadSettings(s: GitHubSession): Promise<object> {
    try {
      const gist = await findSettingsGist(s)
      const file = gist?.files[SETTINGS_FILE]
      if (gist && file) {
        const content = await github.readFile(file)
        options.storage.setItem(settingsKey(s.login), content)
        return JSON.parse(content) as object
      }
    } catch {
      // fall back to the local mirror below
    }
    try {
      return JSON.parse(options.storage.getItem(settingsKey(s.login)) ?? '{}')
    } catch {
      return {}
    }
  }

  async function saveSettings(s: GitHubSession, data: unknown): Promise<void> {
    const content = JSON.stringify(data ?? {}, null, 1)
    options.storage.setItem(settingsKey(s.login), content)
    const gist = await findSettingsGist(s)
    if (gist) {
      await github.updateGist(gist.id, { files: { [SETTINGS_FILE]: { content } } }, s.token)
    } else {
      const created = await github.createGist(
        {
          description: `${brand.productName} settings`,
          public: false,
          files: { [SETTINGS_FILE]: { content } },
        },
        s.token
      )
      options.storage.setItem(settingsGistKey(s.login), created.id)
    }
  }

  // ---------------------------------------------------------------------
  // Streets

  async function ownStreetGists(s: GitHubSession): Promise<Gist[]> {
    const gists = await github.listGists(s.login, s.token, true)
    return gists.filter((g) => getStreetNamespacedId(g) !== null)
  }

  async function userStreetGists(login: string): Promise<Gist[]> {
    const s = session()
    if (s && isSelf(login)) return await ownStreetGists(s)
    const gists = await github.listGists(login, s?.token ?? null, false)
    return gists.filter((g) => getStreetNamespacedId(g) !== null)
  }

  async function loadGistStreet(id: string): Promise<StreetAPIResponse> {
    const s = session()
    const gist = await github.getGist(id, s?.token ?? null)
    const n = getStreetNamespacedId(gist)
    if (n === null) throw new GitHubError(404, 'Not a street')
    const file = gist.files[streetFileName(n)]
    if (!file) throw new GitHubError(404, 'Not a street')
    const street = gistToStreet(gist, await github.readFile(file))
    streetCache.set(id, street)
    if (street.creatorId) lookupCache.set(`${street.creatorId}/${n}`, id)
    return street
  }

  async function createStreet(payload: StreetAPIPayload | null) {
    const body = payload ?? ({} as StreetAPIPayload)
    const s = session()
    const now = new Date().toISOString()

    if (!s) {
      const street: StreetAPIResponse = {
        id: randomUUID(),
        namespacedId: local.nextNamespacedId(),
        name: body.name ?? null,
        clientUpdatedAt: body.clientUpdatedAt ?? now,
        data: body.data,
        createdAt: now,
        updatedAt: now,
        originalStreetId: body.originalStreetId ?? null,
        creatorId: null,
      }
      local.put(street)
      return json(201, street, { Location: `/api/v1/streets/${street.id}` })
    }

    try {
      const existing = await ownStreetGists(s)
      const max = existing.reduce(
        (acc, g) => Math.max(acc, getStreetNamespacedId(g) ?? 0),
        0
      )
      const namespacedId = max + 1
      const gist = await github.createGist(
        {
          description: gistDescription(body.name ?? null),
          public: true,
          files: {
            [streetFileName(namespacedId)]: {
              content: serializeStreet(namespacedId, body),
            },
          },
        },
        s.token
      )
      const street = gistToStreet(
        { ...gist, owner: gist.owner ?? { login: s.login } },
        serializeStreet(namespacedId, body)
      )
      streetCache.set(street.id, street)
      lookupCache.set(`${normalizeLogin(s.login)}/${namespacedId}`, street.id)
      return json(201, street, { Location: `/api/v1/streets/${street.id}` })
    } catch (err) {
      return fromGitHubError(err)
    }
  }

  async function flush(id: string): Promise<void> {
    const job = pending.get(id)
    if (!job) return
    pending.delete(id)
    const s = session()
    try {
      if (!s) throw new GitHubError(401, 'Not signed in')
      const previous = streetCache.get(id) ?? (await loadGistStreet(id))
      const n = previous.namespacedId
      const content = serializeStreet(n, job.payload, previous)
      const nextName =
        typeof job.payload.name !== 'undefined' ? job.payload.name : previous.name
      const gist = await github.updateGist(
        id,
        {
          description: gistDescription(nextName),
          files: { [streetFileName(n)]: { content } },
        },
        s.token
      )
      streetCache.set(id, gistToStreet({ ...gist, owner: gist.owner ?? { login: s.login } }, content))
      lastWrite.set(id, Date.now())
      job.waiters.forEach((w) => w.resolve())
    } catch (err) {
      job.waiters.forEach((w) => w.reject(err))
    }
  }

  function scheduleWrite(id: string, payload: Partial<StreetAPIPayload>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const job = pending.get(id)
      if (job) {
        // Later edits supersede earlier ones; keep fields that were sent.
        job.payload = { ...job.payload, ...payload }
        job.waiters.push({ resolve, reject })
      } else {
        pending.set(id, { payload, waiters: [{ resolve, reject }] })
      }

      if (inflight.has(id)) return // the running write re-checks on completion

      const run = async () => {
        const wait = Math.max(0, (lastWrite.get(id) ?? 0) + writeInterval - Date.now())
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
        await flush(id)
        inflight.delete(id)
        if (pending.has(id)) {
          inflight.set(id, run())
        }
      }
      inflight.set(id, run())
    })
  }

  async function updateStreet(id: string, payload: Partial<StreetAPIPayload> | null) {
    if (!payload) return error(400, 'Street information not specified.')

    const localStreet = local.get(id)
    if (localStreet) {
      const updated: StreetAPIResponse = {
        ...localStreet,
        name: typeof payload.name !== 'undefined' ? payload.name : localStreet.name,
        data: payload.data ?? localStreet.data,
        clientUpdatedAt: payload.clientUpdatedAt ?? localStreet.clientUpdatedAt,
        originalStreetId: payload.originalStreetId ?? localStreet.originalStreetId,
        updatedAt: new Date().toISOString(),
      }
      local.put(updated)
      return noContent()
    }

    if (!GIST_ID_PATTERN.test(id)) return error(404, 'Street not found.')
    const s = session()
    if (!s) return error(401, 'User is not signed-in.')

    try {
      const existing = streetCache.get(id) ?? (await loadGistStreet(id))
      if (existing.creatorId !== normalizeLogin(s.login)) {
        return error(403, 'Signed-in user cannot update this street.')
      }
      await scheduleWrite(id, payload)
      return noContent()
    } catch (err) {
      return fromGitHubError(err, 'Street not found.')
    }
  }

  async function getStreet(id: string, requestId: string | null) {
    const headers: Record<string, string> = {}
    if (requestId) headers['x-streetmix-request-id'] = requestId
    const localStreet = local.get(id)
    if (localStreet) return json(200, localStreet, headers)
    if (id.startsWith(`${EXAMPLES_USER}-`)) {
      const example = (await loadExamples()).find((x) => x.id === id)
      return example ? json(200, example, headers) : error(404, 'Street not found.')
    }
    if (!GIST_ID_PATTERN.test(id)) return error(404, 'Street not found.')

    // While a write is queued, the freshest copy is the cached one.
    if (pending.has(id) || inflight.has(id)) {
      const cached = streetCache.get(id)
      if (cached) return json(200, cached, headers)
    }
    try {
      return json(200, await loadGistStreet(id), headers)
    } catch (err) {
      const cached = streetCache.get(id)
      if (cached && err instanceof GitHubError && err.rateLimited) {
        return json(200, cached, headers)
      }
      return fromGitHubError(err, 'Street not found.')
    }
  }

  async function deleteStreet(id: string) {
    if (local.delete(id)) return noContent()
    if (!GIST_ID_PATTERN.test(id)) return error(404, 'Street not found.')
    const s = session()
    if (!s) return error(401, 'User is not signed-in.')
    try {
      const existing = streetCache.get(id) ?? (await loadGistStreet(id))
      if (existing.creatorId !== normalizeLogin(s.login)) {
        return error(403, 'Signed-in user cannot delete this street.')
      }
      await github.deleteGist(id, s.token)
      streetCache.delete(id)
      lookupCache.delete(`${existing.creatorId}/${existing.namespacedId}`)
      return noContent()
    } catch (err) {
      return fromGitHubError(err, 'Street not found.')
    }
  }

  async function findStreet(params: URLSearchParams) {
    const namespacedRaw = params.get('namespacedId')
    const creatorRaw = params.get('creatorId')

    if (!namespacedRaw) {
      // Global gallery: there is no global index on GitHub Pages. Show the
      // streets stored in this browser instead.
      return galleryResponse(local.list(), params)
    }

    const namespacedId = Number.parseInt(namespacedRaw, 10)
    if (!Number.isInteger(namespacedId)) return error(400, 'Invalid namespacedId.')

    if (!creatorRaw) {
      const street = local.findByNamespacedId(namespacedId)
      return street ? json(200, street) : error(404, 'Could not find street.')
    }

    const login = normalizeLogin(creatorRaw)
    if (login === EXAMPLES_USER) {
      const example = (await loadExamples()).find((x) => x.namespacedId === namespacedId)
      return example ? json(200, example) : error(404, 'Could not find street.')
    }
    try {
      let gistId = lookupCache.get(`${login}/${namespacedId}`)
      if (!gistId) {
        const gists = await userStreetGists(login)
        const match = gists.find((g) => getStreetNamespacedId(g) === namespacedId)
        if (!match) return error(404, 'Could not find street.')
        gistId = match.id
      }
      return json(200, await loadGistStreet(gistId))
    } catch (err) {
      return fromGitHubError(err, 'Could not find street.')
    }
  }

  function paginate(params: URLSearchParams, total: number) {
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
    const limit = Math.min(
      GALLERY_MAX_LIMIT,
      Math.max(1, Number.parseInt(params.get('limit') ?? '', 10) || GALLERY_DEFAULT_LIMIT)
    )
    const totalPages = Math.max(1, Math.ceil(total / limit))
    return {
      page,
      limit,
      start: (page - 1) * limit,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }
  }

  function galleryResponse(streets: StreetAPIResponse[], params: URLSearchParams) {
    const { start, limit, pagination } = paginate(params, streets.length)
    const body: GalleryAPIResponse = {
      streets: streets.slice(start, start + limit),
      pagination,
    }
    return json(200, body)
  }

  async function userGallery(login: string, params: URLSearchParams) {
    if (normalizeLogin(login) === EXAMPLES_USER) {
      return galleryResponse(await loadExamples(), params)
    }
    try {
      const gists = (await userStreetGists(login)).sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at)
      )
      const { start, limit, pagination } = paginate(params, gists.length)
      const pageGists = gists.slice(start, start + limit)
      const streets = await Promise.all(
        pageGists.map(async (g) => {
          const n = getStreetNamespacedId(g) as number
          const file = g.files[streetFileName(n)]
          if (!file) return null
          try {
            const street = gistToStreet(
              { ...g, owner: g.owner ?? { login } },
              await github.readFile(file)
            )
            lookupCache.set(`${normalizeLogin(login)}/${n}`, g.id)
            return street
          } catch {
            return null
          }
        })
      )
      const body: GalleryAPIResponse = {
        streets: streets.filter((x): x is StreetAPIResponse => x !== null),
        pagination,
      }
      return json(200, body)
    } catch (err) {
      return fromGitHubError(err, 'User not found.')
    }
  }

  async function deleteAllUserStreets(login: string) {
    const s = session()
    if (!s) return error(401, 'User is not signed-in.')
    if (!isSelf(login)) return error(403, 'Cannot delete streets of another user.')
    try {
      const gists = await ownStreetGists(s)
      for (const g of gists) await github.deleteGist(g.id, s.token)
      streetCache.clear()
      lookupCache.clear()
      return noContent()
    } catch (err) {
      return fromGitHubError(err)
    }
  }

  // ---------------------------------------------------------------------
  // Users

  async function getUserProfile(rawLogin: string) {
    const login = normalizeLogin(rawLogin)
    const s = session()
    if (login === EXAMPLES_USER) {
      return json(200, {
        id: EXAMPLES_USER,
        displayName: `${brand.productName} examples`,
        profileImageUrl: '',
        flags: {},
        roles: ['USER'],
        data: {},
      })
    }
    try {
      let name: string | null
      let avatar: string | null
      if (s && isSelf(login)) {
        // Verifies the token is still valid (401 signs the user out) and
        // refreshes the cached name and avatar.
        const me = await github.getAuthenticatedUser(s.token)
        name = me.name
        avatar = me.avatar_url
        setGitHubSession({ ...s, name: me.name, avatarUrl: me.avatar_url })
      } else {
        let cached = profileCache.get(login)
        if (!cached) {
          const user = await github.getUser(login, s?.token ?? null)
          cached = { name: user.name, avatar: user.avatar_url }
          profileCache.set(login, cached)
        }
        name = cached.name
        avatar = cached.avatar
      }
      const profile = {
        id: login,
        displayName: name ?? login,
        profileImageUrl: avatar ?? '',
        flags: {},
        roles: await rolesFor(login),
        data: s && isSelf(login) ? await loadSettings(s) : {},
      }
      return json(200, profile)
    } catch (err) {
      return fromGitHubError(err, 'User not found.')
    }
  }

  async function putUserSettings(login: string, body: unknown) {
    const s = session()
    if (!s) return error(401, 'User is not signed-in.')
    if (!isSelf(login)) return error(403, 'Cannot update another user.')
    try {
      await saveSettings(s, body)
      return noContent()
    } catch (err) {
      return fromGitHubError(err)
    }
  }

  async function deleteAccount(login: string) {
    const s = session()
    if (!s) return error(401, 'User is not signed-in.')
    if (!isSelf(login)) return error(403, 'Cannot delete another user.')
    try {
      const gists = await github.listGists(s.login, s.token, true)
      for (const g of gists) {
        if (getStreetNamespacedId(g) !== null || (g.files && SETTINGS_FILE in g.files)) {
          await github.deleteGist(g.id, s.token)
        }
      }
      options.storage.removeItem(settingsKey(s.login))
      options.storage.removeItem(settingsGistKey(s.login))
      clearGitHubSession()
      return noContent()
    } catch (err) {
      return fromGitHubError(err)
    }
  }

  // ---------------------------------------------------------------------
  // Static resources

  async function translation(locale: string, resource: string) {
    if (!LOCALE_PATTERN.test(locale) || !RESOURCES.has(resource)) {
      return error(400, 'Invalid locale or resource.')
    }
    try {
      const res = await options.fetchImpl(
        withBase(`/locales/${locale}/${resource}.json`, options.base)
      )
      if (!res.ok) return error(404, 'Translation not found.')
      return json(200, await res.json())
    } catch {
      return error(503, 'Could not load translation.')
    }
  }

  async function changelog() {
    try {
      const res = await options.fetchImpl(withBase('/data/changelog.md', options.base))
      if (!res.ok) return error(404, 'Changelog not found.')
      return new Response(await res.text(), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch {
      return error(503, 'Could not retrieve changelog.')
    }
  }

  function authConfig() {
    return json(200, {
      password: false,
      signUp: false,
      magicLink: false,
      passwordReset: false,
      passwordMinLength: 0,
      providers: [],
      github: true,
    })
  }

  // ---------------------------------------------------------------------
  // Router

  async function handle(req: BackendRequest): Promise<Response> {
    const method = req.method.toUpperCase()
    const path = req.url.pathname.replace(/\/+$/, '') || '/'
    const params = req.url.searchParams
    let m: RegExpExecArray | null

    // Translations
    if ((m = /^\/api\/v1\/translate\/([^/]+)\/([^/]+)$/.exec(path)) && method === 'GET') {
      return await translation(decodeURIComponent(m[1]), decodeURIComponent(m[2]))
    }

    // Streets
    if (path === '/api/v1/streets') {
      if (method === 'POST') return await createStreet(parseBody<StreetAPIPayload>(req.body))
      if (method === 'GET') return await findStreet(params)
    }
    if (/^\/api\/v1\/streets\/([^/]+)\/remixes$/.test(path)) {
      return error(501, 'Remix exports are not available on this deployment.')
    }
    if (/^\/api\/v1\/streets\/([^/]+)\/image$/.test(path)) {
      return error(501, 'Server image export is not available on this deployment.')
    }
    if ((m = /^\/api\/v1\/streets\/([^/]+)$/.exec(path))) {
      const id = decodeURIComponent(m[1])
      if (method === 'GET') return await getStreet(id, req.headers.get('x-streetmix-request-id'))
      if (method === 'PUT') return await updateStreet(id, parseBody<StreetAPIPayload>(req.body))
      if (method === 'DELETE') return await deleteStreet(id)
    }

    // Users
    if ((m = /^\/api\/v1\/users\/([^/]+)\/streets$/.exec(path))) {
      const login = decodeURIComponent(m[1])
      if (method === 'GET') return await userGallery(login, params)
      if (method === 'DELETE') return await deleteAllUserStreets(login)
    }
    if (/^\/api\/v1\/users\/([^/]+)\/login-token$/.test(path) && method === 'DELETE') {
      clearGitHubSession()
      return noContent()
    }
    if ((m = /^\/api\/v1\/users\/([^/]+)$/.exec(path))) {
      const login = decodeURIComponent(m[1])
      if (method === 'GET') return await getUserProfile(login)
      if (method === 'PUT') return await putUserSettings(login, parseBody(req.body))
      if (method === 'PATCH') {
        return error(409, 'Your display name comes from your GitHub profile.')
      }
      if (method === 'DELETE') return await deleteAccount(login)
    }
    if (path === '/api/v1/users') return error(403, 'Not available.')
    if (path.startsWith('/api/v1/votes')) {
      return error(404, 'Surveys are not available on this deployment.')
    }

    // Services
    if (path === '/services/changelog') return await changelog()
    // 404 (not 5xx) so the client's retry logic does not treat these as outages
    if (path === '/services/geoip') return error(404, 'Geolocation is not available.')
    if (path === '/services/newsletter') {
      return error(404, 'Newsletter sign-up is not available on this deployment.')
    }
    if (path === '/services/auth/config') return authConfig()
    if (path === '/services/auth/logout' || path === '/services/auth/refresh-login-token') {
      if (path.endsWith('logout')) clearGitHubSession()
      return noContent()
    }

    return error(404, 'Not found.')
  }

  return { handle, github, local, loadMembers }
}

export type StaticBackend = ReturnType<typeof createStaticBackend>
