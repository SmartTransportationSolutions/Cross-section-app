import { FormattedMessage } from 'react-intl'

import { brand } from '@sts-street/branding'
import { useDispatch } from '~/src/store/hooks.js'
import { showDialog } from '~/src/store/slices/dialogs.js'
import { Icon } from '~/src/ui/Icon.js'
import { STATIC_MODE } from '~/src/static/env.js'
import Menu, { type MenuProps } from './Menu.js'
import { MenuItem } from './MenuItem.js'

export function ContactMenu(props: MenuProps) {
  const dispatch = useDispatch()

  return (
    <Menu {...props}>
      <MenuItem href={`mailto:${brand.supportEmail}`}>
        <Icon name="mail" className="menu-item-icon" />
        <FormattedMessage
          id="menu.contact.email"
          defaultMessage="Email {company}"
          values={{ company: brand.companyShortName }}
        />
      </MenuItem>
      <MenuItem href={brand.contactUrl}>
        <Icon name="external-link" className="menu-item-icon" />
        <FormattedMessage
          id="menu.contact.website"
          defaultMessage="Contact form on {company} website"
          values={{ company: brand.companyShortName }}
        />
      </MenuItem>
      <MenuItem href={brand.sourceUrl}>
        <Icon name="github" className="menu-item-icon" />
        <FormattedMessage
          id="menu.contact.source"
          defaultMessage="View source code"
        />
      </MenuItem>
      {/* The newsletter list needs the STS Street server. */}
      {!STATIC_MODE && (
        <MenuItem
          onClick={() => {
            dispatch(showDialog('NEWSLETTER'))
          }}
        >
          <Icon name="mail" className="menu-item-icon" />
          <FormattedMessage
            id="menu.contact.newsletter"
            defaultMessage="Subscribe to our newsletter"
          />
        </MenuItem>
      )}
    </Menu>
  )
}
