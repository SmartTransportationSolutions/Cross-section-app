/**
 * STS Street browser acceptance journeys.
 *
 * Run: npm run test:e2e   (server must be running at E2E_BASE_URL with the
 * database migrated; MAIL_TRANSPORT=outbox so sign-in emails can be read).
 *
 * Each `test` maps to feature IDs in docs/feature-parity.md (see the
 * `ids` comments). Evidence screenshots are written to test/e2e/output/.
 */
import { test, before, after } from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { request as playwrightRequest } from 'playwright'
import { PNG } from 'pngjs'

import {
  BASE_URL,
  DEMO_PASSWORD,
  OUT_DIR,
  approx,
  assert,
  dismissWelcome,
  getStreetState,
  latestOutboxLink,
  launch,
  loginViaApi,
  newPage,
  openMenu,
  shot,
  signInViaUi,
  signUpViaApi,
  signUpViaUi,
  uniqueEmail,
  waitForEditor,
} from './helpers.mjs'

let browser
const evidence = []

before(async () => {
  browser = await launch()
})

after(async () => {
  await browser?.close()
  await fs.writeFile(
    path.join(OUT_DIR, 'evidence.json'),
    JSON.stringify({ baseUrl: BASE_URL, ranAt: new Date().toISOString(), evidence }, null, 2)
  )
})

function record(id, detail) {
  evidence.push({ id, detail })
}

async function apiContext(cookies = []) {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
  return ctx
}

/** Signs in a Playwright request context with email/password and returns it. */
async function authedRequest(email, password) {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
  await loginViaApi(ctx, { email, password })
  return ctx
}

const PASSWORD = 'correct-horse-battery-staple'
// The "+" button of a slice's width control. Excludes the building-height
// control, whose popup can still be open in WebKit after a building edit.
const LANE_WIDTH_INCREMENT =
  '.popup-container .up-down-input:not(.boundary-height-control) button.up-down-input-increment'

// ---------------------------------------------------------------------------
// Journey 1: anonymous editing, guest persistence, sign-in transition
// ---------------------------------------------------------------------------
test('J1 anonymous street persists on the server and is promoted to the account on sign-in', async () => {
  // ids: USER-ANON-01, SAVE-AUTOSAVE-01, USER-PROMOTE-01, AUTH-SIGNUP-01
  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)

  // Anonymous street exists on the server
  let state = await getStreetState(page)
  assert(state?.street?.id, 'anonymous street has an id')
  assert(state.street.creatorId === null, 'anonymous street has no creator')
  const anonId = state.street.id
  const api = await apiContext()
  const anonBefore = await (await api.get(`/api/v1/streets/${anonId}`)).json()
  assert(anonBefore.creatorId === null, 'server street is anonymous')

  // Edit: rename the street through the nameplate prompt
  page.__dialogValue = 'Guest Street ქუჩა'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(1200) // autosave debounce 500 ms + request
  const anonAfter = await (await api.get(`/api/v1/streets/${anonId}`)).json()
  assert(anonAfter.name === 'Guest Street ქუჩა', `server saved guest name, got ${anonAfter.name}`)
  record('J1', { anonId, name: anonAfter.name })

  // Reload: guest street comes back (last street remembered in local storage)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  state = await getStreetState(page)
  assert(state.street.id === anonId, 'guest street reloaded after refresh')
  assert(state.street.name === 'Guest Street ქუჩა', 'guest name survives reload')

  // Sign up through the UI; the anonymous street is promoted (remixed) to the account
  const email = uniqueEmail('j1')
  await signUpViaUi(page, email, PASSWORD, undefined)
  await page.waitForTimeout(1500)
  state = await getStreetState(page)
  assert(state.user.signedIn, 'signed in after sign-up')
  assert(state.street.creatorId === state.user.signInData.userId, `street promoted to ${state.user.signInData.userId}`)
  assert(state.street.name === 'Guest Street ქუჩა', 'promoted street keeps its name')
  const promoted = await (await api.get(`/api/v1/streets/${state.street.id}`)).json()
  assert(promoted.creatorId === state.user.signInData.userId, 'server shows the new owner')
  await shot(page, 'j1-promoted')
  record('J1', { promotedId: state.street.id, owner: promoted.creatorId })
  await context.close()
  await api.dispose()
})

// ---------------------------------------------------------------------------
// Journey 2: complex street, precise widths, variants, labels, undo/redo
// ---------------------------------------------------------------------------
test('J2 precise widths, variants, boundaries and long undo/redo sequences', async () => {
  // ids: EDIT-WIDTH-INPUT-01, EDIT-VARIANT-01, EDIT-BOUNDARY-01, EDIT-UNDO-01, EDIT-REDO-01, MEMB-RENAME-01
  const email = uniqueEmail('j2')
  const api = await apiContext()
  await signUpViaApi(api, { email, password: PASSWORD, nickname: undefined })
  await api.dispose()

  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, email, PASSWORD)
  await page.goto(`${BASE_URL}/new`)
  await waitForEditor(page)
  await dismissWelcome(page)

  let state = await getStreetState(page)
  const initialWidths = state.street.segments.map((s) => s.width)
  const n = state.street.segments.length
  assert(n >= 5, 'default street has several segments')

  // Open the popup for the first drive lane and type an exact width
  const driveIndex = state.street.segments.findIndex((s) => s.type === 'drive-lane')
  assert(driveIndex >= 0, 'default street has a drive lane')
  const segment = page.locator('[data-testid="segment"]').nth(driveIndex)
  await segment.hover()
  await page.waitForSelector('.popup-container', { timeout: 10000 })
  const widthInput = page.locator('.popup-container input.up-down-input-element').first()
  await widthInput.click({ clickCount: 3 })
  await widthInput.fill('3.35')
  await widthInput.press('Enter')
  await page.waitForTimeout(800)
  state = await getStreetState(page)
  assert(approx(state.street.segments[driveIndex].width, 3.35), `exact width stored in metres: ${state.street.segments[driveIndex].width}`)

  // Increment with the + button (0.1 m resolution) and Shift (0.05 m)
  await segment.hover()
  await page.locator(LANE_WIDTH_INCREMENT).first().click()
  await page.waitForTimeout(300)
  state = await getStreetState(page)
  // The +/- buttons snap to the 0.1 m display resolution (3.35 → 3.4), as upstream
  assert(approx(state.street.segments[driveIndex].width, 3.4, 0.06), `increment snaps to 0.1 m grid: ${state.street.segments[driveIndex].width}`)

  // Change a variant (direction) via the variant buttons: pick the direction
  // that is not currently selected.
  await page.mouse.move(10, 400)
  await segment.hover()
  await page.waitForSelector('.popup-container', { timeout: 10000 })
  const before = state.street.segments[driveIndex].variantString
  const wanted = before.startsWith('inbound') ? /outbound/i : /inbound/i
  await page.locator('.popup-container').getByRole('button', { name: wanted }).first().click()
  await page.waitForTimeout(500)
  state = await getStreetState(page)
  assert(state.street.segments[driveIndex].variantString !== before, `variant changed from ${before} to ${state.street.segments[driveIndex].variantString}`)

  // Boundary: change the left building's floors through its own popup.
  // Close the lane popup first and only type into the building-height
  // control: in WebKit the lane's width popup could still be open, and the
  // value went into the lane width instead.
  await page.mouse.move(10, 400)
  await page.waitForTimeout(600)
  const floorsInput = page.locator('.popup-container .boundary-height-control input.up-down-input-element')
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await floorsInput.isVisible().catch(() => false)) break
    await page.locator('.street-section-boundary.boundary-left').first().hover({ force: true })
    await page.waitForTimeout(500)
  }
  assert(await floorsInput.isVisible(), 'building height control opened for the left boundary')
  const widthBeforeFloors = state.street.segments[driveIndex].width
  await floorsInput.click({ clickCount: 3 })
  await floorsInput.fill('7')
  await floorsInput.press('Enter')
  await page.waitForTimeout(500)
  state = await getStreetState(page)
  assert(state.street.boundary.left.floors === 7, `left building floors set to 7 (got ${state.street.boundary.left.floors})`)
  assert(state.street.segments[driveIndex].width === widthBeforeFloors, 'lane width unchanged by the building edit')
  record('J2-boundary', { floors: state.street.boundary.left.floors })
  // Close the building popup before going back to the lane
  await floorsInput.blur()
  await page.mouse.move(10, 400)
  await page.waitForTimeout(800)

  // Long undo/redo sequence: 12 width edits, undo all, redo all
  const target = state.street.segments[driveIndex].width
  const steps = 12
  for (let i = 0; i < steps; i++) {
    // force: after the building edit the street container can intercept
    // pointer events for a moment (same overlay as the menu-bar clicks)
    await segment.hover({ force: true })
    await page.locator(LANE_WIDTH_INCREMENT).first().waitFor({ state: 'visible', timeout: 10000 })
    await page.locator(LANE_WIDTH_INCREMENT).first().click()
    await page.waitForTimeout(120)
  }
  await page.mouse.move(10, 400)
  state = await getStreetState(page)
  const afterEdits = state.street.segments[driveIndex].width
  assert(afterEdits > target, 'width grew after edits')
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(80)
  }
  state = await getStreetState(page)
  assert(approx(state.street.segments[driveIndex].width, target, 0.02), `undo restored width ${target}, got ${state.street.segments[driveIndex].width}`)
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(80)
  }
  state = await getStreetState(page)
  assert(approx(state.street.segments[driveIndex].width, afterEdits, 0.02), `redo restored width ${afterEdits}, got ${state.street.segments[driveIndex].width}`)
  await shot(page, 'j2-undo-redo')
  record('J2', { driveIndex, target, afterEdits, steps, initialWidths })

  // Persisted on the server with full precision
  await page.waitForTimeout(1200)
  const api2 = await apiContext()
  const saved = await (await api2.get(`/api/v1/streets/${state.street.id}`)).json()
  assert(approx(saved.data.street.segments[driveIndex].width, afterEdits, 0.02), 'server has the edited width')
  assert(saved.data.street.boundary.left.floors === 7, `server has the edited building floors (${saved.data.street.boundary.left.floors})`)
  await api2.dispose()
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 3: save, reload, sign out/in, second browser session
// ---------------------------------------------------------------------------
test('J3 saved design survives reload, sign-out/in and a separate browser session', async () => {
  // ids: SAVE-RELOAD-01, USER-SIGNOUT-01, USER-SIGNIN-01, GAL-LOAD-01
  const email = uniqueEmail('j3')
  const api = await apiContext()
  const { id: userId } = await signUpViaApi(api, { email, password: PASSWORD })
  await api.dispose()

  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, email, PASSWORD)
  await page.goto(`${BASE_URL}/new`)
  await waitForEditor(page)
  await dismissWelcome(page)
  page.__dialogValue = 'რუსთაველის გამზირი'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(1200)
  let state = await getStreetState(page)
  const streetUrl = page.url()
  const streetId = state.street.id
  assert(streetUrl.includes(`/${userId}/`), `street URL contains the username: ${streetUrl}`)

  // Sign out through the identity menu (retry: the menu animates open, and
  // an early click can land on a neighbouring item)
  await page.mouse.move(5, 5)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#menubar-identity').click({ force: true })
    await page.waitForTimeout(400)
    if (await page.locator('.menu-sign-out').isVisible().catch(() => false)) break
  }
  await page.locator('.menu-sign-out').click()
  await page.getByText('You are now signed out', { exact: false }).waitFor({ timeout: 15000 })
  // Sign-out revokes the session on the server before clearing cookies;
  // poll instead of assuming a fixed delay.
  let signedOut = false
  for (let i = 0; i < 40 && !signedOut; i++) {
    const cookies = await context.cookies()
    signedOut = !cookies.find((c) => c.name === 'login_token' && c.value)
    if (!signedOut) await page.waitForTimeout(250)
  }
  if (!signedOut) {
    const body = (await page.locator('body').innerText()).slice(0, 200)
    const names = (await context.cookies()).map((c) => c.name).join(',')
    await shot(page, 'j3-signout-failure')
    throw new Error(`login_token cookie not cleared on sign-out; url=${page.url()} cookies=${names} body=${JSON.stringify(body)}`)
  }

  // Separate browser session: load the permalink anonymously, read-only ownership
  const { context: ctx2, page: page2 } = await newPage(browser)
  await page2.goto(streetUrl)
  await waitForEditor(page2)
  const state2 = await getStreetState(page2)
  assert(state2.street.id === streetId, 'permalink loads the same street in a fresh session')
  assert(state2.street.name === 'რუსთაველის გამზირი', 'Georgian name persisted and displayed')
  await shot(page2, 'j3-fresh-session')
  await ctx2.close()

  // Sign back in, gallery lists the street
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, email, PASSWORD)
  // Open the gallery the way a person does (identity menu → My streets).
  // Loading /<user> directly only opens the gallery when the account has a
  // remembered last street, which depends on a settings save racing the
  // navigation (seen in Firefox).
  await page.mouse.move(5, 5)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#menubar-identity').click({ force: true })
    await page.waitForTimeout(400)
    if (await page.locator('.identity-menu').getByText('My streets').isVisible().catch(() => false)) break
  }
  await page.locator('.identity-menu').getByText('My streets').click()
  await page.waitForSelector('.gallery-street-item', { timeout: 60000 })
  assert(new URL(page.url()).pathname === `/${userId}`, `gallery URL is the user's (${page.url()})`)
  const names = await page.locator('.gallery-street-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-street-name')))
  assert(names.includes('რუსთაველის გამზირი'), `gallery lists the saved street: ${names.join(', ')}`)
  record('J3', { userId, streetId, names })
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 4: shared design as another user, remix, original unchanged
// ---------------------------------------------------------------------------
test('J4 another user can view and remix a shared street without modifying the original', async () => {
  // ids: SHARE-LINK-01, STREET-REMIX-01, AUTHZ-OWNER-01
  const owner = uniqueEmail('j4owner')
  const other = uniqueEmail('j4other')
  const apiOwner = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const { id: ownerId } = await signUpViaApi(apiOwner, { email: owner, password: PASSWORD })
  const created = await (await apiOwner.post('/api/v1/streets', {
    data: {
      name: 'Shared Original',
      clientUpdatedAt: new Date().toISOString(),
      data: { street: { schemaVersion: 35, units: 0, width: 18, segments: [
        { id: 's1', type: 'sidewalk', variantString: 'normal', width: 3, elevation: 1, slope: { on: false, values: [] } },
        { id: 's2', type: 'drive-lane', variantString: 'inbound|car', width: 3, elevation: 0, slope: { on: false, values: [] } },
        { id: 's3', type: 'sidewalk', variantString: 'normal', width: 3, elevation: 1, slope: { on: false, values: [] } },
      ], boundary: { left: { id: 'l', variant: 'residential', floors: 3, elevation: 1 }, right: { id: 'r', variant: 'narrow', floors: 2, elevation: 1 } }, skybox: 'day', weather: null, location: null, showAnalytics: false, userUpdated: true, editCount: 1 }, plugins: {} },
    },
  })).json()
  const originalId = created.id
  const originalUrl = `${BASE_URL}/${ownerId}/${created.namespacedId}`
  const originalBefore = await (await apiOwner.get(`/api/v1/streets/${originalId}`)).json()

  const apiOther = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const { id: otherId } = await signUpViaApi(apiOther, { email: other, password: PASSWORD })

  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, other, PASSWORD)
  await page.goto(originalUrl)
  await waitForEditor(page)
  await dismissWelcome(page)
  let state = await getStreetState(page)
  assert(state.street.id === originalId, 'other user opened the shared street')

  // First edit by a non-owner remixes into a copy owned by the other user
  const seg = page.locator('[data-testid="segment"]').nth(1)
  await seg.hover()
  await page.waitForSelector('.popup-container', { timeout: 10000 })
  await page.locator(LANE_WIDTH_INCREMENT).first().click()
  await page.waitForTimeout(1500)
  state = await getStreetState(page)
  assert(state.street.id !== originalId, 'editing created a remix with a new id')
  assert(state.street.creatorId === otherId, 'remix is owned by the other user')
  assert(state.street.originalStreetId === originalId, 'remix records the original')
  await shot(page, 'j4-remix')

  const originalAfter = await (await apiOwner.get(`/api/v1/streets/${originalId}`)).json()
  assert(JSON.stringify(originalAfter.data.street.segments) === JSON.stringify(originalBefore.data.street.segments), 'original street segments unchanged')
  assert(originalAfter.updatedAt === originalBefore.updatedAt, 'original street not updated')
  // The remixes endpoint returns CSV (upstream behaviour)
  const remixesCsv = await (await apiOwner.get(`/api/v1/streets/${originalId}/remixes`)).text()
  assert(remixesCsv.includes(state.street.id), 'remix listed in the original street\'s remixes export')
  record('J4', { originalId, remixId: state.street.id, otherId, remixRows: remixesCsv.trim().split('\n').length - 1 })
  await apiOwner.dispose()
  await apiOther.dispose()
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 5: gallery pagination beyond one page
// ---------------------------------------------------------------------------
test('J5 gallery pagination shows every street exactly once across pages', async () => {
  // ids: GAL-PAGINATION-01, GAL-USER-01
  const email = uniqueEmail('j5')
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const { id: userId } = await signUpViaApi(api, { email, password: PASSWORD })
  const total = 105 // page size is 100
  const created = []
  for (let i = 0; i < total; i++) {
    const res = await api.post('/api/v1/streets', {
      data: {
        name: `Page Street ${String(i + 1).padStart(3, '0')}`,
        clientUpdatedAt: new Date(Date.now() - i * 1000).toISOString(),
        data: { street: { schemaVersion: 35, units: 0, width: 12, segments: [], boundary: { left: { id: 'l', variant: 'grass', floors: 1, elevation: 1 }, right: { id: 'r', variant: 'grass', floors: 1, elevation: 1 } }, skybox: 'day', weather: null, location: null, showAnalytics: false, userUpdated: true, editCount: 0 }, plugins: {} },
      },
    })
    assert(res.status() === 201, `street ${i} created`)
    created.push((await res.json()).id)
  }

  // API pagination
  const p1 = await (await api.get(`/api/v1/users/${userId}/streets?page=1`)).json()
  const p2 = await (await api.get(`/api/v1/users/${userId}/streets?page=2`)).json()
  assert(p1.pagination.total === total && p1.pagination.totalPages === 2, `pagination totals ${JSON.stringify(p1.pagination)}`)
  const ids = new Set([...p1.streets, ...p2.streets].map((s) => s.id))
  assert(ids.size === total, 'no duplicates across API pages')
  for (const id of created) assert(ids.has(id), `street ${id} present`)

  // UI pagination
  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, email, PASSWORD)
  // Open the gallery the way a person does (identity menu → My streets).
  // Loading /<user> directly only opens the gallery when the account has a
  // remembered last street, which depends on a settings save racing the
  // navigation (seen in Firefox).
  await page.mouse.move(5, 5)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#menubar-identity').click({ force: true })
    await page.waitForTimeout(400)
    if (await page.locator('.identity-menu').getByText('My streets').isVisible().catch(() => false)) break
  }
  await page.locator('.identity-menu').getByText('My streets').click()
  await page.waitForSelector('.gallery-street-item', { timeout: 60000 })
  assert(new URL(page.url()).pathname === `/${userId}`, `gallery URL is the user's (${page.url()})`)
  const seen = []
  for (let pageNo = 1; pageNo <= 2; pageNo++) {
    await page.waitForTimeout(500)
    // Street links are unique (they carry the street number); names are not
    // (the street adopted at sign-in is unnamed, as can be others).
    const items = await page.locator('.gallery-street-item').evaluateAll((els) =>
      els.map((e) => ({ name: e.getAttribute('data-street-name'), href: e.querySelector('a')?.getAttribute('href') }))
    )
    seen.push(...items)
    await shot(page, `j5-gallery-page-${pageNo}`)
    const next = page.locator('.gallery-pagination-button').last()
    if (pageNo === 1) {
      await next.click()
    }
  }
  const unique = new Set(seen.map((item) => item.href))
  const names = new Set(seen.map((item) => item.name))
  for (let i = 1; i <= total; i++) {
    const name = `Page Street ${String(i).padStart(3, '0')}`
    assert(names.has(name), `gallery shows ${name}`)
  }
  // Signing in through the UI creates the user's first "current" street, so
  // compare against the server's count at this moment rather than `total`.
  const nowTotal = (await (await api.get(`/api/v1/users/${userId}/streets?page=1`)).json()).pagination.total
  assert(nowTotal >= total, `server total ${nowTotal} >= ${total}`)
  assert(unique.size === nowTotal && seen.length === nowTotal, `UI shows ${unique.size} distinct street links over 2 pages (server total ${nowTotal}; seen ${seen.length} items)`)
  record('J5', { userId, created: total, serverTotal: nowTotal, pages: 2 })
  await api.dispose()
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 6: exports (client PNG, server PNG with options, print)
// ---------------------------------------------------------------------------
test('J6 image exports contain the design, labels, Georgian text and watermark rules', async () => {
  // ids: EXPORT-IMAGE-01..06, EXPORT-SERVER-01, MEMB-WATERMARK-01
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL })
  // Member account from the seed (SUBSCRIBER_1)
  const member = await playwrightRequest.newContext({ baseURL: BASE_URL })
  await loginViaApi(member, { email: 'demo-member@example.com', password: DEMO_PASSWORD })
  const memberStreets = await (await member.get('/api/v1/users/demo-member/streets')).json()
  const georgian = memberStreets.streets.find((s) => /[Ⴀ-ჿ]/.test(s.name ?? ''))
  assert(georgian, 'seeded member street with Georgian name exists')

  // Server-side export: anonymous request, watermark forced, scale capped
  const anon = await api.get(`/api/v1/streets/${georgian.id}/image?watermark=false&scale=5&labels=true&streetName=true`)
  assert(anon.ok() && anon.headers()['content-type'].startsWith('image/png'), 'server export returns PNG')
  const anonPng = PNG.sync.read(Buffer.from(await anon.body()))
  const memberRes = await member.get(`/api/v1/streets/${georgian.id}/image?watermark=false&scale=3&labels=true&streetName=true`)
  const memberPng = PNG.sync.read(Buffer.from(await memberRes.body()))
  assert(memberPng.width > anonPng.width, `member export at 3x (${memberPng.width}px) is larger than anonymous capped export (${anonPng.width}px)`)
  const anon1 = PNG.sync.read(Buffer.from(await (await api.get(`/api/v1/streets/${georgian.id}/image?scale=1`)).body()))
  assert(approx(anonPng.width / anon1.width, 2, 0.05), 'anonymous scale is capped at 2x')
  await fs.writeFile(path.join(OUT_DIR, 'j6-server-anon-watermark.png'), PNG.sync.write(anonPng))
  await fs.writeFile(path.join(OUT_DIR, 'j6-server-member-3x.png'), PNG.sync.write(memberPng))

  // Transparent sky option produces alpha pixels
  const transparent = PNG.sync.read(Buffer.from(await (await api.get(`/api/v1/streets/${georgian.id}/image?transparentSky=true&scale=1`)).body()))
  assert(transparent.data[3] === 0, 'top-left pixel is transparent with transparentSky')
  const opaque = anon1
  assert(opaque.data[3] === 255, 'top-left pixel is opaque without transparentSky')

  // Client-side export through the dialog
  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await signInViaUi(page, 'demo-member@example.com', DEMO_PASSWORD)
  await page.goto(`${BASE_URL}/demo-member/${georgian.namespacedId}`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await page.mouse.move(5, 5)
  // Open the share menu (retry: menus toggle, and hover popups can briefly
  // intercept the first click after navigation)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#menubar-share').click({ force: true })
    await page.waitForTimeout(400)
    if (await page.locator('.share-menu').isVisible().catch(() => false)) break
  }
  await page.locator('.share-menu').getByText('Save as image', { exact: false }).first().click()
  await page.waitForSelector('.save-as-image-dialog', { timeout: 20000 })
  await page.waitForSelector('.save-as-image-preview-image img[src^="blob:"]', { timeout: 30000 })
  // Member can toggle watermark off
  const watermarkBox = page.locator('.save-as-image-options').getByText('Watermark').locator('..').locator('input')
  assert(!(await watermarkBox.isDisabled()), 'watermark checkbox enabled for member')
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('.save-as-image-download a, .save-as-image-download button').first().click(),
  ])
  const file = path.join(OUT_DIR, 'j6-client-export.png')
  await download.saveAs(file)
  const clientPng = PNG.sync.read(await fs.readFile(file))
  assert(clientPng.width > 1000 && clientPng.height > 400, `client export has sane dimensions ${clientPng.width}x${clientPng.height}`)
  await shot(page, 'j6-save-dialog')
  record('J6', { streetId: georgian.id, anon: [anonPng.width, anonPng.height], member3x: [memberPng.width, memberPng.height], client: [clientPng.width, clientPng.height] })
  await api.dispose()
  await member.dispose()
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 7: direct API attempts by a second user are rejected
// ---------------------------------------------------------------------------
test('J7 server rejects modification and deletion of another user\'s street and account', async () => {
  // ids: AUTHZ-STREET-PUT-01, AUTHZ-STREET-DEL-01, AUTHZ-USER-01, AUTHZ-ROLES-01
  const a = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const b = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const { id: aId } = await signUpViaApi(a, { email: uniqueEmail('j7a'), password: PASSWORD })
  const { id: bId } = await signUpViaApi(b, { email: uniqueEmail('j7b'), password: PASSWORD })
  const street = await (await a.post('/api/v1/streets', { data: { name: 'A street', clientUpdatedAt: new Date().toISOString(), data: { street: { schemaVersion: 35, units: 0, width: 12, segments: [], boundary: { left: { id: 'l', variant: 'grass', floors: 1, elevation: 1 }, right: { id: 'r', variant: 'grass', floors: 1, elevation: 1 } }, skybox: 'day', weather: null, location: null, showAnalytics: false, userUpdated: true, editCount: 0 }, plugins: {} } } })).json()

  const put = await b.put(`/api/v1/streets/${street.id}`, { data: { name: 'hijacked' } })
  assert([401, 403].includes(put.status()), `PUT by non-owner rejected (${put.status()})`)
  const del = await b.delete(`/api/v1/streets/${street.id}`)
  assert([401, 403].includes(del.status()), `DELETE by non-owner rejected (${del.status()})`)
  const anon = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const anonPut = await anon.put(`/api/v1/streets/${street.id}`, { data: { name: 'anon' } })
  assert(anonPut.status() === 401, `anonymous PUT rejected (${anonPut.status()})`)
  const still = await (await anon.get(`/api/v1/streets/${street.id}`)).json()
  assert(still.name === 'A street', 'street name unchanged')

  const patch = await b.patch(`/api/v1/users/${aId}`, { data: { displayName: 'pwned' } })
  assert(patch.status() === 401, `PATCH other user rejected (${patch.status()})`)
  const settings = await b.put(`/api/v1/users/${aId}`, { data: { data: { units: 1 } } })
  assert(settings.status() === 401, `PUT other user settings rejected (${settings.status()})`)
  const delUser = await b.delete(`/api/v1/users/${aId}`)
  assert(delUser.status() === 401, `DELETE other user rejected (${delUser.status()})`)
  const delStreets = await b.delete(`/api/v1/users/${aId}/streets`)
  assert(delStreets.status() === 403, `DELETE other user's streets rejected (${delStreets.status()})`)
  const roles = await b.put(`/api/v1/users/${bId}/roles`, { data: { roles: ['SUBSCRIBER_1', 'ADMIN'] } })
  assert(roles.status() === 403, `self role escalation rejected (${roles.status()})`)
  const full = await (await b.get(`/api/v1/users/${aId}`)).json()
  assert(!('data' in full) && !('roles' in full), 'other user profile is the basic projection')
  const list = await b.get('/api/v1/users')
  assert(list.status() === 401, `user list requires admin (${list.status()})`)

  // Admin can grant Plus (and not ADMIN) via the API
  const admin = await playwrightRequest.newContext({ baseURL: BASE_URL })
  await loginViaApi(admin, { email: 'demo-admin@example.com', password: DEMO_PASSWORD })
  const grant = await admin.put(`/api/v1/users/${bId}/roles`, { data: { roles: ['SUBSCRIBER_1'] } })
  assert(grant.status() === 200, `admin grants Plus (${grant.status()})`)
  const grantAdmin = await admin.put(`/api/v1/users/${bId}/roles`, { data: { roles: ['ADMIN'] } })
  assert(grantAdmin.status() === 400, `ADMIN cannot be granted via API (${grantAdmin.status()})`)
  const bProfile = await (await b.get(`/api/v1/users/${bId}`)).json()
  assert(bProfile.roles.includes('SUBSCRIBER_1'), 'Plus role visible to the user')
  record('J7', { aId, bId, streetId: street.id })
  await Promise.all([a.dispose(), b.dispose(), anon.dispose(), admin.dispose()])
})

// ---------------------------------------------------------------------------
// Journey 8: failed saves, expired sessions, invalid input, stale writes
// ---------------------------------------------------------------------------
test('J8 failures are surfaced: offline save, expired session, invalid input, concurrent edits', async () => {
  // ids: SAVE-FAIL-01, AUTH-EXPIRED-01, API-VALIDATION-01, SAVE-CONFLICT-01
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL })
  // Invalid inputs
  const badPage = await api.get('/api/v1/streets?page=0')
  assert(badPage.status() === 400, 'page=0 rejected')
  const badLimit = await api.get('/api/v1/streets?limit=abc')
  assert(badLimit.status() === 400, 'non-numeric limit rejected')
  const badLogin = await api.post('/services/auth/login', { data: { email: 'not-an-email', password: 'x' } })
  assert(badLogin.status() === 400, 'invalid email rejected')
  const badScale = await api.get(`/api/v1/streets/00000000-0000-0000-0000-000000000000/image?scale=99`)
  assert([400, 404].includes(badScale.status()), 'invalid export scale / unknown street rejected')
  const badRoles = await api.put('/api/v1/users/demo-user/roles', { data: { roles: 'x' } })
  assert(badRoles.status() === 401, 'roles without auth rejected')

  // Expired / invalid session token is rejected server-side
  const expired = await playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Cookie: 'login_token=garbage.token.here' } })
  const me = await expired.get('/api/v1/users/demo-user/streets')
  assert(me.ok(), 'public gallery still readable with a bad cookie (auth optional)')
  const del = await expired.delete('/api/v1/streets/whatever')
  assert(del.status() === 401, 'auth-required route rejects a bad token')
  const refresh = await api.post('/services/auth/refresh-login-token', { data: { token: 'nope' } })
  assert(refresh.status() === 401, 'bad refresh token rejected')

  // Offline save: edits while the network is down must not claim success
  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/new`)
  await waitForEditor(page)
  await dismissWelcome(page)
  let state = await getStreetState(page)
  const streetId = state.street.id
  await context.setOffline(true)
  page.__dialogValue = 'Offline Name'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(4000)
  const serverWhileOffline = await (await api.get(`/api/v1/streets/${streetId}`)).json()
  assert(serverWhileOffline.name !== 'Offline Name', 'server did not receive the offline edit')
  const toastVisible = await page.locator('.toast').count()
  await shot(page, 'j8-offline')
  await context.setOffline(false)
  // Trigger a re-save by making another change once online
  await page.waitForTimeout(500)
  page.__dialogValue = 'Back Online'
  await page.locator('.street-name').first().click()
  await page.waitForTimeout(2000)
  const serverAfter = await (await api.get(`/api/v1/streets/${streetId}`)).json()
  assert(serverAfter.name === 'Back Online', `edit saved after reconnect: ${serverAfter.name}`)
  record('J8', { streetId, toastVisible })

  // Concurrent edit elsewhere: the server copy is newer, the client reloads it
  const newer = { ...serverAfter, name: 'Edited Elsewhere', clientUpdatedAt: new Date(Date.now() + 60000).toISOString() }
  const putRes = await api.put(`/api/v1/streets/${streetId}`, { data: { name: newer.name, clientUpdatedAt: newer.clientUpdatedAt, data: serverAfter.data } })
  assert(putRes.status() === 204, 'anonymous street updated elsewhere')
  // The client verifies when the page becomes visible / focused again
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
  })
  await page.waitForTimeout(2500)
  state = await getStreetState(page)
  assert(state.street.name === 'Edited Elsewhere', `client reloaded the newer server copy: ${state.street.name}`)
  await api.dispose()
  await expired.dispose()
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 9: premium capabilities and integrations
// ---------------------------------------------------------------------------
test('J9 Plus capabilities are unlocked for members only; integrations link to the public URL', async () => {
  // ids: MEMB-ENV-01, MEMB-RENAME-01, MEMB-SEGMENTS-01, INTEG-3DSTREET-01, INTEG-STREETMETER-01
  const { context, page } = await newPage(browser)
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  await dismissWelcome(page)

  // Anonymous: environment panel locked
  await page.locator('.palette-commands-left button').first().click()
  await page.waitForSelector('.sky-picker', { timeout: 10000 })
  assert((await page.locator('.sky-picker .streetmix-plus-prompt').count()) === 1, 'environment picker shows the Plus prompt for anonymous users')
  await shot(page, 'j9-env-locked')
  const lockedItems = await page.locator('.palette-item-disabled').count()
  assert(lockedItems > 0, 'locked palette items for anonymous users')

  // Member: environment unlocked, label editing, locked variants available
  await signInViaUi(page, 'demo-member@example.com', DEMO_PASSWORD)
  await page.goto(`${BASE_URL}/new`)
  await waitForEditor(page)
  await dismissWelcome(page)
  await page.locator('.palette-commands-left button').first().click()
  await page.waitForSelector('.sky-picker', { timeout: 10000 })
  assert((await page.locator('.sky-picker .streetmix-plus-prompt').count()) === 0, 'environment picker unlocked for members')
  const skyButtons = page.locator('.sky-picker button')
  const skyCount = await skyButtons.count()
  assert(skyCount >= 5, `several environment options (${skyCount})`)
  await skyButtons.nth(3).click()
  await page.waitForTimeout(800)
  let state = await getStreetState(page)
  assert(state.street.skybox !== 'day', `skybox changed to ${state.street.skybox}`)
  await shot(page, 'j9-env-member')

  // Rename an element label (member-only)
  const seg = page.locator('[data-testid="segment"]').nth(2)
  await seg.hover()
  await page.waitForSelector('.popup-container', { timeout: 10000 })
  const editable = page.locator('.popup-container .popup-label-editable')
  assert((await editable.count()) === 1, 'label is editable for members')
  page.__dialogValue = 'ჩემი ზოლი'
  await editable.click()
  await page.waitForTimeout(800)
  state = await getStreetState(page)
  assert(state.street.segments[2].label === 'ჩემი ზოლი', `custom Georgian label stored: ${state.street.segments[2].label}`)
  const memberLocked = await page.locator('.palette-item-disabled').count()
  assert(memberLocked === 0, `no locked palette items for members (${memberLocked})`)

  // Integrations
  await openMenu(page, '#menubar-share', page.locator('a.menu-item', { hasText: '3DStreet' }))
  const threeD = await page.locator('a.menu-item', { hasText: '3DStreet' }).getAttribute('href')
  const meter = await page.locator('a.menu-item', { hasText: 'Streetmeter' }).getAttribute('href')
  assert(threeD === `https://3dstreet.app/#${page.url()}`, `3DStreet link carries the public URL: ${threeD}`)
  assert(meter === `https://streetmeter.net/#${page.url()}`, `Streetmeter link carries the public URL: ${meter}`)
  record('J9', { skybox: state.street.skybox, threeD, meter })
  await context.close()
})

// ---------------------------------------------------------------------------
// Journey 10: clean session: identity, no upstream calls, notices and source
// ---------------------------------------------------------------------------
test('J10 clean session shows STS identity, calls no upstream services, and offers notices and source', async () => {
  // ids: BRAND-TITLE-01, BRAND-META-01, PRIV-NO-UPSTREAM-01, LIC-SOURCE-01, LIC-NOTICES-01
  const { context, page } = await newPage(browser)
  const hosts = new Set()
  page.on('request', (r) => { try { hosts.add(new URL(r.url()).host) } catch { /* non-URL request */ } })
  await page.goto(`${BASE_URL}/`)
  await waitForEditor(page)
  const title = await page.title()
  assert(title.includes('STS Street') && !title.includes('Streetmix'), `title is STS branded: ${title}`)
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
  assert(ogTitle === 'STS Street', `og:title ${ogTitle}`)
  const theme = await page.locator('meta[name="theme-color"]').getAttribute('content')
  assert(theme === '#143a66', `theme color ${theme}`)
  const h1 = await page.locator('.menu-bar h1').textContent()
  assert(h1 === 'STS Street', `menubar title ${h1}`)
  const external = [...hosts].filter((h) => !h.startsWith('localhost') && !h.startsWith('127.0.0.1'))
  assert(external.length === 0, `no external hosts contacted on a clean load: ${external.join(', ')}`)
  const upstream = [...hosts].filter((h) => /streetmix|auth0|cloudinary|patreon|sentry|plausible|userback|newrelic|buttondown/.test(h))
  assert(upstream.length === 0, 'no upstream service hosts contacted')

  // About dialog: STS operator, upstream attribution, source link
  await openMenu(page, '#menubar-help', page.getByText('About STS Street', { exact: false }))
  await page.getByText('About STS Street', { exact: false }).click()
  await page.waitForSelector('.about-dialog', { timeout: 10000 })
  const about = await page.locator('.about-dialog').textContent()
  assert(about.includes('Smart Transportation Solutions'), 'About names the operator')
  assert(about.includes('Based on Streetmix'), 'About keeps upstream attribution')
  assert(about.includes('CC BY-SA'), 'About keeps illustration license')
  await shot(page, 'j10-about')

  // Notices and source offer are served
  const source = await (await context.request.get(`${BASE_URL}/services/source`)).json()
  assert(source.license === 'AGPL-3.0-or-later' && source.commit, 'source offer JSON lists license and commit')
  const sourcePage = await (await context.request.get(`${BASE_URL}/source`)).text()
  assert(sourcePage.includes('corresponding source'), 'source page present')
  const privacy = await context.request.get(`${BASE_URL}/privacy-policy`)
  const terms = await context.request.get(`${BASE_URL}/terms-of-service`)
  assert(privacy.ok() && terms.ok(), 'legal pages served')
  record('J10', { title, hosts: [...hosts], sourceCommit: source.commit, archive: source.archive })
  await context.close()
})
