import { FormattedMessage } from 'react-intl'

import { brand } from '@sts-street/branding'
import logo from 'url:~/images/logo_horizontal.svg'
import { useSelector } from '~/src/store/hooks.js'
import { AboutCoastmix } from '~/src/plugins/coastmix/AboutCoastmix.js'
import { ExternalLink } from '~/src/ui/ExternalLink.js'
import { Dialog } from '../Dialog.js'
import { Credits } from './Credits.js'
import { SocialLinks } from './SocialLinks.js'
import './AboutDialog.css'

/* Too many false positives in this module. Check all strings manually. */
/* eslint-disable formatjs/no-literal-string-in-jsx */

export function AboutDialog() {
  const offline = useSelector((state) => state.system.offline)
  const coastmixMode = useSelector(
    (state) => state.flags.COASTMIX_MODE?.value ?? false
  )

  return (
    <Dialog>
      {(closeDialog) => (
        <div className="about-dialog">
          <div className="dialog-content dialog-content-bleed">
            {coastmixMode && <AboutCoastmix />}
            <header>
              <img
                src={logo}
                alt={`${brand.productName} (logo)`}
                className="about-dialog-logo"
                draggable={false}
              />
              <h1>
                <FormattedMessage
                  id="dialogs.about.heading"
                  defaultMessage="About STS Street."
                />
              </h1>
            </header>
            <div className="about-dialog-content">
              <div className="about-dialog-left">
                <p>
                  <FormattedMessage
                    id="dialogs.about.description"
                    defaultMessage="Design, remix, and share your street. Add bike paths, widen sidewalks or traffic lanes, learn how all of this can impact your community."
                  />
                </p>
                <p>
                  <FormattedMessage
                    id="dialogs.about.operator"
                    defaultMessage="{productName} is operated by {companyLink}, a transportation engineering and planning consultancy based in {location}."
                    values={{
                      productName: brand.productName,
                      companyLink: (
                        <ExternalLink href={brand.companyUrl}>
                          {brand.companyName}
                        </ExternalLink>
                      ),
                      location: brand.companyLocation,
                    }}
                  />
                </p>
                <SocialLinks />
                <h3>
                  <FormattedMessage
                    id="dialogs.about.based-on"
                    defaultMessage="Based on Streetmix"
                  />
                </h3>
                <p className="about-dialog-attribution">
                  <FormattedMessage
                    id="dialogs.about.based-on-description"
                    defaultMessage="{productName} is a modified version of {upstreamLink}, free software released under the GNU Affero General Public License v3.0 or later. Street illustrations are licensed under {ccLink}. {productName} is not affiliated with or endorsed by the Streetmix project."
                    values={{
                      productName: brand.productName,
                      upstreamLink: (
                        <ExternalLink href={brand.upstream.repositoryUrl}>
                          Streetmix
                        </ExternalLink>
                      ),
                      ccLink: (
                        <ExternalLink href="https://creativecommons.org/licenses/by-sa/4.0/">
                          CC BY-SA 4.0
                        </ExternalLink>
                      ),
                    }}
                  />
                </p>
                <p className="about-dialog-attribution">
                  <small>{brand.upstream.copyright}</small>
                </p>
                {!offline && (
                  <p>
                    <a
                      href={brand.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FormattedMessage
                        id="dialogs.about.source-link"
                        defaultMessage="Source code"
                      />
                    </a>
                    <br />
                    <a
                      href={brand.termsOfServiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FormattedMessage
                        id="dialogs.about.tos-link"
                        defaultMessage="Terms of service"
                      />
                    </a>
                    <br />
                    <a
                      href={brand.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FormattedMessage
                        id="dialogs.about.privacy-link"
                        defaultMessage="Privacy policy"
                      />
                    </a>
                  </p>
                )}
              </div>
              <div className="about-dialog-right">
                <Credits />
                <div className="credits-container">
                  <div>
                    <h3>
                      <FormattedMessage
                        id="dialogs.about.acknowledgements"
                        defaultMessage="Acknowledgements"
                      />
                    </h3>
                    <ul>
                      <li>
                        <FormattedMessage
                          id="dialogs.about.font-designed-by"
                          defaultMessage="{fontName} font designed by {fontAuthor}."
                          values={{
                            fontName: (
                              <ExternalLink href="https://manropefont.com/">
                                Manrope
                              </ExternalLink>
                            ),
                            fontAuthor: (
                              <ExternalLink href="https://gent.media/">
                                Mikhail Shiranda
                              </ExternalLink>
                            ),
                          }}
                        />{' '}
                        <FormattedMessage
                          id="dialogs.about.license-label"
                          defaultMessage="(<a>License</a>)"
                          values={{
                            a: (chunks) => (
                              <ExternalLink
                                href="https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL"
                                title="SIL Open Font License, Version 1.1"
                              >
                                {chunks}
                              </ExternalLink>
                            ),
                          }}
                        />
                      </li>
                      <li>
                        <FormattedMessage
                          id="dialogs.about.font-designed-by"
                          defaultMessage="{fontName} font designed by {fontAuthor}."
                          values={{
                            fontName: (
                              <ExternalLink href="https://hubertfischer.com/work/type-rubik">
                                Rubik
                              </ExternalLink>
                            ),
                            fontAuthor: (
                              <ExternalLink href="https://hubertfischer.com/">
                                Hubert & Fischer
                              </ExternalLink>
                            ),
                          }}
                        />{' '}
                        <FormattedMessage
                          id="dialogs.about.license-label"
                          defaultMessage="(<a>License</a>)"
                          values={{
                            a: (chunks) => (
                              <ExternalLink
                                href="https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL"
                                title="SIL Open Font License, Version 1.1"
                              >
                                {chunks}
                              </ExternalLink>
                            ),
                          }}
                        />
                      </li>
                      <li>
                        <FormattedMessage
                          id="dialogs.about.font-designed-by"
                          defaultMessage="{fontName} font designed by {fontAuthor}."
                          values={{
                            fontName: (
                              <ExternalLink href="https://delvefonts.com/fonts/overpass/">
                                Overpass
                              </ExternalLink>
                            ),
                            fontAuthor: (
                              <ExternalLink href="https://delvefonts.com/">
                                Delve Fonts
                              </ExternalLink>
                            ),
                          }}
                        />{' '}
                        <FormattedMessage
                          id="dialogs.about.license-label"
                          defaultMessage="(<a>License</a>)"
                          values={{
                            a: (chunks) => (
                              <ExternalLink
                                href="https://github.com/RedHatOfficial/Overpass/blob/master/OFL.txt"
                                title="SIL Open Font License, Version 1.1"
                              >
                                {chunks}
                              </ExternalLink>
                            ),
                          }}
                        />
                      </li>
                      <li>
                        <FormattedMessage
                          id="dialogs.about.icons-by"
                          defaultMessage="Icons by {author}."
                          values={{
                            author: (
                              <>
                                <ExternalLink href="https://tabler.io/icons">
                                  Tabler
                                </ExternalLink>
                                ,{' '}
                                <ExternalLink href="https://fontawesome.com/">
                                  Font Awesome
                                </ExternalLink>
                              </>
                            ),
                          }}
                        />{' '}
                        <FormattedMessage
                          id="dialogs.about.license-label"
                          defaultMessage="(<a>License</a>)"
                          values={{
                            a: (chunks) => (
                              <ExternalLink
                                href="https://fontawesome.com/license/free"
                                title="Creative Commons Share Alike License 4.0 (CC BY-SA 4.0)"
                              >
                                {chunks}
                              </ExternalLink>
                            ),
                          }}
                        />
                      </li>
                      <li>
                        <FormattedMessage
                          id="dialogs.about.emoji-by"
                          defaultMessage="Emoji by {author}."
                          values={{
                            author: (
                              <ExternalLink href="https://openmoji.org/">
                                OpenMoji
                              </ExternalLink>
                            ),
                          }}
                        />{' '}
                        <FormattedMessage
                          id="dialogs.about.license-label"
                          defaultMessage="(<a>License</a>)"
                          values={{
                            a: (chunks) => (
                              <ExternalLink
                                href="https://creativecommons.org/licenses/by-sa/4.0/#"
                                title="Creative Commons Share Alike License 4.0 (CC BY-SA 4.0)"
                              >
                                {chunks}
                              </ExternalLink>
                            ),
                          }}
                        />
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button className="dialog-primary-action" onClick={closeDialog}>
            <FormattedMessage id="btn.close" defaultMessage="Close" />
          </button>
        </div>
      )}
    </Dialog>
  )
}
