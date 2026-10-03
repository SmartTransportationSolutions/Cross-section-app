import { brand } from '@sts-street/branding'
import { Street, User } from '../../db/models/index.ts'
import { appURL } from '../url.ts'

import type { NextFunction, Request, Response } from 'express'

const ANON_CREATOR = '-'

// This file is a work in progress.
// It was originally meant to find metadata to insert into metatags when a URL
// is crawled/linked to for unfurls. But we can also expand this to be useful.
// If a street is not found at this step, we can render static error pages
// which is also better than letting the client handle it.

// TODO: serve 500 errors when this fails. Error handling in this is broken
async function findUser(userId: string) {
  let user

  try {
    user = await User.findOne({ where: { id: userId } })
  } catch (error) {
    throw new Error('Error finding user.', { cause: error })
  }

  return user
}

async function findStreet(user: User | null, namespacedId: string) {
  return Street.findOne({
    where: { creatorId: user ? user.id : null, namespacedId },
  })
}

export default async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.params.user_id
  const namespacedId = req.params.namespacedId

  if (!userId || !namespacedId) {
    next()
  }

  // 1a) Find street using user.id and namespacedId.
  // 1b) Find street using namespacedId (if anon creator).
  // 2) Find street thumbnail using street.id
  // 3) Set res.locals.STREETMIX_TITLE if street found
  // 4) Set res.locals.STREETMIX_IMAGE if thumbnail found

  const handleFindStreet = async function (street: Street) {
    const streetName = street.name || 'Unnamed Street'
    const title = `${streetName} - ${brand.productName}`

    res.locals.STREETMIX_TITLE = title
    res.locals.STREETMIX_URL += `${userId}/${namespacedId}/`

    // Social preview image is rendered on demand by the server-side export
    // (see app/resources/v1/street_images.ts). Scale 1 keeps it small.
    res.locals.STREETMIX_IMAGE = {
      image: `${appURL.origin}/api/v1/streets/${street.id}/image?scale=1&labels=false`,
      width: undefined,
      height: undefined,
    }

    next()
  }

  let user
  if (userId === ANON_CREATOR) {
    user = null
  } else {
    user = await findUser(userId)

    // If a userId is given, but not found, serve a 404
    if (!user) {
      next({ status: 404 })
      return
    }
  }

  try {
    const street = await findStreet(user, namespacedId)

    if (!street) {
      next({ status: 404, user })
      return
    }

    // Returns 410 Gone for deleted streets
    if (street.status === 'DELETED') {
      next({ status: 410, user })
      return
    }

    await handleFindStreet(street)
  } catch (err) {
    // Sequelize will throw an error if the namespacedId is not an integer.
    // Technically this is still a "street not found" error because it will
    // have come from an invalid URL, so return 404
    next({ status: 404, user })
  }
}
