import { brand } from '@sts-street/branding'
import { Icon } from '~/src/ui/Icon.js'
import './SocialLinks.css'

export function SocialLinks() {
  return (
    <ul className="social-links">
      <li>
        <a
          href={brand.companyUrl}
          title={brand.companyName}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external-link" className="social-website" />
        </a>
      </li>
      <li>
        <a href={`mailto:${brand.supportEmail}`} title={brand.supportEmail}>
          <Icon name="mail" className="social-mail" />
        </a>
      </li>
      <li>
        <a
          href={brand.sourceRepositoryUrl}
          /* eslint-disable-next-line formatjs/no-literal-string-in-jsx */
          title="Source code"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="github" className="social-github" />
        </a>
      </li>
    </ul>
  )
}
