import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { render } from '~/test/helpers/render.js'
import { showDialog } from '~/src/store/slices/dialogs.js'
import { ContactMenu } from './ContactMenu.js'

vi.mock('../../store/slices/dialogs.js', () => ({
  default: {},
  showDialog: vi.fn(() => ({ type: 'MOCK_ACTION' })),
}))

describe('ContactMenu', () => {
  it('renders', () => {
    const { asFragment } = render(<ContactMenu isActive />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('links to STS contact destinations', () => {
    render(<ContactMenu isActive />)

    expect(screen.getByText('Email STS').closest('a')).toHaveAttribute(
      'href',
      'mailto:info@sts.com.ge'
    )
    expect(
      screen.getByText('Contact form on STS website').closest('a')
    ).toHaveAttribute('href', 'https://sts.com.ge/contact-us/')
    expect(screen.getByText('View source code').closest('a')).toHaveAttribute(
      'href',
      '/source'
    )
  })

  it('handles clicked menu items', async () => {
    render(<ContactMenu isActive />)

    await userEvent.click(screen.getByText('newsletter', { exact: false }))

    expect(showDialog).toHaveBeenCalledTimes(1)
  })
})
