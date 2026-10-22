import { expect, test } from '@playwright/test'

for (const min of [2, 3, 4]) {
  test(`${min}-minute demo completes within its duration`, async ({ page }) => {
    await page.clock.install()
    await page.goto('/demo')
    await page.getByTestId(`demo-${min}`).click()
    await page.clock.runFor(1000)
    await expect(page.getByText('Event complete')).toHaveCount(0)
    await page.clock.fastForward(min * 60_000 - 3000)
    await page.clock.runFor(1500)
    await expect(page.getByText('Event complete')).toHaveCount(0)
    await page.clock.runFor(2500)
    await expect(page.getByText('Event complete')).toBeVisible()
  })
}

test('demo: inspect a team, allocate coins, see wallet, restart and exit', async ({ page }) => {
  const calls: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) calls.push(r.url()) })
  await page.goto('/demo')
  await page.getByTestId('demo-3').click()
  await expect(page.getByText('SIMULATED').first()).toBeVisible()
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await page.getByRole('button', { name: /VoltNest/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'VoltNest profile' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pause demo' }).click()
  await page.getByRole('button', { name: 'Go to Invest' }).click()
  await page.getByLabel('VoltNest amount').fill('1200')
  await expect(page.getByRole('alert')).toContainText('more than you have')
  await page.getByLabel('VoltNest amount').fill('300')
  await page.getByRole('button', { name: 'Review allocation' }).click()
  await page.getByRole('button', { name: 'Confirm allocation' }).click()
  await expect(page.getByText(/Allocation saved/)).toBeVisible()
  await page.getByRole('button', { name: 'Go to Wallet' }).click()
  await expect(page.getByRole('list', { name: 'Simulated transactions' })).toContainText('Invested in VoltNest')
  await expect(page.getByText('700').first()).toBeVisible()
  await page.getByRole('button', { name: 'Restart demo' }).click()
  await expect(page.getByRole('heading', { name: /Welcome to the/ })).toBeVisible()
  await page.getByRole('button', { name: 'Exit demo' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(calls, 'demo made no external requests').toEqual([])
})

test('demo pause freezes the clock', async ({ page }) => {
  await page.goto('/demo')
  await page.getByTestId('demo-2').click()
  await page.getByRole('button', { name: 'Pause demo' }).click()
  const t = await page.getByLabel('Time elapsed and remaining').textContent()
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('Time elapsed and remaining')).toHaveText(t!)
  await page.getByRole('button', { name: 'Resume demo' }).click()
  await expect(page.getByLabel('Time elapsed and remaining')).not.toHaveText(t!)
})

test('install: fallback instructions without a prompt, native prompt when offered', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Install App/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => {}
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })
  await expect(page.getByRole('button', { name: /Install App/ })).toHaveAttribute('data-install-status', 'ready')
  await page.getByRole('button', { name: /Install App/ }).click()
  await expect(page.getByRole('button', { name: /App installed/ })).toBeDisabled()
})

test('offline: app shell and demo route load from the service worker', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Interactive demo' })).toBeVisible()
  await context.setOffline(false)
})
