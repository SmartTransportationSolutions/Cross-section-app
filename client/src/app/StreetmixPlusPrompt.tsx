import { FormattedMessage } from 'react-intl'

import { useDispatch } from '../store/hooks.js'
import { showDialog } from '../store/slices/dialogs.js'
import { Button } from '../ui/Button.js'
import { Icon } from '../ui/Icon.js'
import './StreetmixPlusPrompt.css'

interface StreetmixPlusPromptProps {
  children: React.ReactNode
}

/**
 * Wraps a locked feature with a "locked" banner and a button that opens the
 * membership dialog (see dialogs/Upgrade). The component name is retained
 * from upstream so that the many call sites stay unchanged.
 */
export function StreetmixPlusPrompt({ children }: StreetmixPlusPromptProps) {
  const dispatch = useDispatch()

  function handleClickUpgrade(event: React.MouseEvent) {
    event.preventDefault()
    dispatch(showDialog('UPGRADE'))
  }

  return (
    <>
      <div className="streetmix-plus-locked-banner">
        <Icon name="lock" />
        <FormattedMessage id="plus.locked.label" defaultMessage="Locked" />
      </div>
      {children}
      <div className="streetmix-plus-prompt">
        <Button onClick={handleClickUpgrade}>
          <FormattedMessage
            id="plus.locked.action"
            defaultMessage="Get STS Street Plus&lrm;"
          />
        </Button>
      </div>
    </>
  )
}
