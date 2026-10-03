/**
 * GitHub session for the static deployment.
 *
 * The personal access token stays in this browser's localStorage and is only
 * ever sent to the GitHub API. It is never sent to STS or to any other host.
 */

export interface GitHubSession {
  login: string
  token: string
  name: string | null
  avatarUrl: string | null
}

const SESSION_KEY = 'sts-street:github-session'

export function getGitHubSession(): GitHubSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GitHubSession>
    if (typeof parsed.login !== 'string' || typeof parsed.token !== 'string') {
      return null
    }
    return {
      login: parsed.login,
      token: parsed.token,
      name: parsed.name ?? null,
      avatarUrl: parsed.avatarUrl ?? null,
    }
  } catch {
    return null
  }
}

export function setGitHubSession(session: GitHubSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearGitHubSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** User ids in URLs are lower-case; GitHub logins are case-insensitive. */
export function normalizeLogin(login: string): string {
  return login.toLowerCase()
}
