/**
 * STS Street brand configuration.
 *
 * This is the single place where product naming, operator destinations and
 * upstream attribution are defined. Both the server (Express/Handlebars) and
 * the client (React) import from here, so changing a value here changes it
 * everywhere. Keep this file free of secrets.
 *
 * Internal serialization identifiers (street schema keys, API paths,
 * package names such as `@streetmix/*`) are intentionally NOT renamed so that
 * saved street data and third-party integrations (3DStreet, Streetmeter)
 * remain compatible. See docs/brand.md for the branding audit.
 */
export const brand = {
  // Product
  productName: 'STS Street',
  productNameShort: 'STS Street',
  // Membership tier name (replaces the upstream "Streetmix+" name).
  plusName: 'STS Street Plus',
  tagline: 'Design, remix, and share street cross-sections.',
  description:
    'STS Street is a collaborative street cross-section design tool by Smart Transportation Solutions. Design, remix, and share your street.',

  // Operator
  companyName: 'Smart Transportation Solutions',
  companyShortName: 'STS',
  companyUrl: 'https://www.sts.com.ge/',
  companyLocation: 'Tbilisi, Georgia',
  supportEmail: 'info@sts.com.ge',
  contactUrl: 'https://sts.com.ge/contact-us/',

  // In-app destinations (relative URLs are served by this application)
  docsUrl: '/docs/',
  guidebookUrl: '/docs/user-guide/intro',
  troubleshootingUrl: '/docs/user-guide/support/troubleshooting',
  plusInfoUrl: '/docs/user-guide/sts-street-plus',
  privacyPolicyUrl: '/privacy-policy',
  termsOfServiceUrl: '/terms-of-service',
  sourceUrl: '/source',
  sourceRepositoryUrl:
    'https://github.com/SmartTransportationSolutions/Cross-section-app',

  // Social / preview metadata
  themeColor: '#143a66',
  tileColor: '#143a66',
  socialImagePath: '/images/social-preview.png',
  socialImageWidth: 1200,
  socialImageHeight: 630,

  // Upstream attribution (required by AGPL-3.0 and CC-BY-SA-4.0 notices)
  upstream: {
    name: 'Streetmix',
    url: 'https://streetmix.net/',
    repositoryUrl: 'https://github.com/streetmix/streetmix',
    commit: 'f17578eec760d3c7b41216823ec32c7e8d04e8bc',
    codeLicense: 'AGPL-3.0-or-later',
    illustrationsLicense: 'CC-BY-SA-4.0',
    copyright:
      'Copyright (c) 2013-2018 Code for America and contributors. Copyright (c) 2019-2026 Streetmix LLC.',
  },
}

export default brand
