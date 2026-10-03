#!/usr/bin/env node
/**
 * Seeds synthetic demonstration data for local development and acceptance
 * testing. Safe to run repeatedly. NEVER run against production data.
 *
 * Creates:
 *   - demo-admin (ADMIN), demo-member (SUBSCRIBER_1), demo-user (USER),
 *     all with password "sts-street-demo-2026"
 *   - A set of sample streets for demo-user and demo-member, including one
 *     with a Georgian street name, enough to paginate the gallery when
 *     SEED_STREET_COUNT is set above the page size (default 12).
 */
import '../app/globals.ts'
import { randomUUID } from 'node:crypto'
import { nanoid } from 'nanoid'

import roles from '../app/data/user_roles.json' with { type: 'json' }
import { AuthCredential, Street, User } from '../app/db/models/index.ts'
import { sequelize } from '../app/db/db.ts'
import {
  findOrCreateUser,
  makeLocalSubject,
} from '../app/auth/identity.ts'
import { hashPassword } from '../app/auth/password.ts'

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true to override.')
  process.exit(1)
}

const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'sts-street-demo-2026'
const STREET_COUNT = Number(process.env.SEED_STREET_COUNT || 12)
const SCHEMA_VERSION = 35

async function ensureUser(id: string, email: string, extraRoles: string[]) {
  let user = await User.findOne({ where: { id } })
  if (!user) {
    const result = await findOrCreateUser({
      subject: makeLocalSubject(),
      email,
      nickname: id,
    })
    user = result.user
  }
  for (const role of extraRoles) await user.addRole(role)
  const cred = await AuthCredential.findOne({ where: { userId: user.id } })
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  if (cred) await cred.update({ passwordHash })
  else await AuthCredential.create({ userId: user.id, passwordHash, passwordUpdatedAt: new Date() })
  return user
}

function slice(type: string, variantString: string, width: number, elevation = 0) {
  return {
    id: nanoid(),
    type,
    variantString,
    width,
    elevation,
    slope: { on: false, values: [] },
  }
}

function makeStreetData(name: string, index: number) {
  const segments = [
    slice('sidewalk', 'normal', 1.8, 1),
    slice('sidewalk-tree', 'big', 0.6, 1),
    slice('bike-lane', 'inbound|green|road', 1.8),
    slice('drive-lane', 'inbound|car', 3 + (index % 3) * 0.25),
    slice('divider', 'planter-box', 0.9, 1),
    slice('drive-lane', 'outbound|car', 3),
    slice('parking-lane', 'outbound|right', 2.1),
    slice('sidewalk-tree', 'big', 0.6, 1),
    slice('sidewalk', 'normal', 1.8, 1),
  ]
  const width = Math.round(segments.reduce((a, s) => a + s.width, 0) * 1000) / 1000
  return {
    street: {
      schemaVersion: SCHEMA_VERSION,
      units: 0,
      width: Math.max(width, 18),
      segments,
      boundary: {
        left: { id: nanoid(), variant: 'residential', floors: 3 + (index % 4), elevation: 1 },
        right: { id: nanoid(), variant: 'narrow', floors: 2 + (index % 3), elevation: 1 },
      },
      skybox: 'day',
      weather: null,
      location: null,
      showAnalytics: false,
      userUpdated: true,
      editCount: 3,
    },
    plugins: {},
  }
}

async function ensureStreets(user: User, names: string[]) {
  const existing = await Street.count({ where: { creatorId: user.id, status: 'ACTIVE' } })
  if (existing >= names.length) {
    console.log(`${user.id}: ${existing} streets already present`)
    return
  }
  let namespacedId = (user.lastStreetId ?? 0) + 1
  for (let i = existing; i < names.length; i++) {
    const name = names[i]
    await Street.create({
      id: randomUUID(),
      namespacedId,
      creatorId: user.id,
      name,
      data: makeStreetData(name, i),
      clientUpdatedAt: new Date(Date.now() - i * 3600_000),
      creatorIp: '127.0.0.1',
    })
    namespacedId++
  }
  await user.update({ lastStreetId: namespacedId - 1 })
  console.log(`${user.id}: seeded ${names.length - existing} streets`)
}

async function main() {
  await sequelize.authenticate()

  const admin = await ensureUser('demo-admin', 'demo-admin@example.com', [roles.ADMIN.value])
  const member = await ensureUser('demo-member', 'demo-member@example.com', [roles.SUBSCRIBER_1.value])
  const user = await ensureUser('demo-user', 'demo-user@example.com', [])

  const georgianNames = ['რუსთაველის გამზირი', 'ჭავჭავაძის გამზირი', 'აღმაშენებლის გამზირი']
  const userStreets = Array.from({ length: STREET_COUNT }, (_, i) =>
    i < georgianNames.length ? georgianNames[i] : `Demo Street ${i + 1}`
  )
  await ensureStreets(user, userStreets)
  await ensureStreets(member, ['Member Boulevard', 'პეკინის გამზირი'])
  await ensureStreets(admin, ['Admin Test Street'])

  console.log(`Demo accounts ready (password: ${DEMO_PASSWORD}):`)
  for (const u of [admin, member, user]) {
    await u.reload()
    console.log(`  ${u.id} <${u.email}> roles=${u.roles.join(',')}`)
  }
  await sequelize.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
