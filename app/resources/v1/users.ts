/**
 * User account API.
 *
 * Accounts are created by the STS identity service (app/auth) during
 * sign-in; there is no public endpoint for creating users. All ownership
 * checks are performed server-side against the verified token subject.
 */
import { z } from 'zod'

import roles from '../../data/user_roles.json' with { type: 'json' }
import { revokeAllUserTokens } from '../../auth/tokens.ts'
import { AuthCredential, Street, User } from '../../db/models/index.ts'
import { logger } from '../../lib/logger.ts'
import { ERRORS, asUserJson, asUserJsonBasic } from '../../lib/util.ts'

import type { Request, Response } from 'express'

const VALID_ROLES = Object.keys(roles)

// Roles that an administrator may grant or revoke through the API.
// ADMIN itself is managed with the CLI (`npm run sts:admin`) so that a
// compromised admin session cannot mint further administrators.
const API_ASSIGNABLE_ROLES = VALID_ROLES.filter((role) => role !== 'ADMIN')

async function findCallingUser(req: Request): Promise<User | null> {
  if (!req.auth?.sub) return null
  return User.findOne({ where: { authSubject: req.auth.sub } })
}

function isAdmin(user: User | null): boolean {
  return Boolean(user?.roles?.includes(roles.ADMIN.value))
}

export async function get(req: Request, res: Response) {
  const userId = req.params.user_id

  const handleError = function (error: string) {
    switch (error) {
      case ERRORS.USER_NOT_FOUND:
        res.status(404).json({ status: 404, msg: 'User not found.' })
        return
      case ERRORS.CANNOT_GET_USER:
        res.status(500).json({ status: 500, msg: 'Error finding user.' })
        return
      case ERRORS.UNAUTHORISED_ACCESS:
        res.status(401).json({ status: 401, msg: 'Unauthorized request.' })
        return
      default:
        res.status(500).json({ status: 500, msg: 'Unknown error.' })
    }
  }

  const findUserById = async function (userId: string) {
    let user
    try {
      user = await User.findOne({ where: { id: userId } })
    } catch (err) {
      logger.error(err)
      throw new Error(ERRORS.CANNOT_GET_USER, { cause: err })
    }
    if (!user) {
      throw new Error(ERRORS.USER_NOT_FOUND)
    }
    return user
  }

  try {
    if (userId !== undefined) {
      const result = await findUserById(userId)

      // Only send the full user object if it matches the requesting user
      // (or the requesting user is an administrator)
      if (req.auth?.sub && req.auth.sub === result.authSubject) {
        res.status(200).send(asUserJson(result))
        return
      }

      if (req.auth?.sub) {
        const callingUser = await findCallingUser(req)
        if (isAdmin(callingUser)) {
          res.status(200).send(asUserJson(result))
          return
        }
      }

      res.status(200).send(asUserJsonBasic(result))
    } else {
      // Listing all users is restricted to administrators.
      if (!req.auth?.sub) {
        throw new Error(ERRORS.UNAUTHORISED_ACCESS)
      }
      const callingUser = await findCallingUser(req)
      if (!isAdmin(callingUser)) {
        throw new Error(ERRORS.UNAUTHORISED_ACCESS)
      }
      const results = await User.findAll({ order: [['createdAt', 'DESC']], limit: 500 })
      res.status(200).json(results.map(asUserJson))
    }
  } catch (err) {
    handleError((err as Error).message)
  }
}

/**
 * Deletes a user account: the user's streets are soft-deleted, sessions are
 * revoked and the account row is removed. Only the account owner or an
 * administrator may do this.
 */
export async function del(req: Request, res: Response) {
  const userId = req.params.user_id
  let user: User | null
  try {
    user = await User.findOne({ where: { id: userId } })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Error finding user.' })
    return
  }

  if (!user) {
    res.status(404).json({ status: 404, msg: 'User not found.' })
    return
  }

  const callingUser = await findCallingUser(req)
  const isSameUser = Boolean(callingUser && user.id === callingUser.id)
  if (!isSameUser && !isAdmin(callingUser)) {
    res.status(401).end()
    return
  }

  try {
    await Street.update(
      { status: 'DELETED' },
      { where: { creatorId: user.id, status: 'ACTIVE' } }
    )
    await revokeAllUserTokens(user.id)
    await AuthCredential.destroy({ where: { userId: user.id } })
    await user.destroy()
    res.status(204).end()
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not delete user.' })
  }
}

/**
 * Replaces the user's settings (`data`). Owner or administrator only.
 */
export async function put(req: Request, res: Response) {
  const body = req.body

  if (!req.auth?.sub) {
    res.status(401).json({ status: 401, msg: 'User auth not found.' })
    return
  }

  const userId = req.params.user_id
  let user: User | null

  try {
    user = await User.findOne({ where: { id: userId } })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Error finding user.' })
    return
  }

  if (!user) {
    res.status(404).json({ status: 404, msg: 'User not found.' })
    return
  }

  const callingUser = await findCallingUser(req)

  if (!isAdmin(callingUser) && callingUser?.id !== userId) {
    res.status(401).end()
    return
  }

  const data =
    body && typeof body.data === 'object' && body.data !== null ? body.data : {}

  User.update({ data }, { where: { id: user.id }, returning: true })
    .then(() => {
      res.status(204).end()
    })
    .catch((err) => {
      logger.error(err)
      res
        .status(500)
        .json({ status: 500, msg: 'Could not update user information.' })
    })
}

const patchSchema = z.object({
  displayName: z.string().max(30).nullable().optional(),
})

/**
 * Updates profile fields (currently only `displayName`). Owner or
 * administrator only.
 */
export async function patch(req: Request, res: Response) {
  if (!req.auth?.sub) {
    res.status(401).json({ status: 401, msg: 'User auth not found.' })
    return
  }

  const parsed = patchSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      status: 400,
      errors: z.flattenError(parsed.error).fieldErrors,
    })
    return
  }

  const userId = req.params.user_id
  let user: User | null

  try {
    user = await User.findOne({ where: { id: userId } })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Error finding user.' })
    return
  }

  if (!user) {
    res.status(404).json({ status: 404, msg: 'User not found.' })
    return
  }

  const callingUser = await findCallingUser(req)
  if (!isAdmin(callingUser) && callingUser?.id !== userId) {
    res.status(401).end()
    return
  }

  // Only allowed to update one field, all others are dropped
  // if they are present in the body
  User.update(
    {
      displayName: parsed.data.displayName || null,
    },
    { where: { id: user.id }, returning: true }
  )
    .then(() => {
      res.status(204).end()
    })
    .catch((err) => {
      logger.error(err)
      res
        .status(500)
        .json({ status: 500, msg: 'Could not update user information.' })
    })
}

const rolesSchema = z.object({
  roles: z.array(z.string()).max(20),
})

/**
 * Replaces a user's roles (membership tiers, beta access, etc).
 * Administrators only. The ADMIN role cannot be granted through the API.
 */
export async function putRoles(req: Request, res: Response) {
  if (!req.auth?.sub) {
    res.status(401).json({ status: 401, msg: 'User auth not found.' })
    return
  }

  const callingUser = await findCallingUser(req)
  if (!isAdmin(callingUser)) {
    res.status(403).json({ status: 403, msg: 'Administrator access required.' })
    return
  }

  const parsed = rolesSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ status: 400, msg: 'Please provide a list of roles.' })
    return
  }

  const requested = Array.from(new Set(parsed.data.roles))
  const invalid = requested.filter((role) => !API_ASSIGNABLE_ROLES.includes(role))
  if (invalid.length > 0) {
    res.status(400).json({
      status: 400,
      msg: `Invalid or non-assignable roles: ${invalid.join(', ')}`,
    })
    return
  }

  let user: User | null
  try {
    user = await User.findOne({ where: { id: req.params.user_id } })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Error finding user.' })
    return
  }
  if (!user) {
    res.status(404).json({ status: 404, msg: 'User not found.' })
    return
  }

  // Preserve the ADMIN role if the target already has it; always keep USER.
  const newRoles = new Set<string>(['USER', ...requested])
  if (user.roles?.includes('ADMIN')) newRoles.add('ADMIN')

  try {
    await user.update({ roles: Array.from(newRoles) })
    logger.info(
      `[admin] ${callingUser?.id} set roles for ${user.id}: ${Array.from(newRoles).join(', ')}`
    )
    res.status(200).json(asUserJson(user))
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not update roles.' })
  }
}
