import { styleText } from 'node:util'

import { brand } from '@sts-street/branding'
import app from './app.ts'
import { logger } from './app/lib/logger.ts'

const server = app.listen(process.env.PORT, () => {
  if (process.env.STREETMIX_INSTANCE === 'coastmix') {
    logger.info(
      '[express] ' + styleText(['yellow', 'bold'], 'Coastmix mode is active.')
    )
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info(
      '[express] ' +
        styleText(['yellow', 'bold'], `${brand.productName} is starting! `) +
        styleText(['white', 'bold'], 'Go here in your browser: ') +
        styleText(['green', 'bold'], `http://localhost:${process.env.PORT}`)
    )
  } else {
    logger.info(
      '[express]',
      styleText(['yellow', 'bold'], `${brand.productName} is starting!`)
    )
  }

  if (process.env.OFFLINE_MODE === 'true') {
    logger.info(
      '[express] ' +
        styleText(['cyan', 'bold'], 'Offline mode is ') +
        styleText(['green', 'bold'], 'ON') +
        styleText(['cyan', 'bold'], '.')
    )
  }
})

// Keep idle HTTP connections open longer than common reverse proxies and
// clients do (load balancers typically reuse idle connections for up to
// 60 s). With Node's 5 s default, a client reusing a connection just as the
// server closes it gets "socket hang up" / ECONNRESET. headersTimeout must
// exceed keepAliveTimeout.
const keepAliveSeconds = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_SECONDS) || 65
server.keepAliveTimeout = keepAliveSeconds * 1000
server.headersTimeout = (keepAliveSeconds + 5) * 1000
