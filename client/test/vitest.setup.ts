import '@testing-library/jest-dom/vitest'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import 'vitest-canvas-mock'

import { server } from './server/index.js'

// In a test environment, use test env vars
process.loadEnvFile('.env.test')

// Set up listeners on API with mock-service-worker
beforeAll(() => {
  server.listen()
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(async () => {
  server.close()
  // Redux Toolkit's autoBatch enhancer schedules a requestAnimationFrame
  // callback with a 100 ms fallback timer. If that timer fires after the
  // happy-dom window is torn down, `cancelAnimationFrame` is gone and Vitest
  // reports an unhandled error. Let pending callbacks run before teardown.
  await new Promise((resolve) => setTimeout(resolve, 150))
})

// Add mock stubs for global methods
global.print = vi.fn()
global.confirm = vi.fn(() => true)
global.prompt = vi.fn()

// Cannot directly reassign to `global.navigator.geolocation`, but this works
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
  },
})

// Declare all mock modules globally
vi.mock('../src/ui/Icon.tsx')
vi.mock('react-transition-group')
