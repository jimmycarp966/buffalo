import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      pathname: '/',
      query: '',
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock fetch globally
global.fetch = jest.fn()

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.sessionStorage = sessionStorageMock

// Polyfills for Next.js server-side code
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Web API polyfills for Next.js
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, options = {}) {
      this.url = url
      this.method = options.method || 'GET'
      this.headers = new Headers(options.headers)
      this.body = options.body
    }
  }

  global.Response = class Response {
    constructor(body, options = {}) {
      this.body = body
      this.status = options.status || 200
      this.statusText = options.statusText || ''
      this.headers = new Headers(options.headers)
      this.ok = this.status >= 200 && this.status < 300
    }

    json() {
      return Promise.resolve(JSON.parse(this.body))
    }

    text() {
      return Promise.resolve(this.body)
    }
  }

  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = new Map()
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value)
        })
      }
    }

    get(name) {
      return this._headers.get(name.toLowerCase()) || null
    }

    set(name, value) {
      this._headers.set(name.toLowerCase(), value)
    }

    has(name) {
      return this._headers.has(name.toLowerCase())
    }

    delete(name) {
      return this._headers.delete(name.toLowerCase())
    }

    *entries() {
      yield* this._headers.entries()
    }

    forEach(callback) {
      this._headers.forEach((value, key) => callback(value, key, this))
    }
  }

  global.FormData = class FormData {
    constructor() {
      this._data = new Map()
    }

    append(name, value) {
      this._data.set(name, value)
    }

    get(name) {
      return this._data.get(name) || null
    }

    getAll(name) {
      return this._data.has(name) ? [this._data.get(name)] : []
    }

    has(name) {
      return this._data.has(name)
    }

    delete(name) {
      this._data.delete(name)
    }

    *entries() {
      yield* this._data.entries()
    }

    forEach(callback) {
      this._data.forEach((value, key) => callback(value, key, this))
    }
  }
}

// Mock URL and URLSearchParams for Next.js
if (typeof global.URL === 'undefined') {
  global.URL = class URL {
    constructor(url) {
      this.href = url
      this.pathname = url.split('?')[0]
      this.search = url.includes('?') ? '?' + url.split('?')[1] : ''
      this.searchParams = new URLSearchParams(this.search)
    }
  }

  global.URLSearchParams = class URLSearchParams {
    constructor(search = '') {
      this._params = new Map()
      if (search.startsWith('?')) search = search.slice(1)
      // Simple parsing for test purposes
      search.split('&').forEach(pair => {
        if (pair) {
          const [key, value] = pair.split('=')
          if (key) this._params.set(decodeURIComponent(key), decodeURIComponent(value || ''))
        }
      })
    }

    get(key) {
      return this._params.get(key) || null
    }

    set(key, value) {
      this._params.set(key, value)
    }

    toString() {
      return Array.from(this._params.entries())
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    }
  }
}

// Mock Next.js cookies with better implementation
if (typeof global.cookies === 'undefined') {
  global.cookies = jest.fn(() => ({
    get: jest.fn((name) => ({ name, value: 'test-value' })),
    set: jest.fn(),
    getAll: jest.fn(() => [{ name: 'test-cookie', value: 'test-value' }]),
    delete: jest.fn(),
  }))
}

// Mock Next.js headers with better implementation
if (typeof global.headers === 'undefined') {
  global.headers = jest.fn(() => ({
    get: jest.fn((name) => `test-${name}`),
    set: jest.fn(),
    getAll: jest.fn(() => [['test-header', 'test-value']]),
    delete: jest.fn(),
  }))
}

// Mock Next.js request context with proper structure
if (typeof global.__next_request_store__ === 'undefined') {
  global.__next_request_store__ = {
    get: jest.fn(() => ({
      cookies: global.cookies(),
      headers: global.headers(),
    })),
    set: jest.fn(),
  }
}

// Web API polyfills for Playwright tests
if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = class TransformStream {
    constructor() {
      return {
        readable: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {},
          }),
        },
        writable: {
          getWriter: () => ({
            write: () => Promise.resolve(),
            close: () => Promise.resolve(),
            abort: () => Promise.resolve(),
          }),
        },
      }
    }
  }
}

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor() {
      return {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      }
    }
  }
}

if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = class WritableStream {
    constructor() {
      return {
        getWriter: () => ({
          write: () => Promise.resolve(),
          close: () => Promise.resolve(),
          abort: () => Promise.resolve(),
        }),
      }
    }
  }
}

// Silence console errors during tests unless explicitly testing for them
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:') &&
      args[0].includes('ReactDOMTestUtils')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
