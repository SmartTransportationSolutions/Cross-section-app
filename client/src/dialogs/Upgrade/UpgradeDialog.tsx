import { FormattedMessage } from 'react-intl'

import { brand } from '@sts-street/branding'
import plusIcon from 'url:~/src/ui/icons/streetmix-plus.svg'
import { useSelector, useDispatch } from '~/src/store/hooks.js'
import { showDialog } from '~/src/store/slices/dialogs.js'
import { Button } from '~/src/ui/Button.js'
import { ExternalLink } from '~/src/ui/ExternalLink.js'
import { Icon } from '~/src/ui/Icon.js'
import userRoles from '../../../../app/data/user_roles.json'
import { Dialog } from '../Dialog.js'
import './UpgradeDialog.css'

/**
 * Membership dialog for the "Plus" tier.
 *
 * Membership is granted by the operator (Smart Transportation Solutions):
 * there is no self-service billing in this release, so the dialog explains
 * the features and how to request access. Entitlements are enforced
 * server-side through the SUBSCRIBER_1 role.
 */
export function UpgradeDialog() {
  const signedIn = useSelector((state) => state.user.signedIn)
  const userId = useSelector((state) => state.user.signInData?.userId)
  const roles: string[] = useSelector(
    (state) => state.user.signInData?.details?.roles ?? []
  )
  const dispatch = useDispatch()

  const isMember = roles.includes(userRoles.SUBSCRIBER_1.value)

  const subject = encodeURIComponent(
    `${brand.plusName} membership request${userId ? ` (${userId})` : ''}`
  )
  const requestHref = `mailto:${brand.supportEmail}?subject=${subject}`

  return (
    <Dialog>
      {(closeDialog) => (
        <div className="upgrade-dialog" dir="ltr">
          <header>
            <img src={plusIcon} alt="" className="upgrade-dialog-icon" />
            <h1>{brand.plusName}</h1>
          </header>
          <div className="dialog-content">
            {isMember ? (
              <p className="upgrade-dialog-status upgrade-dialog-status-active">
                <Icon name="check" />
                <FormattedMessage
                  id="upgrade.hasTier1"
                  defaultMessage="Your account has {plusName}. Thank you!"
                  values={{ plusName: brand.plusName }}
                />
              </p>
            ) : (
              <p>
                <FormattedMessage
                  id="upgrade.body"
                  defaultMessage="{plusName} unlocks additional design and export capabilities for professional work."
                  values={{ plusName: brand.plusName }}
                />
              </p>
            )}

            <h3>
              <FormattedMessage
                id="upgrade.features-heading"
                defaultMessage="Included features"
              />
            </h3>
            <ul className="upgrade-dialog-features">
              <li>
                <FormattedMessage
                  id="upgrade.feature.rename"
                  defaultMessage="Rename street elements with custom labels"
                />
              </li>
              <li>
                <FormattedMessage
                  id="upgrade.feature.environment"
                  defaultMessage="Change environment backgrounds (time of day, fog, and more)"
                />
              </li>
              <li>
                <FormattedMessage
                  id="upgrade.feature.watermark"
                  defaultMessage="Export images without the watermark"
                />
              </li>
              <li>
                <FormattedMessage
                  id="upgrade.feature.resolution"
                  defaultMessage="Export images at print-ready resolutions (up to 5×)"
                />
              </li>
              <li>
                <FormattedMessage
                  id="upgrade.feature.elements"
                  defaultMessage="Additional elements: double-decker bus, microvan, autonomous shuttle, mixed-traffic lanes, drainage channel"
                />
              </li>
            </ul>

            {!isMember && (
              <>
                <h3>
                  <FormattedMessage
                    id="upgrade.how-heading"
                    defaultMessage="How to get it"
                  />
                </h3>
                <p>
                  <FormattedMessage
                    id="upgrade.how-body"
                    defaultMessage="Membership is activated by {company}. Send us a message with your username and we will enable it on your account."
                    values={{ company: brand.companyName }}
                  />
                  {!signedIn && (
                    <>
                      {' '}
                      <FormattedMessage
                        id="upgrade.sign-in-hint"
                        defaultMessage="Sign in first so that we can link membership to your account."
                      />
                    </>
                  )}
                </p>
                <div className="upgrade-dialog-actions">
                  {signedIn ? (
                    <Button type="link" primary href={requestHref}>
                      <FormattedMessage
                        id="upgrade.request"
                        defaultMessage="Request membership by email"
                      />
                    </Button>
                  ) : (
                    <Button
                      primary
                      onClick={() => {
                        dispatch(showDialog('SIGN_IN'))
                      }}
                    >
                      <FormattedMessage
                        id="menu.item.sign-in"
                        defaultMessage="Sign in"
                      />
                    </Button>
                  )}
                  <ExternalLink href={brand.plusInfoUrl}>
                    <FormattedMessage
                      id="upgrade.learn-more"
                      defaultMessage="Learn more"
                    />
                  </ExternalLink>
                </div>
              </>
            )}

            <p className="upgrade-dialog-footnote">
              <FormattedMessage
                id="upgrade.contact"
                defaultMessage="Questions? Contact {email}."
                values={{
                  email: <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>,
                }}
              />
            </p>
          </div>
          <button className="dialog-primary-action" onClick={closeDialog}>
            <FormattedMessage id="btn.close" defaultMessage="Close" />
          </button>
        </div>
      )}
    </Dialog>
  )
}
