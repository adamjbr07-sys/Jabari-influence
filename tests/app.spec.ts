import { test, expect, type Page } from '@playwright/test'

// Content OS v2 smoke. Mocks the three GET routes so it runs without a database;
// asserts the three-tab shell + empty states render and tab switching works.
// (Full pipeline + DB round-trips are covered by the API smoke + Vitest.)
// Requires the dev server running: `env -u SUPABASE_URL npm run dev`.

async function mockEmpty(page: Page) {
  await page.route('**/api/ideas', (r) => r.fulfill({ status: 200, body: JSON.stringify({ ideas: [] }) }))
  await page.route('**/api/posts', (r) => r.fulfill({ status: 200, body: JSON.stringify({ posts: [] }) }))
  await page.route('**/api/follower-logs', (r) => r.fulfill({ status: 200, body: JSON.stringify({ logs: [] }) }))
}

const headerTab = (page: Page, name: string) => page.locator('header').getByRole('button', { name })

test('renders the shell and pace cards', async ({ page }) => {
  await mockEmpty(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Content OS' })).toBeVisible()
  await expect(page.getByText('@adam.jbrr')).toBeVisible()
  // Today tab is default: pace cards for both platforms + the film empty state
  await expect(page.getByText('TikTok').first()).toBeVisible()
  await expect(page.getByText('Instagram').first()).toBeVisible()
  await expect(page.getByText(/Nothing queued/i)).toBeVisible()
})

test('switches tabs to Bank and Results', async ({ page }) => {
  await mockEmpty(page)
  await page.goto('/')

  await headerTab(page, 'Bank').click()
  await expect(page.getByText(/Idea bank/i)).toBeVisible()
  await expect(page.getByText(/Bank.s empty/i)).toBeVisible()

  await headerTab(page, 'Results').click()
  await expect(page.getByText(/Backfill recent posts/i)).toBeVisible()
  await expect(page.getByText(/No posts logged yet/i)).toBeVisible()
})

test('shows a graceful error when the API fails', async ({ page }) => {
  await page.route('**/api/ideas', (r) => r.fulfill({ status: 500, body: JSON.stringify({ error: 'boom' }) }))
  await page.route('**/api/posts', (r) => r.fulfill({ status: 200, body: JSON.stringify({ posts: [] }) }))
  await page.route('**/api/follower-logs', (r) => r.fulfill({ status: 200, body: JSON.stringify({ logs: [] }) }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})
