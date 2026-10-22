import { expect, test } from '@playwright/test'

test('landing renders branding and demo label', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /live arena/ })).toBeVisible()
  await expect(page.getByAltText('BloomBox').first()).toBeVisible()
  await expect(page.getByText('DEMO PREVIEW').first()).toBeVisible()
  await expect(page.getByTestId('try-demo')).toBeVisible()
  await expect(page.getByRole('button', { name: /Install App/ })).toBeVisible()
})

test('Enter Arena without Supabase explains connected mode is unavailable', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('enter-arena').click()
  await expect(page.getByRole('alert')).toContainText('Connected mode is not available')
})

test('protected routes redirect to sign-in', async ({ page }) => {
  await page.goto('/app/wallet')
  await expect(page).toHaveURL(/\/auth/)
})

test('participant can invest, edit and see the wallet change', async ({ page }) => {
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  await expect(page.getByText('Your balance')).toBeVisible()
  await page.goto('/app/events/evt_arena26/invest')
  await expect(page.getByText('Left to allocate')).toBeVisible()
  const first = page.getByLabel('AgriLoop amount')
  await first.fill('250')
  await page.getByRole('button', { name: 'Review allocation' }).click()
  await page.getByRole('button', { name: 'Confirm allocation' }).click()
  await expect(page.getByText('Allocation saved')).toBeVisible()
  await page.goto('/app/wallet')
  await expect(page.getByRole('main').getByText('Coins committed').first()).toBeVisible()
})

test('overspending is blocked in the UI', async ({ page }) => {
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  await page.goto('/app/events/evt_arena26/invest')
  await page.getByLabel('AgriLoop amount').fill('999999')
  await expect(page.getByRole('alert')).toContainText('more than you have')
  await expect(page.getByRole('button', { name: 'Review allocation' })).toBeDisabled()
})

test('every main route renders for a participant', async ({ page }) => {
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  for (const [path, text] of [
    ['/app/events', 'Events'], ['/app/events/evt_arena26', 'Startups'], ['/app/events/evt_arena26/teams/evt_arena26_t1', 'AgriLoop'],
    ['/app/events/evt_monsoon25/results', 'Final results'], ['/app/leaderboard', 'Leaderboard'], ['/app/profile', 'Profile'], ['/display/evt_arena26', 'Virtual prediction game'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByText(text).and(page.locator(':visible')).first()).toBeVisible()
  }
})

test('admin console is available to admins and hidden from participants', async ({ page }) => {
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/app/)
  await page.goto('/auth')
  await page.evaluate(() => localStorage.removeItem('bloombox.demo.session.v1'))
  await page.goto('/auth')
  await page.getByTestId('demo-admin').click()
  await expect(page.getByText('Council console')).toBeVisible()
  await page.getByText('BloomBox Pitch Arena 2026').click()
  await page.getByRole('tab', { name: 'Investing & settlement' }).click()
  await expect(page.getByText('Declare winner & settle')).toBeVisible()
})

test('no horizontal overflow on key routes', async ({ page }) => {
  await page.goto('/')
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  for (const path of ['/', '/demo', '/app', '/app/events/evt_arena26', '/app/events/evt_arena26/invest', '/app/wallet', '/app/leaderboard', '/display/evt_arena26']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, path).toBeLessThanOrEqual(1)
  }
})

test('reduced motion renders the 2D coin fallback instead of a canvas', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/')
  await expect(page.locator('[data-scene-fallback]').first()).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await ctx.close()
})

test('results page shows the podium', async ({ page }) => {
  await page.goto('/auth')
  await page.getByTestId('demo-participant').click()
  await page.goto('/app/events/evt_monsoon25/results')
  await expect(page.getByRole('list', { name: 'Podium' })).toBeVisible()
})
