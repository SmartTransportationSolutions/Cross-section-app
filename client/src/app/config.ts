/**
 * Environment variables are passed in as strings. This means falsy values are
 * implicitly converted to strings, which become truthy as a result.
 *
 * This function parses incoming variables and converts them to boolean.
 */
function parseBoolean(value: string | undefined): boolean {
  switch (value) {
    case 'true':
      return true
    default:
      return false
  }
}

export const ENV: string | undefined = process.env.NODE_ENV
export const STREETMIX_INSTANCE: string | undefined =
  process.env.STREETMIX_INSTANCE
export const SPONSOR_BANNER: string | undefined = process.env.SPONSOR_BANNER
export const FACEBOOK_APP_ID: string | undefined = process.env.FACEBOOK_APP_ID
export const OFFLINE_MODE: boolean = parseBoolean(process.env.OFFLINE_MODE)
export const PELIAS_API_KEY: string | undefined = process.env.PELIAS_API_KEY
export const PELIAS_HOST_NAME: string | undefined = process.env.PELIAS_HOST_NAME
export const MAP_TILES_URL: string =
  process.env.MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_TILES_ATTRIBUTION: string =
  process.env.MAP_TILES_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
export const SENTRY_DSN: string | undefined = process.env.SENTRY_DSN
