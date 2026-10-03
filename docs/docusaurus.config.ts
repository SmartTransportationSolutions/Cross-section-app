import type { Config } from '@docusaurus/types'
import type { Options, ThemeConfig } from '@docusaurus/preset-classic'
import { themes } from 'prism-react-renderer/'
import remarkSmartypants from 'remark-smartypants'

const config: Config = {
  title: 'STS Street Documentation',
  tagline: 'A guidebook for the users and the makers of STS Street.',
  url: process.env.DOCS_URL ?? 'http://localhost:8000',
  baseUrl: '/docs/',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },
  favicon: 'img/favicon.ico',
  organizationName: 'SmartTransportationSolutions',
  projectName: 'Cross-section-app',
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },
  themeConfig: {
    image: 'thumbnail.png',
    navbar: {
      title: 'STS Street Guidebook',
      logo: {
        alt: 'STS Street',
        src: 'img/logo_icon.svg',
        href: '/'
      },
      items: [
        {
          type: 'doc',
          docId: 'contributing/intro',
          label: 'Contributor docs',
          position: 'left'
        },
        {
          type: 'doc',
          docId: 'user-guide/intro',
          label: 'User guide',
          position: 'left'
        },
        {
          type: 'doc',
          docId: 'community',
          label: 'Community',
          position: 'left'
        },
        {
          href: 'https://street.sts.com.ge/',
          label: 'Open the editor',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Contributor docs',
              to: '/contributing/intro'
            },
            {
              label: 'User guide',
              to: '/user-guide/intro'
            }
          ]
        },
        {
          title: 'Smart Transportation Solutions',
          items: [
            {
              label: 'Company website',
              href: 'https://www.sts.com.ge/'
            },
            {
              label: 'Contact',
              href: 'mailto:info@sts.com.ge'
            }
          ]
        },
        {
          title: 'More',
          items: [
            {
              label: 'Source code (AGPL-3.0)',
              href: 'https://github.com/SmartTransportationSolutions/Cross-section-app'
            },
            {
              label: 'Based on Streetmix',
              href: 'https://github.com/streetmix/streetmix'
            }
          ]
        }
      ],
      copyright: `STS Street is operated by Smart Transportation Solutions. Based on Streetmix (© 2013–2018 Code for America and contributors, © 2019–${new Date().getFullYear()} Streetmix LLC), AGPL-3.0-or-later. Built with Docusaurus.`
    },
    prism: {
      theme: themes.github,
      darkTheme: themes.dracula
    }
  } satisfies ThemeConfig,
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/SmartTransportationSolutions/Cross-section-app/edit/main/docs/',
          remarkPlugins: [remarkSmartypants]
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/SmartTransportationSolutions/Cross-section-app/edit/main/docs/blog/',
          remarkPlugins: [remarkSmartypants]
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      } satisfies Options
    ]
  ]
}

export default config
