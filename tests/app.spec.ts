import { test, expect, type Page } from '@playwright/test'

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_IDEAS = `1. POV: you're the only Muslim guy at your gym during Ramadan and you're fasting
2. POV: that one TA who has no idea what they're teaching either
3. POV: your Arab mum finds out you missed Fajr again
4. POV: engineering student tries to explain their degree to their parents
5. POV: you're in week 10 and still don't understand the course
6. POV: gym bro gives you unsolicited form advice mid-set
7. POV: trying to do dhikr between sets at the gym
8. How every STEM major's night before an exam sounds like
9. POV: you and your bro realise you're lowkey becoming uncs
10. POV: halal food struggle in a non-Muslim city`

const MOCK_HOOK = {
  hookText: "POV: you're the only Muslim guy at your gym during Ramadan and you're fasting",
  tiktokCaption: 'The gym during Ramadan hits different 😭 #fyp #gym #ramadan #muslim #muslimstudent #toronto',
  igCaption: 'Fasting + leg day = a different kind of suffering. 🤲 #muslimgym #ramadan #toronto',
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

async function mockIdeasAPI(page: Page) {
  await page.route('/api/ideas', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas: MOCK_IDEAS }),
    })
  )
}

async function mockHookAPI(page: Page) {
  await page.route('/api/hook', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HOOK),
    })
  )
}

async function mockAPIError(page: Page, path: string) {
  await page.route(path, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'authentication_error: invalid api key' }),
    })
  )
}

// ─── Locator helpers (avoids repeating selectors) ────────────────────────────

const loc = {
  situationInput: (page: Page) => page.locator('[data-testid="situation-input"]'),
  ideaInput: (page: Page) => page.locator('[data-testid="idea-input"]'),
  generateIdeasBtn: (page: Page) => page.locator('[data-testid="generate-ideas-btn"]'),
  generateHookBtn: (page: Page) => page.locator('[data-testid="generate-hook-btn"]'),
  ideasList: (page: Page) => page.locator('[data-testid="ideas-list"]'),
  savedList: (page: Page) => page.locator('[data-testid="saved-list"]'),
  categoryBtn: (page: Page, value: string) => page.locator(`[data-testid="category-${value}"]`),
  outputSection: (page: Page, key: string) => page.locator(`[data-testid="output-${key}"]`),
  copyBtn: (page: Page, key: string) => page.locator(`[data-testid="copy-${key}"]`),
  ideasTabHeader: (page: Page) => page.locator('header').getByRole('button', { name: /Ideas/ }),
  captionsTabHeader: (page: Page) => page.locator('header').getByRole('button', { name: /Hook/ }),
}

// ─── Page load & branding ────────────────────────────────────────────────────

test.describe('Page load', () => {
  test('loads with correct title and branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Content OS/)
    await expect(page.getByRole('heading', { name: 'Content OS' })).toBeVisible()
    await expect(page.getByText('@adam.jbrr')).toBeVisible()
  })

  test('Ideas tab is active by default', async ({ page }) => {
    await page.goto('/')
    await expect(loc.generateIdeasBtn(page)).toBeVisible()
  })

  test('both tab buttons are visible in header', async ({ page }) => {
    await page.goto('/')
    await expect(loc.ideasTabHeader(page)).toBeVisible()
    await expect(loc.captionsTabHeader(page)).toBeVisible()
  })
})

// ─── Tab navigation ──────────────────────────────────────────────────────────

test.describe('Tab navigation', () => {
  test('switching to Captions tab shows HookGenerator', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await expect(loc.generateHookBtn(page)).toBeVisible()
  })

  test('switching back to Ideas tab shows IdeaGenerator', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideasTabHeader(page).click()
    await expect(loc.generateIdeasBtn(page)).toBeVisible()
  })
})

// ─── Idea Generator ──────────────────────────────────────────────────────────

test.describe('Idea Generator', () => {
  test('all 5 category buttons are visible', async ({ page }) => {
    await page.goto('/')
    for (const cat of ['gym', 'muslim-arab', 'engineering', 'canadian', 'arab-canadian']) {
      await expect(loc.categoryBtn(page, cat)).toBeVisible()
    }
  })

  test('Gym is selected by default (amber styling)', async ({ page }) => {
    await page.goto('/')
    await expect(loc.categoryBtn(page, 'gym')).toHaveClass(/bg-amber-500/)
  })

  test('clicking Engineering selects it and deselects Gym', async ({ page }) => {
    await page.goto('/')
    await loc.categoryBtn(page, 'engineering').click()
    await expect(loc.categoryBtn(page, 'engineering')).toHaveClass(/bg-amber-500/)
    await expect(loc.categoryBtn(page, 'gym')).not.toHaveClass(/bg-amber-500/)
  })

  test('situation textarea accepts input', async ({ page }) => {
    await page.goto('/')
    await loc.situationInput(page).click()
    await loc.situationInput(page).fill('just finished midterms, feeling cooked')
    await expect(loc.situationInput(page)).toHaveValue('just finished midterms, feeling cooked')
  })

  test('Enter key in situation textarea triggers generate', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.situationInput(page).fill('test')
    await loc.situationInput(page).press('Enter')
    await expect(loc.ideasList(page)).toBeVisible()
  })

  test('generate button shows loading spinner while fetching', async ({ page }) => {
    await page.route('/api/ideas', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ideas: MOCK_IDEAS }),
      })
    })
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await expect(page.getByText('Generating...')).toBeVisible()
  })

  test('generates and displays 10 ideas', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await expect(loc.ideasList(page)).toBeVisible()
    const useButtons = loc.ideasList(page).getByRole('button', { name: 'Use this →' })
    await expect(useButtons).toHaveCount(10)
  })

  test('each idea has Copy and Save buttons', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await expect(loc.ideasList(page).getByRole('button', { name: 'Copy' }).first()).toBeVisible()
    await expect(loc.ideasList(page).getByRole('button', { name: 'Save' }).first()).toBeVisible()
  })

  test('Save button shows "✓ Saved" feedback briefly', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await expect(loc.ideasList(page).getByRole('button', { name: '✓ Saved' })).toBeVisible()
  })

  test('saving an idea adds it to Saved Ideas section', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText(/Saved Ideas \(1\)/)).toBeVisible()
  })

  test('removing a saved idea removes it from the list', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText(/Saved Ideas \(1\)/)).toBeVisible()
    await loc.savedList(page).getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText(/Saved Ideas/)).not.toBeVisible()
  })

  test('saved ideas persist after page reload', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await page.reload()
    await expect(page.getByText(/Saved Ideas \(1\)/)).toBeVisible()
  })

  test('API error shows helpful message', async ({ page }) => {
    await mockAPIError(page, '/api/ideas')
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await expect(page.getByText(/Add your Anthropic API key to \.env\.local/)).toBeVisible()
  })

  test('"Use this →" switches to Captions tab with idea pre-filled', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Use this →' }).first().click()
    await expect(loc.generateHookBtn(page)).toBeVisible()
    await expect(loc.ideaInput(page)).not.toHaveValue('')
  })

  test('regenerate button appears and re-fetches ideas', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await expect(page.locator('[data-testid="regenerate-ideas-btn"]')).toBeVisible()
    await page.locator('[data-testid="regenerate-ideas-btn"]').click()
    await expect(loc.ideasList(page)).toBeVisible()
  })

  test('saving same idea text twice does not duplicate it', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    // Save same idea twice
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText(/Saved Ideas \(1\)/)).toBeVisible()
  })
})

// ─── Trending Now ────────────────────────────────────────────────────────────

const MOCK_TRENDS = {
  reddit: ['Muslim gym bro trying to do dhikr between sets', 'Engineering exam survival guide'],
  google: ['Ramadan 2027 preparation', 'Toronto halal spots'],
}

async function mockTrendsAPI(page: Page) {
  await page.route('/api/trends*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TRENDS),
    })
  )
}

test.describe('Trending Now', () => {
  test('load trends button is visible on Ideas tab', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="load-trends-btn"]')).toBeVisible()
  })

  test('clicking load trends fetches and displays topics', async ({ page }) => {
    await mockTrendsAPI(page)
    await page.goto('/')
    await page.locator('[data-testid="load-trends-btn"]').click()
    await expect(page.locator('[data-testid="trends-list"]')).toBeVisible()
    const chips = page.locator('[data-testid="trends-list"] button')
    await expect(chips).toHaveCount(MOCK_TRENDS.reddit.length + MOCK_TRENDS.google.length)
  })

  test('clicking a trend pre-fills the situation input', async ({ page }) => {
    await mockTrendsAPI(page)
    await page.goto('/')
    await page.locator('[data-testid="load-trends-btn"]').click()
    await page.locator('[data-testid="trends-list"] button').first().click()
    await expect(loc.situationInput(page)).not.toHaveValue('')
  })

  test('trends reset when category changes', async ({ page }) => {
    await mockTrendsAPI(page)
    await page.goto('/')
    await page.locator('[data-testid="load-trends-btn"]').click()
    await expect(page.locator('[data-testid="trends-list"]')).toBeVisible()
    await loc.categoryBtn(page, 'engineering').click()
    await expect(page.locator('[data-testid="trends-list"]')).not.toBeVisible()
  })
})

// ─── Hook & Caption Generator ────────────────────────────────────────────────

test.describe('Hook & Caption Generator', () => {
  test('shows empty state tip when no idea entered', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await expect(page.getByText(/Use this →/)).toBeVisible()
  })

  test('generate button is disabled when textarea is empty', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await expect(loc.generateHookBtn(page)).toBeDisabled()
  })

  test('generate button enables when text is entered', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('POV: gym bro gives unsolicited advice')
    await expect(loc.generateHookBtn(page)).toBeEnabled()
  })

  test('char count updates as user types', async ({ page }) => {
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await expect(page.getByText('9 chars')).toBeVisible()
  })

  test('Enter key in idea textarea triggers generate', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.ideaInput(page).press('Enter')
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
  })

  test('Clear button resets the textarea and output', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('some idea')
    await loc.generateHookBtn(page).click()
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(loc.ideaInput(page)).toHaveValue('')
    await expect(loc.outputSection(page, 'hook')).not.toBeVisible()
  })

  test('generates and shows all 3 output sections', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('POV: gym bro gives unsolicited advice')
    await loc.generateHookBtn(page).click()
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
    await expect(loc.outputSection(page, 'tiktok')).toBeVisible()
    await expect(loc.outputSection(page, 'ig')).toBeVisible()
  })

  test('output sections contain correct content from API', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('POV: gym bro gives unsolicited advice')
    await loc.generateHookBtn(page).click()
    await expect(loc.outputSection(page, 'hook').getByText(MOCK_HOOK.hookText)).toBeVisible()
    await expect(loc.outputSection(page, 'tiktok').getByText(MOCK_HOOK.tiktokCaption)).toBeVisible()
    await expect(loc.outputSection(page, 'ig').getByText(MOCK_HOOK.igCaption)).toBeVisible()
  })

  test('each output section has its own Copy button', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await expect(loc.copyBtn(page, 'hook')).toBeVisible()
    await expect(loc.copyBtn(page, 'tiktok')).toBeVisible()
    await expect(loc.copyBtn(page, 'ig')).toBeVisible()
  })

  test('copy button changes to "✓ Copied" after click', async ({ page, context, isMobile }) => {
    // clipboard-write permission not available in WebKit mobile device emulation
    test.skip(isMobile, 'clipboard-write not supported in WebKit device emulation')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await loc.copyBtn(page, 'hook').click()
    await expect(loc.copyBtn(page, 'hook')).toHaveText('✓ Copied')
  })

  test('API error shows helpful message', async ({ page }) => {
    await mockAPIError(page, '/api/hook')
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await expect(page.getByText(/Add your Anthropic API key to \.env\.local/)).toBeVisible()
  })

  test('regenerate and copy all buttons appear after output', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await expect(page.locator('[data-testid="regenerate-hook-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="copy-all"]')).toBeVisible()
  })

  test('copy all button changes to "✓ Copied All" after click', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'clipboard-write not supported in WebKit device emulation')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockHookAPI(page)
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await page.locator('[data-testid="copy-all"]').click()
    await expect(page.locator('[data-testid="copy-all"]')).toHaveText('✓ Copied All')
  })

  test('loading spinner shows while generating captions', async ({ page }) => {
    await page.route('/api/hook', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_HOOK),
      })
    })
    await page.goto('/')
    await loc.captionsTabHeader(page).click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await expect(page.getByText('Writing captions...')).toBeVisible()
  })
})

// ─── Mobile layout ───────────────────────────────────────────────────────────

test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('bottom nav is visible on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav.fixed')).toBeVisible()
  })

  test('mobile bottom nav switches to Captions tab', async ({ page }) => {
    await page.goto('/')
    await page.locator('nav.fixed').getByText('Hook & Captions').click()
    await expect(loc.generateHookBtn(page)).toBeVisible()
  })

  test('mobile bottom nav switches back to Ideas tab', async ({ page }) => {
    await page.goto('/')
    await page.locator('nav.fixed').getByText('Hook & Captions').click()
    await page.locator('nav.fixed').getByText('Ideas').click()
    await expect(loc.generateIdeasBtn(page)).toBeVisible()
  })

  test('idea generator works correctly on mobile', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await expect(loc.categoryBtn(page, 'gym')).toBeVisible()
    await loc.generateIdeasBtn(page).click()
    await expect(loc.ideasList(page)).toBeVisible()
  })

  test('hook generator works correctly on mobile', async ({ page }) => {
    await mockHookAPI(page)
    await page.goto('/')
    await page.locator('nav.fixed').getByText('Hook & Captions').click()
    await loc.ideaInput(page).fill('test idea')
    await loc.generateHookBtn(page).click()
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
  })
})

// ─── Cross-tab flow ──────────────────────────────────────────────────────────

test.describe('Cross-tab flow', () => {
  test('"Use this →" from saved section pre-fills Captions tab', async ({ page }) => {
    await mockIdeasAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Save' }).first().click()
    await loc.savedList(page).getByRole('button', { name: 'Use this →' }).click()
    await expect(loc.generateHookBtn(page)).toBeVisible()
    await expect(loc.ideaInput(page)).not.toHaveValue('')
  })

  test('"Use this →" auto-generates captions without extra click', async ({ page }) => {
    await mockIdeasAPI(page)
    await mockHookAPI(page)
    await page.goto('/')
    await loc.generateIdeasBtn(page).click()
    await loc.ideasList(page).getByRole('button', { name: 'Use this →' }).first().click()
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
    await expect(loc.outputSection(page, 'tiktok')).toBeVisible()
    await expect(loc.outputSection(page, 'ig')).toBeVisible()
  })

  test('full flow: generate idea → use it → generate captions', async ({ page }) => {
    await mockIdeasAPI(page)
    await mockHookAPI(page)
    await page.goto('/')
    // Generate ideas
    await loc.generateIdeasBtn(page).click()
    await expect(loc.ideasList(page)).toBeVisible()
    // Send first idea to captions tab
    await loc.ideasList(page).getByRole('button', { name: 'Use this →' }).first().click()
    // Generate captions
    await loc.generateHookBtn(page).click()
    // All 3 sections visible
    await expect(loc.outputSection(page, 'hook')).toBeVisible()
    await expect(loc.outputSection(page, 'tiktok')).toBeVisible()
    await expect(loc.outputSection(page, 'ig')).toBeVisible()
  })
})
