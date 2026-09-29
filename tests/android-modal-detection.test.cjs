const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadHelper() {
  const filePath = path.join(__dirname, '..', 'src', 'components', 'AndroidAppModal.tsx')
  const code = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText

  const exports = {}
  const module = { exports }
  // Run with minimal browser/react mocks
  const fn = new Function('exports', 'module', 'require', transpiled)
  fn(exports, module, (name) => {
    if (name === 'react') return { useState: () => [false, () => {}], useEffect: () => {} }
    if (name === 'posthog-js') return { default: { capture: () => {} } }
    return {}
  })
  return module.exports
}

test('shouldShowAndroidAppModal detection rules', () => {
  const { shouldShowAndroidAppModal } = loadHelper()

  const ANDROID_CHROME_UA =
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36'
  const ANDROID_FIREFOX_UA =
    'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0'
  const IPHONE_SAFARI_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
  const IPAD_SAFARI_UA =
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  const MAC_DESKTOP_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const WINDOWS_DESKTOP_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  // 1. Android mobile browsers should show
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: ANDROID_CHROME_UA,
      pathname: '/',
    }),
    true,
    'Android Chrome should trigger modal'
  )

  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: ANDROID_FIREFOX_UA,
      pathname: '/login',
    }),
    true,
    'Android Firefox should trigger modal'
  )

  // 2. iOS devices should NEVER show
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: IPHONE_SAFARI_UA,
      pathname: '/',
    }),
    false,
    'iPhone should not trigger modal'
  )

  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: IPAD_SAFARI_UA,
      pathname: '/',
    }),
    false,
    'iPad should not trigger modal'
  )

  // iPadOS requesting desktop site
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: MAC_DESKTOP_UA,
      platform: 'MacIntel',
      maxTouchPoints: 5,
      pathname: '/',
    }),
    false,
    'iPadOS desktop UA should not trigger modal'
  )

  // 3. Desktop computers should NEVER show
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: MAC_DESKTOP_UA,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      pathname: '/',
    }),
    false,
    'Mac desktop should not trigger modal'
  )

  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: WINDOWS_DESKTOP_UA,
      platform: 'Win32',
      maxTouchPoints: 0,
      pathname: '/',
    }),
    false,
    'Windows desktop should not trigger modal'
  )

  // 4. Native Capacitor shell should NOT show (has its own sunset banner)
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: ANDROID_CHROME_UA,
      isNativeCapacitor: true,
      pathname: '/',
    }),
    false,
    'Capacitor native shell should be excluded'
  )

  // 5. Download page should NOT show (already on download screen)
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: ANDROID_CHROME_UA,
      pathname: '/download',
    }),
    false,
    '/download page should not show modal'
  )

  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: ANDROID_CHROME_UA,
      pathname: '/download/app',
    }),
    false,
    '/download/app page should not show modal'
  )

  // 6. Preview query param triggers on any device
  assert.equal(
    shouldShowAndroidAppModal({
      userAgent: MAC_DESKTOP_UA,
      search: '?preview-android-modal=true',
      pathname: '/',
    }),
    true,
    'Preview query param should allow testing on desktop'
  )
})
