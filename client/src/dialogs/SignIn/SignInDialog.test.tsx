import { vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { render } from '~/test/helpers/render.js'
import * as routing from '~/src/app/routing.js'
import { SignInDialog } from './SignInDialog.js'

vi.mock('~/src/app/routing.js', async (importOriginal) => {
  const actual = await importOriginal<typeof routing>()
  return {
    ...actual,
    getAuthMethods: vi.fn(async () => ({
      password: true,
      signUp: true,
      magicLink: true,
      passwordReset: true,
      passwordMinLength: 10,
      providers: [{ key: 'google', label: 'Google' }],
    })),
    goPasswordSignIn: vi.fn(async () => undefined),
    goPasswordSignUp: vi.fn(async () => undefined),
    goEmailSignIn: vi.fn(async () => undefined),
    goProviderSignIn: vi.fn(),
  }
})

describe('SignInDialog', () => {
  it('renders email/password sign-in and configured providers', async () => {
    render(<SignInDialog />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Email me a sign-in link instead')
    ).toBeInTheDocument()
  })

  it('submits email and password', async () => {
    const user = userEvent.setup()
    render(<SignInDialog />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(routing.goPasswordSignIn).toHaveBeenCalledWith(
        'test@example.com',
        'correct horse battery'
      )
    })
  })

  it('shows the server error for bad credentials', async () => {
    vi.mocked(routing.goPasswordSignIn).mockRejectedValueOnce(
      new routing.AuthRequestError(401, 'Incorrect email or password.', 'invalid_credentials')
    )
    const user = userEvent.setup()
    render(<SignInDialog />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong password 1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(
        screen.getByText('Incorrect email or password. Please try again.')
      ).toBeInTheDocument()
    })
  })

  it('switches to account creation', async () => {
    const user = userEvent.setup()
    render(<SignInDialog />)

    await waitFor(() => {
      expect(screen.getByText('New here? Create an account')).toBeInTheDocument()
    })
    await user.click(screen.getByText('New here? Create an account'))
    expect(screen.getByLabelText('Username (optional)')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Username (optional)'), 'newbie')
    await user.type(screen.getByLabelText('Password'), 'a long enough password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(routing.goPasswordSignUp).toHaveBeenCalledWith(
        'new@example.com',
        'a long enough password',
        'newbie'
      )
    })
  })

  it('requests a magic link', async () => {
    const user = userEvent.setup()
    render(<SignInDialog />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await waitFor(() => {
      expect(screen.getByText('Email me a sign-in link instead')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Email me a sign-in link instead'))

    await waitFor(() => {
      expect(routing.goEmailSignIn).toHaveBeenCalledWith('test@example.com')
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
  })
})
