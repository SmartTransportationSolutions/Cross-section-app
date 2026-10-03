/**
 * Sign-in dialog for the static (GitHub Pages) deployment.
 *
 * There is no STS server to hold OAuth client secrets, so people sign in
 * with a GitHub personal access token that can manage gists. The token is
 * kept in this browser and only sent to the GitHub API.
 */
import { useId, useRef, useEffect, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'

import { brand } from '@sts-street/branding'
import { JUST_SIGNED_IN_PATH } from '~/src/app/constants.js'
import { GitHubClient, GitHubError } from '~/src/static/github.js'
import { setGitHubSession } from '~/src/static/session.js'
import { withBase } from '~/src/static/env.js'
import { Button } from '~/src/ui/Button.js'
import { ExternalLink } from '~/src/ui/ExternalLink.js'
import { Dialog } from '../Dialog.js'
import './SignInDialog.css'

const GITHUB_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=STS%20Street'

export function GitHubSignInDialog() {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputEl = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const intl = useIntl()

  useEffect(() => {
    inputEl.current?.focus()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)

    try {
      const github = new GitHubClient((input, init) => window.fetch(input, init))
      const scopes = await github.getTokenScopes(trimmed)
      if (scopes !== null && !scopes.includes('gist')) {
        setError(
          intl.formatMessage({
            id: 'dialogs.sign-in.github.error.scope',
            defaultMessage:
              'This token cannot save gists. Create a token with the “gist” scope.',
          })
        )
        setPending(false)
        return
      }
      const user = await github.getAuthenticatedUser(trimmed)
      setGitHubSession({
        login: user.login,
        token: trimmed,
        name: user.name,
        avatarUrl: user.avatar_url,
      })
      // Same landing page as the server sign-in flow: the app adopts the
      // street you were editing into your account.
      window.location.href = withBase(JUST_SIGNED_IN_PATH)
    } catch (err) {
      setPending(false)
      if (err instanceof GitHubError && (err.status === 401 || err.status === 403)) {
        setError(
          intl.formatMessage({
            id: 'dialogs.sign-in.github.error.invalid',
            defaultMessage: 'GitHub did not accept this token. Please check it and try again.',
          })
        )
      } else {
        setError(
          intl.formatMessage({
            id: 'dialogs.sign-in.github.error.network',
            defaultMessage: 'Could not reach GitHub. Please try again.',
          })
        )
      }
    }
  }

  return (
    <Dialog>
      {() => (
        <div className="sign-in-dialog github-sign-in-dialog">
          <header>
            <h1>
              <FormattedMessage
                id="dialogs.sign-in.github.heading"
                defaultMessage="Sign in with GitHub"
              />
            </h1>
          </header>
          <div className="dialog-content">
            <p>
              <FormattedMessage
                id="dialogs.sign-in.github.description"
                defaultMessage="{productName} saves your streets as public gists in your own GitHub account, so you can open them anywhere and share them with a link."
                values={{ productName: brand.productName }}
              />
            </p>
            <ol className="github-sign-in-steps">
              <li>
                <FormattedMessage
                  id="dialogs.sign-in.github.step-create"
                  defaultMessage="<a>Create a GitHub token</a> with the “gist” scope."
                  values={{
                    a: (chunks) => (
                      <ExternalLink href={GITHUB_TOKEN_URL}>{chunks}</ExternalLink>
                    ),
                  }}
                />
              </li>
              <li>
                <FormattedMessage
                  id="dialogs.sign-in.github.step-paste"
                  defaultMessage="Paste the token below."
                />
              </li>
            </ol>
            <form onSubmit={handleSubmit} className="sign-in-form">
              <label htmlFor={inputId} className="sign-in-email-label">
                <FormattedMessage
                  id="dialogs.sign-in.github.token-label"
                  defaultMessage="GitHub token"
                />
              </label>
              <input
                type="password"
                id={inputId}
                ref={inputEl}
                value={token}
                className={'sign-in-input ' + (error ? 'sign-in-input-error' : '')}
                name="github-token"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <p className="sign-in-email-password-note">
                <small>
                  <FormattedMessage
                    id="dialogs.sign-in.github.token-note"
                    defaultMessage="The token stays in this browser and is only sent to GitHub. Sign out to remove it."
                  />
                </small>
              </p>
              {error && <p className="sign-in-error-message">{error}</p>}
              <Button
                type="submit"
                primary
                disabled={pending}
                className="sign-in-button sign-in-email-button"
              >
                <FormattedMessage
                  id="dialogs.sign-in.github.button"
                  defaultMessage="Sign in"
                />
              </Button>
            </form>
            <p className="sign-in-email-password-note">
              <small>
                <FormattedMessage
                  id="dialogs.sign-in.github.legal"
                  defaultMessage="By signing in you agree to the <tos>terms of service</tos> and <privacy>privacy policy</privacy>. Gists are stored by GitHub under GitHub’s terms."
                  values={{
                    tos: (chunks) => (
                      <ExternalLink href={brand.termsOfServiceUrl}>{chunks}</ExternalLink>
                    ),
                    privacy: (chunks) => (
                      <ExternalLink href={brand.privacyPolicyUrl}>{chunks}</ExternalLink>
                    ),
                  }}
                />
              </small>
            </p>
          </div>
        </div>
      )}
    </Dialog>
  )
}
