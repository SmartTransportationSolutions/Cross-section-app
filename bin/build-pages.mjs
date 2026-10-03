#!/usr/bin/env node
/**
 * Builds the static GitHub Pages edition of STS Street into `dist-pages/`.
 *
 * The static edition runs entirely in the browser. API requests are answered
 * by client/src/static/backend.ts, which stores streets as GitHub Gists of
 * the signed-in user (or in browser storage when not signed in).
 *
 * Environment:
 *   APP_BASE_PATH   Path the site is served under. Default: "/<repo>" from
 *                   GITHUB_REPOSITORY, else "" (domain root / custom domain).
 *   SITE_URL        Public URL of the site, for canonical/OG tags (optional).
 *   GITHUB_API_URL  GitHub REST API root (default https://api.github.com).
 *   SKIP_DOCS=true  Do not build the Docusaurus user guide.
 *   SKIP_SOURCE_ARCHIVE=true  Do not publish the source archive.
 *
 * Prerequisite: workspace packages are built (`npm run build:packages`).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'dist-pages')

function defaultBase() {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo || repo.endsWith('.github.io')) return ''
  return `/${repo}`
}

const rawBase = process.env.APP_BASE_PATH ?? defaultBase()
const base = rawBase.replace(/\/+$/, '').replace(/^(?!\/)(.+)$/, '/$1')
const githubApi = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '')
const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '')

const env = {
  ...process.env,
  NODE_ENV: 'production',
  STATIC_MODE: 'true',
  APP_BASE_PATH: base,
  GITHUB_API_URL: githubApi,
}
process.env.APP_BASE_PATH = base

const { brand } = await import('../packages/branding/index.js')

function run(cmd, args, cwd = root, extraEnv = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...env, ...extraEnv } })
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true })
}

function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const sha = commit()

console.log(`Building GitHub Pages edition (base path "${base || '/'}") into ${out}`)
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

// 1. Client bundle (static mode)
run(
  path.join(root, 'node_modules/.bin/parcel'),
  [
    'build',
    'src/main.tsx',
    '--dist-dir',
    path.join(out, 'assets'),
    '--public-url',
    `${base}/assets`,
    '--cache-dir',
    path.join(root, '.parcel-cache-pages'),
  ],
  path.join(root, 'client')
)

// 2. SVG sprites (the server compiles these at start-up)
const { compileSVGSprites } = await import('../app/lib/svg_sprite.ts')
await compileSVGSprites('packages/variant-icons/icons/', 'icons', 'icon')
await compileSVGSprites('packages/illustrations/images/', 'images', 'image')
for (const name of ['icons.svg', 'images.svg']) {
  fs.copyFileSync(path.join(root, 'build', name), path.join(out, 'assets', name))
}

// 3. Static files served by the server from public/, app/data, i18n
copyDir(path.join(root, 'public'), out)
copyDir(path.join(root, 'app/data/templates'), path.join(out, 'assets/data/templates'))
copyDir(path.join(root, 'packages/i18n/locales'), path.join(out, 'locales'))
fs.mkdirSync(path.join(out, 'data'), { recursive: true })
fs.copyFileSync(
  path.join(root, 'docs/docs/user-guide/changelog.md'),
  path.join(out, 'data/changelog.md')
)
if (!fs.existsSync(path.join(out, 'data/examples.json'))) {
  run('node', ['bin/build-examples.mjs'])
  fs.copyFileSync(path.join(root, 'public/data/examples.json'), path.join(out, 'data/examples.json'))
}

// 4. HTML shell. GitHub Pages serves 404.html for unknown paths, which lets
// street URLs such as /<user>/<n>/<slug> load the app.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src 'self' ${githubApi} https://gist.githubusercontent.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const canonical = siteUrl ? `${siteUrl}/` : ''
const social = siteUrl ? `${siteUrl}${brand.socialImagePath.slice(base.length)}` : brand.socialImagePath
const esc = Handlebars.Utils.escapeExpression

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>${esc(brand.productName)}</title>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=.75, maximum-scale=1" />
    <meta name="title" content="${esc(brand.productName)}" />
    <meta name="description" content="${esc(brand.description)}" />
    <meta name="application-name" content="${esc(brand.productName)}" />
    <meta name="generator" content="${esc(brand.productName)} (based on Streetmix)" />
    ${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(brand.productName)}" />
    <meta property="og:title" content="${esc(brand.productName)}" />
    <meta property="og:description" content="${esc(brand.description)}" />
    <meta property="og:image" content="${social}" />
    <meta property="og:image:width" content="${brand.socialImageWidth}" />
    <meta property="og:image:height" content="${brand.socialImageHeight}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:image" content="${social}" />
    <link rel="apple-touch-icon" sizes="180x180" href="${base}/apple-touch-icon.png?v=sts1" />
    <link rel="icon" type="image/svg+xml" href="${base}/favicon.svg?v=sts1" />
    <link rel="icon" type="image/png" sizes="32x32" href="${base}/favicon-32x32.png?v=sts1" />
    <link rel="icon" type="image/png" sizes="16x16" href="${base}/favicon-16x16.png?v=sts1" />
    <link rel="manifest" href="${base}/site.webmanifest?v=sts1" />
    <link rel="mask-icon" href="${base}/safari-pinned-tab.svg?v=sts1" color="${brand.themeColor}" />
    <link rel="shortcut icon" href="${base}/favicon.ico?v=sts1" />
    <meta name="apple-mobile-web-app-title" content="${esc(brand.productName)}" />
    <meta name="theme-color" content="${brand.themeColor}" />
    <link href="${base}/assets/main.css" rel="stylesheet" />
  </head>
  <body tabindex="1">
    <div id="svg"></div>
    <div id="react-app" class="app"></div>
    <noscript>To use ${esc(brand.productName)}, please enable JavaScript.</noscript>
    <section class="privacy-link">
      <a href="${brand.privacyPolicyUrl}" target="_blank">Privacy policy</a>
      <a href="${brand.termsOfServiceUrl}" target="_blank">Terms of service</a>
      <a href="${brand.sourceUrl}" target="_blank">Source code</a>
    </section>
    <script src="${base}/assets/main.js" type="module"></script>
  </body>
</html>
`
fs.writeFileSync(path.join(out, 'index.html'), indexHtml)
fs.writeFileSync(path.join(out, '404.html'), indexHtml)

// 5. Legal and source pages from the server's Handlebars templates
const views = path.join(root, 'app/views')
Handlebars.registerPartial('page_head', fs.readFileSync(path.join(views, 'partials/page-head.hbs'), 'utf8'))
Handlebars.registerPartial('page_foot', fs.readFileSync(path.join(views, 'partials/page-foot.hbs'), 'utf8'))

let archive = null
if (process.env.SKIP_SOURCE_ARCHIVE !== 'true') {
  run('bash', ['bin/source-archive.sh'])
  const archiveFile = path.join(root, 'build/source/sts-street-source.tar.gz')
  if (fs.existsSync(archiveFile)) {
    fs.mkdirSync(path.join(out, 'source'), { recursive: true })
    fs.copyFileSync(archiveFile, path.join(out, 'source/sts-street-source.tar.gz'))
    archive = `${base}/source/sts-street-source.tar.gz`
  }
}

function render(template, file, pageTitle) {
  const tpl = Handlebars.compile(fs.readFileSync(path.join(views, template), 'utf8'))
  const html = tpl({ brand, base, pageTitle, commit: sha, version, archive })
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true })
  fs.writeFileSync(path.join(out, file), html)
}
render('static/privacy-policy.hbs', 'privacy-policy.html', 'Privacy policy')
render('static/terms-of-service.hbs', 'terms-of-service.html', 'Terms of service')
render('static/source.hbs', 'source/index.html', 'Source code')
// The editor's links use /source (no trailing slash); GitHub Pages also
// serves source.html at /source.
fs.copyFileSync(path.join(out, 'source/index.html'), path.join(out, 'source.html'))

// 6. User guide (Docusaurus), served under <base>/docs/
if (process.env.SKIP_DOCS !== 'true') {
  run('npm', ['run', 'build', '--workspace=docs'], root, {
    DOCS_BASE_URL: `${base}/docs/`,
    DOCS_EDITOR_URL: siteUrl ? `${siteUrl}/` : `pathname://${base}/`,
    DOCS_URL: siteUrl ? new URL(siteUrl).origin : 'https://localhost',
  })
  copyDir(path.join(root, 'docs/build'), path.join(out, 'docs'))
  // Markdown links such as pathname:///privacy-policy point at the editor
  // site; prefix them with the base path.
  if (base) {
    // Docusaurus prefixes pathname:// links with its own baseUrl (<base>/docs)
    const docsBase = `${base}/docs`
    const pattern = new RegExp(
      `href="(?:${docsBase})?/(privacy-policy|terms-of-service|source)(["#?/])`,
      'g'
    )
    const editor = new RegExp(`href="${docsBase}${base}/"`, 'g')
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(p)
        else if (entry.name.endsWith('.html')) {
          const html = fs.readFileSync(p, 'utf8')
          const fixed = html
            .replace(pattern, `href="${base}/$1$2`)
            .replace(editor, `href="${base}/"`)
          if (fixed !== html) fs.writeFileSync(p, fixed)
        }
      }
    }
    walk(path.join(out, 'docs'))
  }
}

// 7. GitHub Pages: no Jekyll processing; record the build.
fs.writeFileSync(path.join(out, '.nojekyll'), '')
fs.writeFileSync(
  path.join(out, 'build.json'),
  JSON.stringify({ product: brand.productName, edition: 'github-pages', commit: sha, version, base, builtAt: new Date().toISOString() }, null, 2)
)
console.log('GitHub Pages edition built.')
