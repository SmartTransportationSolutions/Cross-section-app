/**
 * Browser journeys for the GitHub Pages (static) edition.
 *
 * Run:
 *   APP_BASE_PATH=/Cross-section-app npm run build:pages
 *   node bin/serve-pages.mjs 8080 &
 *   PAGES_BASE_URL=http://localhost:8080/Cross-section-app npm run test:e2e:pages
 *
 * GitHub is simulated by test/e2e/github-mock.mjs (the test sandbox cannot
 * reach api.github.com). Everything else — the built site, routing,
 * persistence logic, rendering and exports — is the production build.
 */
import { test, before, after } from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'

import { createGitHubMock } from './github-mock.mjs'
import {
  OUT_DIR,
  assert,
  dismissWelcome,
  getStreetState,
  launch,
  newPage,
  shot,
  waitForEditor,
} from './helpers.mjs'

const SITE = (process.env.PAGES_BASE_URL || 'http://localhost:8080/Cross-section-app').replace(/\/+$/, '')
const BASE_PATH = new URL(SITE).pathname.replace(/\/+$/, '')

const USERS = {
  'ghp_owner_token': { login: 'STS-Owner', name: 'STS Owner', avatar_url: '', scopes: ['gist'] },
  'ghp_viewer_token': { login: 'viewer-two', name: 'Viewer Two', avatar_url: '', scopes: ['gist'] },
  'ghp_noscope_token': { login: 'no-scope', name: null, avatar_url: '', scopes: ['read:user'] },
  'github_pat_finegrained': { login: 'fine-grained', name: 'Fine Grained', avatar_url: '', scopes: null },
}

let browser
const evidence = []
const record = (id, detail) => evidence.push({ id, detail })

before(async () => {
  browser = await launch()
})

after(async () => {
  await browser?.close()
  await fs.writeFile(
    path.join(OUT_DIR, 'pages-evidence.json'),
    JSON.stringify({ site: SITE, ranAt: new Date().toISOString(), evidence }, null, 2)
  )
})

async function open(github, url = `${SITE}/`, options = {}) {
  const { context, page } = await newPage(browser, options)
  await github.install(context)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(url)
  await waitForEditor(page)
  await dismissWelcome(page)
  return { context, page, errors }
}

async function signInWithGitHub(page, token) {
  await page.locator('button.menu-sign-in').click()
  await page.waitForSelector('.github-sign-in-dialog')
  await page.getByLabel('GitHub token').fill(token)
  await page.locator('.github-sign-in-dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
}

/** Waits (across the post-sign-in navigation) until the editor is signed in. */
async function waitSignedIn(page, userId) {
  const start = Date.now()
  while (Date.now() - start < 30000) {
    try {
      const ok = await page.evaluate(
        (id) => window.__STS_STORE__?.getState().user.signInData?.userId === id &&
          window.__STS_STORE__?.getState().app.everythingLoaded !== false &&
          !location.pathname.includes('just-signed-in'),
        userId
      )
      if (ok) {
        await waitForEditor(page)
        await dismissWelcome(page)
        return
      }
    } catch {
      // page is navigating
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`not signed in as ${userId}`)
}

function streetGists(github, login) {
  return [...github.gists.values()].filter(
    (g) => g.owner.login === login && Object.keys(g.files).some((f) => /^sts-street-\d+\.json$/.test(f))
  )
}

async function waitFor(fn, message, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn()) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out: ${message}`)
}

// ---------------------------------------------------------------------------
test('P1 anonymous street is kept in this browser and survives reload', async () => {
  // ids: PAGES-ANON-01, PAGES-ROUTING-01, EDIT-RENAME-01
  const github = createGitHubMock({ users: USERS })
  const { context, page, errors } = await open(github)
  let state = await getStreetState(page)
  assert(state.street.id && state.street.creatorId === null, 'anonymous street created')
  assert(new URL(page.url()).pathname === `${BASE_PATH}/-/${state.street.namespacedId}`, `URL under base path: ${page.url()}`)

  page.__dialogValue = 'Guest Street ქუჩა'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(1000)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sts-street:local-streets') ?? '{}'))
  const saved = stored[state.street.id]
  assert(saved?.name === 'Guest Street ქუჩა', `local store has renamed street (${saved?.name})`)

  await page.reload()
  await waitForEditor(page)
  state = await getStreetState(page)
  assert(state.street.name === 'Guest Street ქუჩა', 'renamed street reloads from browser storage')
  assert(github.calls.filter((c) => c.method !== 'GET').length === 0, 'anonymous use writes nothing to GitHub')
  assert(errors.length === 0, `no page errors: ${errors.join('; ')}`)
  await shot(page, 'p1-anonymous')
  record('P1', { url: page.url(), name: state.street.name })
  await context.close()
})

// ---------------------------------------------------------------------------
test('P2 GitHub sign-in validates tokens and promotes the street to a gist', async () => {
  // ids: PAGES-AUTH-01, PAGES-STORE-01, AUTH-SIGNOUT-01
  const github = createGitHubMock({ users: USERS })
  const { context, page } = await open(github)
  page.__dialogValue = 'Rustaveli Avenue'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(800)

  // Invalid token
  await signInWithGitHub(page, 'ghp_wrong')
  await page.waitForSelector('.github-sign-in-dialog .sign-in-error-message')
  assert(/did not accept/i.test(await page.locator('.sign-in-error-message').innerText()), 'invalid token rejected')

  // Token without gist scope
  await page.getByLabel('GitHub token').fill('ghp_noscope_token')
  await page.locator('.github-sign-in-dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForFunction(() => /gist/.test(document.querySelector('.sign-in-error-message')?.textContent ?? ''))

  // Valid token
  await page.getByLabel('GitHub token').fill('ghp_owner_token')
  await page.locator('.github-sign-in-dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
  await waitSignedIn(page, 'sts-owner')
  assert(/\/sts-owner\/1/.test(page.url()), `street URL belongs to the account (${page.url()})`)
  const state = await getStreetState(page)
  assert(state.user.signedIn && state.user.signInData.userId === 'sts-owner', 'signed in as sts-owner')
  await waitFor(() => streetGists(github, 'STS-Owner').length === 1, 'street gist created')
  const gist = streetGists(github, 'STS-Owner')[0]
  const content = JSON.parse(gist.files['sts-street-1.json'].content)
  assert(gist.public === true, 'street gist is public (shareable)')
  assert(content.name === 'Rustaveli Avenue', `promoted street keeps its name (${content.name})`)
  assert(state.street.id === gist.id, 'editor street id is the gist id')
  const session = await page.evaluate(() => localStorage.getItem('sts-street:github-session'))
  assert(session && JSON.parse(session).token === 'ghp_owner_token', 'token kept in this browser')
  const cookies = await context.cookies()
  assert(!cookies.some((c) => c.value.includes('ghp_owner_token')), 'token is not stored in cookies')
  const apiHosts = new Set(github.calls.map((c) => c.path.split('/')[1]))
  await shot(page, 'p2-signed-in')
  record('P2', { url: page.url(), gist: gist.id, apiHosts: [...apiHosts] })

  // Sign out removes the token
  await page.locator('#menubar-identity').first().click()
  const signOut = page.getByText('Sign out', { exact: true })
  if (await signOut.count()) {
    await signOut.first().click()
    await page.waitForTimeout(800)
    const after = await page.evaluate(() => localStorage.getItem('sts-street:github-session'))
    assert(after === null, 'sign out removes the GitHub token')
    record('P2-signout', { removed: true })
  }
  await context.close()
})

// ---------------------------------------------------------------------------
test('P3 edits are saved to the gist, coalesced, and survive a new session', async () => {
  // ids: PAGES-STORE-02, SAVE-AUTOSAVE-01, PAGES-RATE-01
  const github = createGitHubMock({ users: USERS })
  const { context, page } = await open(github)
  await signInWithGitHub(page, 'ghp_owner_token')
  await waitSignedIn(page, 'sts-owner')
  await dismissWelcome(page)

  const patchesBefore = github.calls.filter((c) => c.method === 'PATCH').length
  // Ten quick edits (renames) within a few seconds
  for (let i = 1; i <= 10; i++) {
    page.__dialogValue = `Edit ${i}`
    await page.locator('.street-name').first().click()
    await page.waitForTimeout(150)
  }
  await waitFor(() => {
    const g = streetGists(github, 'STS-Owner')[0]
    return g && JSON.parse(g.files['sts-street-1.json'].content).name === 'Edit 10'
  }, 'final edit reaches GitHub', 20000)
  const patches = github.calls.filter((c) => c.method === 'PATCH').length - patchesBefore
  assert(patches >= 1 && patches <= 6, `edits were coalesced into ${patches} GitHub writes`)
  const gist = streetGists(github, 'STS-Owner')[0]
  assert(gist.description.includes('Edit 10'), `gist description follows the street name (${gist.description})`)

  // New browser session (same account): loads from GitHub, not local cache
  const second = await open(github, `${SITE}/sts-owner/1`, {})
  await second.page.evaluate((t) => {
    localStorage.setItem('sts-street:github-session', JSON.stringify({ login: 'STS-Owner', token: t, name: 'STS Owner', avatarUrl: '' }))
  }, 'ghp_owner_token')
  await second.page.reload()
  await waitForEditor(second.page)
  const state2 = await getStreetState(second.page)
  assert(state2.street.name === 'Edit 10', `second session sees saved name (${state2.street.name})`)
  record('P3', { patches, description: gist.description })
  await second.context.close()
  await context.close()
})

// ---------------------------------------------------------------------------
test('P4 another person can view a shared street and remix it without changing the original', async () => {
  // ids: PAGES-SHARE-01, REMIX-01, AUTHZ-OWNER-01
  const github = createGitHubMock({ users: USERS })
  const owner = await open(github)
  {
    owner.page.__dialogValue = 'Owner Original'
    await owner.page.locator('.street-name').first().click()
    await owner.page.waitForTimeout(600)
  }
  await signInWithGitHub(owner.page, 'ghp_owner_token')
  await waitSignedIn(owner.page, 'sts-owner')
  await waitFor(() => streetGists(github, 'STS-Owner').length === 1, 'owner gist')
  const shareUrl = owner.page.url()
  await owner.context.close()

  // Anonymous viewer
  const viewer = await open(github, shareUrl)
  let state = await getStreetState(viewer.page)
  assert(state.street.name === 'Owner Original', `viewer sees the shared street (${state.street.name})`)
  assert(state.street.creatorId === 'sts-owner', 'creator shown')
  await shot(viewer.page, 'p4-viewer')

  // Signed-in second user edits → remix into their own gist
  await signInWithGitHub(viewer.page, 'ghp_viewer_token')
  await waitSignedIn(viewer.page, 'viewer-two')
  await viewer.page.goto(shareUrl)
  await waitForEditor(viewer.page)
  await dismissWelcome(viewer.page)
  viewer.page.__dialogValue = 'Viewer remix'
  await viewer.page.locator('.street-name').first().click()
  await waitFor(() => streetGists(github, 'viewer-two').some((g) => JSON.parse(Object.values(g.files)[0].content).name?.startsWith('Viewer remix')), 'remix gist created for viewer: ' + JSON.stringify(github.calls.filter((c) => c.method !== 'GET')), 20000)
  const original = JSON.parse(streetGists(github, 'STS-Owner')[0].files['sts-street-1.json'].content)
  assert(original.name === 'Owner Original', 'original gist unchanged')
  const remix = streetGists(github, 'viewer-two').map((g) => JSON.parse(Object.values(g.files)[0].content)).find((c) => c.name?.startsWith('Viewer remix'))
  assert(remix.originalStreetId === streetGists(github, 'STS-Owner')[0].id, 'remix records the original street id')
  state = await getStreetState(viewer.page)
  assert(state.street.creatorId === 'viewer-two', 'editor now on the remix')

  // Direct write attempt against the owner's gist is refused by the backend
  const status = await viewer.page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/streets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'hijack' }) })
    return res.status
  }, streetGists(github, 'STS-Owner')[0].id)
  assert(status === 403, `PUT to another user's street returns 403 (got ${status})`)
  record('P4', { shareUrl, remixUrl: viewer.page.url(), forbiddenStatus: status })
  await viewer.context.close()
})

// ---------------------------------------------------------------------------
test('P5 galleries list gists and built-in examples; deleting a street deletes its gist', async () => {
  // ids: GAL-USER-01, GAL-EXAMPLES-01, GAL-DELETE-01
  const github = createGitHubMock({ users: USERS })
  const { context, page } = await open(github)
  await signInWithGitHub(page, 'ghp_owner_token')
  await waitSignedIn(page, 'sts-owner')
  await dismissWelcome(page)
  // Create two more streets
  for (let i = 0; i < 2; i++) {
    await page.goto(`${SITE}/new`)
    await waitForEditor(page)
    await dismissWelcome(page)
  }
  await waitFor(() => streetGists(github, 'STS-Owner').length === 3, 'three street gists')

  await page.goto(`${SITE}/sts-owner`)
  await page.waitForSelector('.gallery-street-item', { timeout: 30000 })
  const items = await page.locator('.gallery-street-item').count()
  assert(items === 3, `user gallery shows 3 streets (got ${items})`)
  await shot(page, 'p5-gallery')

  // Delete one street from the gallery
  const del = page.locator('.gallery-street-item button[title], .gallery-street-item .gallery-street-item-delete').first()
  if (await del.count()) {
    await page.locator('.gallery-street-item').first().hover()
    await del.click()
    await waitFor(() => streetGists(github, 'STS-Owner').length === 2, 'gist deleted after gallery delete')
  }
  const remaining = streetGists(github, 'STS-Owner').length

  // Examples gallery (static data, never resolved against GitHub). Use a
  // fresh visitor: this account's last street was just deleted, and opening
  // a gallery whose "last street" is gone starts a new street (upstream
  // behaviour).
  await context.close()
  const visitor = await newPage(browser)
  await github.install(visitor.context)
  const page2 = visitor.page
  await page2.goto(`${SITE}/examples/2`)
  await waitForEditor(page2)
  await dismissWelcome(page2)
  const state = await getStreetState(page2)
  assert(state.street.creatorId === 'examples' && state.street.segments.length > 3, 'example street opens by URL')
  assert(/Transit boulevard/.test(state.street.name ?? ''), `example street name (${state.street.name})`)
  await shot(page2, 'p5-example')
  // The author link opens the examples gallery
  await page2.locator('a[href$="/examples"]').first().click()
  await page2.waitForSelector('.gallery-street-item', { timeout: 30000 })
  const examples = await page2.locator('.gallery-street-item').count()
  assert(examples === 5, `examples gallery shows 5 streets (got ${examples})`)
  assert(!github.calls.some((c) => c.path.includes('/users/examples')), 'examples are not looked up on GitHub')
  record('P5', { gallery: items, remainingAfterDelete: remaining, examples })
  await visitor.context.close()
})

// ---------------------------------------------------------------------------
test('P6 Plus membership comes from members.json; client-side export works', async () => {
  // ids: PAGES-MEMBERS-01, EXPORT-IMAGE-01, MEMB-ENV-01
  const github = createGitHubMock({ users: USERS })
  const { context, page } = await newPage(browser)
  await github.install(context)
  await context.route(`${SITE}/data/members.json`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plus: ['sts-owner'], admin: [] }) })
  )
  await page.goto(`${SITE}/`)
  await waitForEditor(page)
  await dismissWelcome(page)

  // Anonymous: environment picker locked
  await page.locator('.palette-commands-left button').first().click({ force: true })
  await page.waitForSelector('.sky-picker', { timeout: 10000 })
  assert((await page.locator('.sky-picker .streetmix-plus-prompt').count()) === 1, 'environment locked for anonymous users')

  await signInWithGitHub(page, 'ghp_owner_token')
  await waitSignedIn(page, 'sts-owner')
  await dismissWelcome(page)
  const state = await getStreetState(page)
  assert(state.user.isSubscriber === true, 'member listed in members.json is a Plus subscriber')
  await page.locator('.palette-commands-left button').first().click({ force: true })
  await page.waitForSelector('.sky-picker', { timeout: 10000 })
  assert((await page.locator('.sky-picker .streetmix-plus-prompt').count()) === 0, 'environment unlocked for members')
  await page.keyboard.press('Escape')

  // Save as image (client-side canvas export)
  await page.mouse.move(5, 5)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#menubar-share').click({ force: true })
    await page.waitForTimeout(400)
    if (await page.locator('.share-menu').isVisible().catch(() => false)) break
  }
  await page.locator('.share-menu').getByText('Save as image', { exact: false }).first().click()
  await page.waitForSelector('.save-as-image-preview-image img[src^="blob:"]', { timeout: 30000 })
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('.save-as-image-download a, .save-as-image-download button').first().click(),
  ])
  const file = path.join(OUT_DIR, 'p6-client-export.png')
  await download.saveAs(file)
  const png = PNG.sync.read(await fs.readFile(file))
  assert(png.width > 1000 && png.height > 400, `export has sane dimensions ${png.width}x${png.height}`)
  record('P6', { subscriber: true, export: [png.width, png.height] })
  await context.close()
})

// ---------------------------------------------------------------------------
test('P7 static pages, deep links, translations and no unexpected hosts', async () => {
  // ids: PAGES-LEGAL-01, LIC-SOURCE-01, I18N-LOCALES-01, PRIV-HOSTS-01
  const github = createGitHubMock({ users: USERS })
  const { context, page } = await newPage(browser)
  await github.install(context)
  const hosts = new Set()
  page.on('request', (r) => {
    try {
      hosts.add(new URL(r.url()).host)
    } catch {
      // non-URL request
    }
  })
  for (const [p, text] of [['/privacy-policy', 'Privacy policy'], ['/terms-of-service', 'Terms of service'], ['/source', 'Source code']]) {
    const res = await page.goto(`${SITE}${p}`)
    assert(res.status() === 200, `${p} is served (${res.status()})`)
    assert((await page.locator('h1').innerText()).includes(text), `${p} renders`)
    const editorLink = await page.locator('header a').first().getAttribute('href')
    assert(editorLink === `${BASE_PATH}/`, `${p} links back to the editor under the base path (${editorLink})`)
  }
  assert(/AGPL|Affero/.test(await page.content()), 'source page carries the AGPL offer')

  // Deep link to a street that does not exist → app loads and shows not-found
  await page.goto(`${SITE}/nobody-here/7/missing`)
  await page.waitForTimeout(3000)
  const body = await page.locator('body').innerText()
  assert(/not found|no page|couldn|having trouble/i.test(body), 'missing street shows an error page, not a blank screen')

  // Translations from static files
  await page.goto(`${SITE}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  const loaded = await page.evaluate(async () => {
    const res = await fetch('/api/v1/translate/de/main')
    return res.status
  })
  assert(loaded === 200, 'German translation served from the static site')
  const bad = await page.evaluate(async () => (await fetch('/api/v1/translate/..%2F..%2Fpackage/main')).status)
  assert(bad === 400, `path traversal in locale is rejected (${bad})`)
  const unexpected = [...hosts].filter((h) => !['localhost:8080', 'api.github.com', 'gist.githubusercontent.com'].includes(h) && !h.startsWith('localhost'))
  assert(unexpected.length === 0, `no requests to other hosts: ${unexpected.join(', ')}`)
  await shot(page, 'p7-editor')
  record('P7', { hosts: [...hosts] })
  await context.close()
})
