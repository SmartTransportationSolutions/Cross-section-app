import { useState, useId, useEffect, useRef } from 'react'
import { FormattedMessage, useIntl, type MessageValue } from 'react-intl'

import {
  AuthRequestError,
  completePasswordReset,
  getAuthMethods,
} from '~/src/app/routing.js'
import { Button } from '~/src/ui/Button.js'
import { LoadingSpinner } from '~/src/ui/LoadingSpinner.js'
import { Dialog } from '../Dialog.js'
import '../SignIn/SignInDialog.css'

/**
 * Shown when the app is opened at `/reset-password?token=…` from a password
 * reset email. On success the server signs the user in.
 */
export function PasswordResetDialog() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [minLength, setMinLength] = useState(10)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const passwordId = useId()
  const confirmId = useId()
  const intl = useIntl()

  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  useEffect(() => {
    inputRef.current?.focus()
    getAuthMethods()
      .then((m) => setMinLength(m.passwordMinLength))
      .catch(() => {})
  }, [])

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (password !== confirm) {
      setError(
        intl.formatMessage({
          id: 'dialogs.reset-password.mismatch',
          defaultMessage: 'The passwords do not match.',
        })
      )
      return
    }
    setPending(true)
    setError(null)
    try {
      await completePasswordReset(token, password)
    } catch (err) {
      setPending(false)
      if (err instanceof AuthRequestError && err.code === 'token_invalid') {
        setError(
          intl.formatMessage({
            id: 'dialogs.reset-password.expired',
            defaultMessage:
              'This reset link is invalid or has expired. Please request a new one.',
          })
        )
      } else if (err instanceof AuthRequestError && err.code === 'password_too_short') {
        setError(
          intl.formatMessage<{ readonly count: MessageValue }>(
            {
              id: 'dialogs.sign-in.error.password-too-short',
              defaultMessage: 'Passwords must be at least {count} characters long.',
            },
            { count: minLength }
          )
        )
      } else {
        setError(
          err instanceof AuthRequestError
            ? err.message
            : intl.formatMessage({
                id: 'dialogs.sign-in.error.generic',
                defaultMessage: 'Something went wrong. Please try again.',
              })
        )
      }
    }
  }

  return (
    <Dialog>
      {() => (
        <div className="sign-in-dialog">
          <header>
            <h1>
              <FormattedMessage
                id="dialogs.reset-password.heading"
                defaultMessage="Choose a new password"
              />
            </h1>
          </header>
          <div className="dialog-content">
            {pending ? (
              <div className="sign-in-loading" aria-busy="true">
                <LoadingSpinner />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="sign-in-form">
                <label htmlFor={passwordId} className="sign-in-email-label">
                  <FormattedMessage
                    id="dialogs.reset-password.new-password"
                    defaultMessage="New password"
                  />
                </label>
                <input
                  type="password"
                  id={passwordId}
                  ref={inputRef}
                  className="sign-in-input"
                  autoComplete="new-password"
                  minLength={minLength}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor={confirmId} className="sign-in-email-label">
                  <FormattedMessage
                    id="dialogs.reset-password.confirm-password"
                    defaultMessage="Confirm new password"
                  />
                </label>
                <input
                  type="password"
                  id={confirmId}
                  className="sign-in-input"
                  autoComplete="new-password"
                  minLength={minLength}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {error && <p className="sign-in-error-message">{error}</p>}
                <Button type="submit" primary className="sign-in-button sign-in-email-button">
                  <FormattedMessage
                    id="dialogs.reset-password.submit"
                    defaultMessage="Save password and sign in"
                  />
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
