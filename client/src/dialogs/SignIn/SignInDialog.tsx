import { useState, useRef, useEffect, useId } from 'react'
import { FormattedMessage, useIntl, type MessageValue } from 'react-intl'

import { brand } from '@sts-street/branding'
import {
  AuthRequestError,
  getAuthMethods,
  goEmailSignIn,
  goPasswordSignIn,
  goPasswordSignUp,
  goProviderSignIn,
  requestPasswordReset,
  type AuthMethods,
} from '~/src/app/routing.js'
import { Button } from '~/src/ui/Button.js'
import { Icon } from '~/src/ui/Icon.js'
import { LoadingSpinner } from '~/src/ui/LoadingSpinner.js'
import { STATIC_MODE } from '~/src/static/env.js'
import { Dialog } from '../Dialog.js'
import { GitHubSignInDialog } from './GitHubSignInDialog.js'
import './SignInDialog.css'

type Panel = 'sign-in' | 'sign-up' | 'forgot'

const DEFAULT_METHODS: AuthMethods = {
  password: true,
  signUp: true,
  magicLink: false,
  passwordReset: false,
  passwordMinLength: 10,
  providers: [],
}

export function SignInDialog() {
  return STATIC_MODE ? <GitHubSignInDialog /> : <ServerSignInDialog />
}

function ServerSignInDialog() {
  const [methods, setMethods] = useState<AuthMethods>(DEFAULT_METHODS)
  const [panel, setPanel] = useState<Panel>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailInputEl = useRef<HTMLInputElement>(null)
  const emailInputId = useId()
  const passwordInputId = useId()
  const nicknameInputId = useId()
  const intl = useIntl()

  useEffect(() => {
    emailInputEl.current?.focus()
  }, [panel])

  useEffect(() => {
    let cancelled = false
    getAuthMethods()
      .then((result) => {
        if (!cancelled) setMethods(result)
      })
      .catch(() => {
        // Keep defaults; the server will validate anyway.
      })
    return () => {
      cancelled = true
    }
  }, [])

  function describeError(err: unknown): string {
    if (err instanceof AuthRequestError) {
      switch (err.code) {
        case 'invalid_credentials':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.invalid-credentials',
            defaultMessage: 'Incorrect email or password. Please try again.',
          })
        case 'email_taken':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.email-taken',
            defaultMessage:
              'An account with this email already exists. Please sign in instead.',
          })
        case 'nickname_taken':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.nickname-taken',
            defaultMessage: 'This username is already taken.',
          })
        case 'nickname_invalid':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.nickname-invalid',
            defaultMessage:
              'Usernames may contain lowercase letters, numbers, “-” and “_” (2–24 characters).',
          })
        case 'password_too_short':
          return intl.formatMessage<{ readonly count: MessageValue }>(
            {
              id: 'dialogs.sign-in.error.password-too-short',
              defaultMessage: 'Passwords must be at least {count} characters long.',
            },
            { count: methods.passwordMinLength }
          )
        case 'password_too_common':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.password-too-common',
            defaultMessage: 'That password is too common. Please choose another one.',
          })
        case 'locked':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.locked',
            defaultMessage:
              'Too many failed attempts. Please wait a few minutes and try again.',
          })
        case 'mail_unavailable':
          return intl.formatMessage({
            id: 'dialogs.sign-in.error.mail-unavailable',
            defaultMessage: 'Email delivery is not available on this server.',
          })
        default:
          if (err.status === 429) {
            return intl.formatMessage({
              id: 'dialogs.sign-in.error.rate-limited',
              defaultMessage: 'Too many attempts. Please try again later.',
            })
          }
          return err.message
      }
    }
    return intl.formatMessage({
      id: 'dialogs.sign-in.error.generic',
      defaultMessage: 'Something went wrong. Please try again.',
    })
  }

  async function run(task: () => Promise<void>, onDone?: () => void) {
    setPending(true)
    setError(null)
    try {
      await task()
      onDone?.()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setPending(false)
    }
  }

  function handleProviderSignIn(providerKey: string): void {
    setSigningIn(true)
    goProviderSignIn(providerKey)
  }

  function handleMagicLink(event: React.MouseEvent): void {
    event.preventDefault()
    if (!email) {
      emailInputEl.current?.reportValidity()
      return
    }
    run(() => goEmailSignIn(email), () => setEmailSent(true))
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    switch (panel) {
      case 'sign-in':
        run(async () => {
          setSigningIn(true)
          try {
            await goPasswordSignIn(email, password)
          } catch (err) {
            setSigningIn(false)
            throw err
          }
        })
        break
      case 'sign-up':
        run(async () => {
          setSigningIn(true)
          try {
            await goPasswordSignUp(email, password, nickname || undefined)
          } catch (err) {
            setSigningIn(false)
            throw err
          }
        })
        break
      case 'forgot':
        run(() => requestPasswordReset(email), () => setResetSent(true))
        break
    }
  }

  function switchPanel(next: Panel): void {
    setPanel(next)
    setError(null)
    setPassword('')
    setResetSent(false)
  }

  if (signingIn) {
    return (
      <Dialog>
        {() => (
          <div className="sign-in-dialog">
            <header>
              <h1>
                <FormattedMessage
                  id="dialogs.sign-in.loading-message"
                  defaultMessage="Signing you in…"
                />
              </h1>
            </header>
            <div
              className="dialog-content sign-in-loading"
              aria-live="polite"
              aria-busy="true"
            >
              <LoadingSpinner />
            </div>
          </div>
        )}
      </Dialog>
    )
  }

  if (emailSent) {
    return (
      <Dialog>
        {() => (
          <div className="sign-in-dialog">
            <header>
              <h1>
                <FormattedMessage
                  id="dialogs.sign-in.check-email"
                  defaultMessage="Check your email"
                />
              </h1>
            </header>
            <div className="dialog-content sign-in-email-sent">
              <p>
                <FormattedMessage
                  id="dialogs.sign-in.sent-message-with-email"
                  defaultMessage="We’ve sent an email to {email}. Please follow the instructions there to continue signing in!"
                  values={{
                    email: <span className="sign-in-email">{email}</span>,
                  }}
                />
              </p>
              <p className="sign-in-resend">
                <FormattedMessage
                  id="dialogs.sign-in.email-unreceived"
                  defaultMessage="Didn’t receive it?"
                />
                <br />
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setEmailSent(false)
                  }}
                >
                  <FormattedMessage
                    id="dialogs.sign-in.resend-email"
                    defaultMessage="Resend email"
                  />
                </a>
              </p>
            </div>
          </div>
        )}
      </Dialog>
    )
  }

  const heading =
    panel === 'sign-up' ? (
      <FormattedMessage
        id="dialogs.sign-in.heading-sign-up"
        defaultMessage="Create an account"
      />
    ) : panel === 'forgot' ? (
      <FormattedMessage
        id="dialogs.sign-in.heading-forgot"
        defaultMessage="Reset your password"
      />
    ) : (
      <FormattedMessage
        id="dialogs.sign-in.heading"
        defaultMessage="Sign in / Sign up"
      />
    )

  return (
    <Dialog>
      {() => (
        <div className="sign-in-dialog">
          <header>
            <h1>{heading}</h1>
          </header>
          <div className="dialog-content">
            {panel === 'sign-in' && (
              <p>
                <FormattedMessage
                  id="dialogs.sign-in.description"
                  defaultMessage="Save your first design or sign in to access your past designs."
                />
              </p>
            )}
            {panel === 'forgot' && (
              <p>
                <FormattedMessage
                  id="dialogs.sign-in.forgot-description"
                  defaultMessage="Enter your email address and we’ll send you a link to choose a new password."
                />
              </p>
            )}

            <form onSubmit={handleSubmit} className="sign-in-form">
              <label htmlFor={emailInputId} className="sign-in-email-label">
                <FormattedMessage
                  id="dialogs.sign-in.email-label"
                  defaultMessage="Email"
                />
              </label>
              <input
                type="email"
                id={emailInputId}
                ref={emailInputEl}
                value={email}
                className={'sign-in-input ' + (error ? 'sign-in-input-error' : '')}
                name="email"
                autoComplete="email"
                spellCheck={false}
                onChange={(e) => setEmail(e.target.value)}
                // eslint-disable-next-line formatjs/no-literal-string-in-jsx
                placeholder="name@example.com"
                required
              />

              {panel === 'sign-up' && (
                <>
                  <label htmlFor={nicknameInputId} className="sign-in-email-label">
                    <FormattedMessage
                      id="dialogs.sign-in.username-label"
                      defaultMessage="Username (optional)"
                    />
                  </label>
                  <input
                    type="text"
                    id={nicknameInputId}
                    value={nickname}
                    className="sign-in-input"
                    name="username"
                    autoComplete="username"
                    spellCheck={false}
                    pattern="[a-z0-9][a-z0-9_\-]{1,23}"
                    onChange={(e) => setNickname(e.target.value.toLowerCase())}
                    // eslint-disable-next-line formatjs/no-literal-string-in-jsx
                    placeholder="e.g. giorgi-k"
                  />
                  <p className="sign-in-email-password-note">
                    <small>
                      <FormattedMessage
                        id="dialogs.sign-in.username-description"
                        defaultMessage="Your username appears in the links to your streets."
                      />
                    </small>
                  </p>
                </>
              )}

              {panel !== 'forgot' && methods.password && (
                <>
                  <label htmlFor={passwordInputId} className="sign-in-email-label">
                    <FormattedMessage
                      id="dialogs.sign-in.password-label"
                      defaultMessage="Password"
                    />
                  </label>
                  <input
                    type="password"
                    id={passwordInputId}
                    value={password}
                    className={'sign-in-input ' + (error ? 'sign-in-input-error' : '')}
                    name="password"
                    autoComplete={panel === 'sign-up' ? 'new-password' : 'current-password'}
                    minLength={panel === 'sign-up' ? methods.passwordMinLength : undefined}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {panel === 'sign-up' && (
                    <p className="sign-in-email-password-note">
                      <small>
                        <FormattedMessage
                          id="dialogs.sign-in.password-description"
                          defaultMessage="Use at least {count} characters."
                          values={{ count: methods.passwordMinLength }}
                        />
                      </small>
                    </p>
                  )}
                </>
              )}

              {error && <p className="sign-in-error-message">{error}</p>}
              {resetSent && (
                <p className="sign-in-success-message">
                  <FormattedMessage
                    id="dialogs.sign-in.reset-sent"
                    defaultMessage="If an account exists for this email, a password reset link has been sent."
                  />
                </p>
              )}

              {panel === 'sign-in' && methods.password && (
                <Button
                  type="submit"
                  primary
                  disabled={pending}
                  className="sign-in-button sign-in-email-button"
                >
                  <FormattedMessage
                    id="dialogs.sign-in.button.password"
                    defaultMessage="Sign in"
                  />
                </Button>
              )}
              {panel === 'sign-up' && (
                <Button
                  type="submit"
                  primary
                  disabled={pending}
                  className="sign-in-button sign-in-email-button"
                >
                  <FormattedMessage
                    id="dialogs.sign-in.button.sign-up"
                    defaultMessage="Create account"
                  />
                </Button>
              )}
              {panel === 'forgot' && (
                <Button
                  type="submit"
                  primary
                  disabled={pending || resetSent}
                  className="sign-in-button sign-in-email-button"
                >
                  <FormattedMessage
                    id="dialogs.sign-in.button.send-reset"
                    defaultMessage="Send reset link"
                  />
                </Button>
              )}

              {panel === 'sign-in' && methods.magicLink && (
                <Button
                  type="button"
                  tertiary
                  disabled={pending}
                  className="sign-in-button sign-in-email-button sign-in-magic-link-button"
                  onClick={handleMagicLink}
                >
                  <Icon name="mail" />
                  <FormattedMessage
                    id="dialogs.sign-in.button.email"
                    defaultMessage="Email me a sign-in link instead"
                  />
                </Button>
              )}
            </form>

            <div className="sign-in-links">
              {panel === 'sign-in' && (
                <>
                  {methods.signUp && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        switchPanel('sign-up')
                      }}
                    >
                      <FormattedMessage
                        id="dialogs.sign-in.link.sign-up"
                        defaultMessage="New here? Create an account"
                      />
                    </a>
                  )}
                  {methods.passwordReset && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        switchPanel('forgot')
                      }}
                    >
                      <FormattedMessage
                        id="dialogs.sign-in.link.forgot"
                        defaultMessage="Forgot your password?"
                      />
                    </a>
                  )}
                </>
              )}
              {panel !== 'sign-in' && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    switchPanel('sign-in')
                  }}
                >
                  <FormattedMessage
                    id="dialogs.sign-in.link.back"
                    defaultMessage="Back to sign in"
                  />
                </a>
              )}
            </div>

            {panel === 'sign-in' && methods.providers.length > 0 && (
              <>
                <div className="sign-in-social-heading">
                  <hr />
                  <span>
                    <FormattedMessage
                      id="dialogs.sign-in.social-heading"
                      defaultMessage="or"
                    />
                  </span>
                </div>
                {methods.providers.map((provider) => (
                  <Button
                    key={provider.key}
                    tertiary
                    className={`sign-in-button sign-in-social-button sign-in-${provider.key}-button`}
                    onClick={() => handleProviderSignIn(provider.key)}
                  >
                    <Icon name={provider.key === 'google' ? 'google' : 'user'} />
                    <FormattedMessage
                      id="dialogs.sign-in.button.provider"
                      defaultMessage="Continue with {provider}"
                      values={{ provider: provider.label }}
                    />
                  </Button>
                ))}
              </>
            )}
          </div>

          <footer>
            <p className="sign-in-disclaimer">
              <FormattedMessage
                id="dialogs.sign-in.tos"
                defaultMessage="By clicking one of these buttons, I agree to the {tosLink} and {privacyLink}."
                values={{
                  tosLink: (
                    <a href={brand.termsOfServiceUrl} target="_blank">
                      <FormattedMessage
                        id="dialogs.sign-in.tos-link-label"
                        defaultMessage="terms of service"
                      />
                    </a>
                  ),
                  privacyLink: (
                    <a href={brand.privacyPolicyUrl} target="_blank">
                      <FormattedMessage
                        id="dialogs.sign-in.privacy-link-label"
                        defaultMessage="privacy policy"
                      />
                    </a>
                  ),
                }}
              />
            </p>
          </footer>
        </div>
      )}
    </Dialog>
  )
}
