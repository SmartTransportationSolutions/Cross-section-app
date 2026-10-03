/**
 * Request authentication middleware.
 *
 * Verifies the RS256 id token issued by the STS identity service (see
 * app/auth/) from the `login_token` cookie (or an `Authorization: Bearer`
 * header) and exposes its claims as `req.auth`, matching the shape used by
 * the rest of the API (`req.auth.sub`).
 */
import { TokenExpiredError, verifyIdToken, type IdTokenClaims } from './auth/tokens.ts'
import type { NextFunction, Request, Response } from 'express'


declare module 'express-serve-static-core' {
  interface Request {
    auth?: IdTokenClaims
  }
}

function getToken(req: Request): string | null {
  if (req.cookies && typeof req.cookies.login_token === 'string' && req.cookies.login_token) {
    return req.cookies.login_token
  }
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

export function auth(credentialsRequired = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = getToken(req)

    if (!token) {
      if (credentialsRequired) {
        res.status(401).json({ status: 401, msg: 'Unauthorized request.' })
        return
      }
      next()
      return
    }

    try {
      req.auth = await verifyIdToken(token)
      next()
    } catch (err) {
      // When credentials are optional, treat invalid/expired tokens as
      // unauthenticated.
      if (!credentialsRequired) {
        next()
        return
      }

      // If our token has expired, the `msg` will contain that information so
      // that the client can handle a token refresh, if necessary. Otherwise,
      // send a generic message.
      const message =
        err instanceof TokenExpiredError
          ? 'Access token expired.'
          : 'Unauthorized request.'
      res.status(401).json({ status: 401, msg: message })
    }
  }
}
