/**
 * Minimal GitHub REST client used as the data store of the static
 * deployment. Streets are stored as GitHub Gists owned by the signed-in user.
 */
import { GITHUB_API } from './env.js'

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export interface GistFile {
  filename: string
  raw_url?: string
  size?: number
  truncated?: boolean
  content?: string
}

export interface Gist {
  id: string
  description: string | null
  public: boolean
  created_at: string
  updated_at: string
  owner?: { login: string } | null
  files: Record<string, GistFile | null>
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string | null
}

export class GitHubError extends Error {
  status: number
  rateLimited: boolean

  constructor(status: number, message: string, rateLimited = false) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.rateLimited = rateLimited
  }
}

/** File name that marks a gist as an STS Street street. */
export const STREET_FILE_PATTERN = /^sts-street-(\d+)\.json$/
export const SETTINGS_FILE = 'sts-street-settings.json'

export function streetFileName(namespacedId: number): string {
  return `sts-street-${namespacedId}.json`
}

/** Returns the namespaced id encoded in a gist's file names, if any. */
export function getStreetNamespacedId(gist: Pick<Gist, 'files'>): number | null {
  for (const name of Object.keys(gist.files ?? {})) {
    const match = STREET_FILE_PATTERN.exec(name)
    if (match) return Number.parseInt(match[1], 10)
  }
  return null
}

export class GitHubClient {
  private readonly fetchImpl: FetchLike
  private readonly apiRoot: string

  constructor(fetchImpl: FetchLike, apiRoot: string = GITHUB_API) {
    this.fetchImpl = fetchImpl
    this.apiRoot = apiRoot
  }

  async request<T>(
    path: string,
    options: { method?: string; token?: string | null; body?: unknown } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (options.token) headers.Authorization = `Bearer ${options.token}`
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'

    let response: Response
    try {
      response = await this.fetchImpl(`${this.apiRoot}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
      })
    } catch (err) {
      throw new GitHubError(0, `GitHub is unreachable: ${String(err)}`)
    }

    if (response.status === 204) return undefined as T

    let data: unknown = null
    const text = await response.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining')
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 && remaining === '0')
      const message =
        (data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : '') || `GitHub request failed (${response.status})`
      throw new GitHubError(response.status, message, rateLimited)
    }

    return data as T
  }

  getAuthenticatedUser(token: string): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user', { token })
  }

  /**
   * Returns the OAuth scopes of a classic token, or null for token types
   * that do not report scopes (fine-grained tokens).
   */
  async getTokenScopes(token: string): Promise<string[] | null> {
    const response = await this.fetchImpl(`${this.apiRoot}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new GitHubError(response.status, 'GitHub did not accept this token')
    }
    const header = response.headers.get('x-oauth-scopes')
    if (header === null) return null
    return header
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)
  }

  getUser(login: string, token?: string | null): Promise<GitHubUser> {
    return this.request<GitHubUser>(`/users/${encodeURIComponent(login)}`, {
      token,
    })
  }

  /**
   * Lists all gists of a user (following pagination up to `maxPages`).
   * When `own` is true the authenticated endpoint is used, which also
   * returns secret gists.
   */
  async listGists(
    login: string,
    token: string | null,
    own: boolean,
    maxPages = 10
  ): Promise<Gist[]> {
    const all: Gist[] = []
    for (let page = 1; page <= maxPages; page++) {
      const base = own ? '/gists' : `/users/${encodeURIComponent(login)}/gists`
      const batch = await this.request<Gist[]>(
        `${base}?per_page=100&page=${page}`,
        { token }
      )
      all.push(...batch)
      if (batch.length < 100) break
    }
    return all
  }

  getGist(id: string, token?: string | null): Promise<Gist> {
    return this.request<Gist>(`/gists/${encodeURIComponent(id)}`, { token })
  }

  createGist(
    body: {
      description: string
      public: boolean
      files: Record<string, { content: string }>
    },
    token: string
  ): Promise<Gist> {
    return this.request<Gist>('/gists', { method: 'POST', token, body })
  }

  updateGist(
    id: string,
    body: {
      description?: string
      files?: Record<string, { content: string } | null>
    },
    token: string
  ): Promise<Gist> {
    return this.request<Gist>(`/gists/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body,
    })
  }

  deleteGist(id: string, token: string): Promise<void> {
    return this.request<void>(`/gists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    })
  }

  /** Reads a file's content, following raw_url when the API truncated it. */
  async readFile(file: GistFile): Promise<string> {
    if (typeof file.content === 'string' && !file.truncated) return file.content
    if (!file.raw_url) throw new GitHubError(404, 'File content unavailable')
    const response = await this.fetchImpl(file.raw_url, { cache: 'no-store' })
    if (!response.ok) {
      throw new GitHubError(response.status, 'Could not read gist file')
    }
    return await response.text()
  }
}
