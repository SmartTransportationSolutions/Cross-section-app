#!/usr/bin/env node
/**
 * STS Street administration CLI. Runs against the configured database.
 *
 *   npm run sts:admin -- list-users [--limit 50]
 *   npm run sts:admin -- show-user <username>
 *   npm run sts:admin -- grant-role <username> <ROLE>
 *   npm run sts:admin -- revoke-role <username> <ROLE>
 *   npm run sts:admin -- grant-plus <username>      (alias for grant-role SUBSCRIBER_1)
 *   npm run sts:admin -- revoke-plus <username>
 *   npm run sts:admin -- make-admin <username>
 *   npm run sts:admin -- create-user <email> <password> [username] [--role ROLE]...
 *   npm run sts:admin -- newsletter-export          (CSV to stdout)
 *   npm run sts:admin -- prune-tokens
 *
 * Roles are defined in app/data/user_roles.json. SUBSCRIBER_1 is the
 * "STS Street Plus" membership tier.
 */
import '../app/globals.ts'
import roles from '../app/data/user_roles.json' with { type: 'json' }
import {
  AuthCredential,
  NewsletterSubscription,
  User,
} from '../app/db/models/index.ts'
import { sequelize } from '../app/db/db.ts'
import {
  deriveNickname,
  findOrCreateUser,
  isValidEmail,
  isValidNickname,
  makeLocalSubject,
  normalizeEmail,
} from '../app/auth/identity.ts'
import { checkPasswordPolicy, hashPassword } from '../app/auth/password.ts'
import { pruneTokens } from '../app/auth/tokens.ts'

const VALID_ROLES = Object.keys(roles)

function usage(): never {
  console.error(
    [
      'Usage: npm run sts:admin -- <command> [args]',
      '  list-users [--limit N]',
      '  show-user <username>',
      '  grant-role <username> <ROLE>',
      '  revoke-role <username> <ROLE>',
      '  grant-plus <username> | revoke-plus <username>',
      '  make-admin <username>',
      '  create-user <email> <password> [username] [--role ROLE]...',
      '  newsletter-export',
      '  prune-tokens',
      `Roles: ${VALID_ROLES.join(', ')}`,
    ].join('\n')
  )
  process.exit(2)
}

async function requireUser(username: string): Promise<User> {
  const user = await User.findOne({ where: { id: username } })
  if (!user) {
    console.error(`User "${username}" not found.`)
    process.exit(1)
  }
  return user
}

function requireRole(role: string): string {
  const upper = role.toUpperCase()
  if (!VALID_ROLES.includes(upper)) {
    console.error(`Unknown role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }
  return upper
}

function printUser(user: User): void {
  console.log(
    JSON.stringify(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        roles: user.roles,
        authSubject: user.authSubject,
        createdAt: user.createdAt,
      },
      null,
      2
    )
  )
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (!command) usage()

  await sequelize.authenticate()

  switch (command) {
    case 'list-users': {
      const limitIdx = args.indexOf('--limit')
      const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 50 : 50
      const users = await User.findAll({ order: [['createdAt', 'DESC']], limit })
      for (const u of users) {
        console.log(`${u.id}\t${u.email ?? '-'}\t${(u.roles ?? []).join(',')}`)
      }
      break
    }
    case 'show-user': {
      if (!args[0]) usage()
      printUser(await requireUser(args[0]))
      break
    }
    case 'grant-role':
    case 'revoke-role': {
      if (!args[0] || !args[1]) usage()
      const user = await requireUser(args[0])
      const role = requireRole(args[1])
      if (command === 'grant-role') await user.addRole(role)
      else await user.removeRole(role)
      await user.reload()
      printUser(user)
      break
    }
    case 'grant-plus':
    case 'revoke-plus': {
      if (!args[0]) usage()
      const user = await requireUser(args[0])
      if (command === 'grant-plus') await user.addRole(roles.SUBSCRIBER_1.value)
      else await user.removeRole(roles.SUBSCRIBER_1.value)
      await user.reload()
      printUser(user)
      break
    }
    case 'make-admin': {
      if (!args[0]) usage()
      const user = await requireUser(args[0])
      await user.addRole(roles.ADMIN.value)
      await user.reload()
      printUser(user)
      break
    }
    case 'create-user': {
      const [emailArg, password, maybeNickname] = args
      if (!emailArg || !password) usage()
      if (!isValidEmail(emailArg)) {
        console.error('Invalid email address.')
        process.exit(1)
      }
      const policy = checkPasswordPolicy(password)
      if (!policy.ok) {
        console.error(`Password rejected: ${policy.reason}`)
        process.exit(1)
      }
      const nickname = maybeNickname && !maybeNickname.startsWith('--') ? maybeNickname : undefined
      if (nickname && !isValidNickname(nickname)) {
        console.error('Invalid username.')
        process.exit(1)
      }
      const email = normalizeEmail(emailArg)
      const existing = await User.findOne({ where: { email } })
      if (existing) {
        console.error(`A user with email ${email} already exists (${existing.id}).`)
        process.exit(1)
      }
      const { user } = await findOrCreateUser({
        subject: makeLocalSubject(),
        email,
        nickname: nickname ?? deriveNickname({ email }),
      })
      await AuthCredential.create({
        userId: user.id,
        passwordHash: await hashPassword(password),
        passwordUpdatedAt: new Date(),
      })
      const extraRoles = args
        .map((a, i) => (a === '--role' ? args[i + 1] : null))
        .filter((r): r is string => Boolean(r))
        .map(requireRole)
      for (const role of extraRoles) await user.addRole(role)
      await user.reload()
      printUser(user)
      break
    }
    case 'newsletter-export': {
      const rows = await NewsletterSubscription.findAll({
        where: { unsubscribedAt: null },
        order: [['createdAt', 'ASC']],
      })
      console.log('email,source,locale,created_at')
      for (const r of rows) {
        console.log(`${r.email},${r.source ?? ''},${r.locale ?? ''},${r.createdAt.toISOString()}`)
      }
      break
    }
    case 'prune-tokens': {
      const count = await pruneTokens()
      console.log(`Removed ${count} expired or used tokens.`)
      break
    }
    default:
      usage()
  }

  await sequelize.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
