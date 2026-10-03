/**
 * STS Street
 *
 */
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import * as Sentry from '@sentry/browser'

// Fonts
import '@fontsource-variable/manrope'
import '@fontsource-variable/overpass'
import '@fontsource-variable/rubik'
import '@fontsource-variable/rubik/wght-italic.css'

// Stylesheets
import 'leaflet/dist/leaflet.css'
import '~/styles/styles.css'

// Redux
import store from '~/src/store'

// Main object
import { initialize } from '~/src/app/initialization.js'
import { App } from '~/src/app/App.js'

// Error tracking (optional). Only active when the operator configures an
// error reporting DSN at build time; nothing is sent otherwise.
import { SENTRY_DSN } from '~/src/app/config.js'

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    allowUrls: [new RegExp(window.location.hostname.replace(/\./g, '\\.'))],
  })
}

// Mount React components
const container = document.getElementById('react-app')
if (!container) throw new Error('no element to mount to')

// Expose the store for support tooling and browser acceptance tests.
// It is read-only in practice: state must be changed through dispatched actions.
;(window as unknown as { __STS_STORE__: typeof store }).__STS_STORE__ = store

const root = createRoot(container)
root.render(
  <Provider store={store}>
    <App />
  </Provider>
)

initialize()
