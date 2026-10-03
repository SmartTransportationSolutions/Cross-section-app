import { FormattedMessage } from 'react-intl'

import { brand } from '@sts-street/branding'
import plusIcon from 'url:../ui/icons/streetmix-plus.svg'
import { useDispatch } from '../store/hooks.js'
import { showDialog } from '../store/slices/dialogs.js'
import { Button } from '../ui/Button.js'
import './UpgradeButton.css'

export function UpgradeButton() {
  const dispatch = useDispatch()

  function handleClickUpgrade(): void {
    dispatch(showDialog('UPGRADE'))
  }

  return (
    <Button tertiary className="menu-upgrade" onClick={handleClickUpgrade}>
      <img className="menu-avatar-subscriber" src={plusIcon} alt={brand.plusName} />
      <FormattedMessage
        id="menu.item.streetmix-plus"
        defaultMessage="Get STS Street Plus&lrm;"
      />
    </Button>
  )
}
