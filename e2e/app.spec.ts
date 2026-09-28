import { expect, test, type Page } from '@playwright/test'

const MATCH = 'b971c686-07f6-4378-ad00-71b0b610414e'

async function canvasPointFor(page: Page, u: number, v: number) {
  const box = (await page.locator('canvas.map-canvas').boundingBox())!
  const scale = (Math.min(box.width, box.height) / 1024) * 0.96
  const ox = (box.width - 1024 * scale) / 2
  const oy = (box.height - 1024 * scale) / 2
  return { x: box.x + ox + u * 1024 * scale, y: box.y + oy + (1 - v) * 1024 * scale }
}

test('loads the aggregate view with all maps', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.locator('.segmented button')).toHaveCount(3)
  await expect(page.locator('.context strong')).toHaveText('Ambrose Valley')
  await expect(page.locator('.match-section h2 .hint')).toHaveText('566')
  expect(errors).toEqual([])
})

test('filters by map and date', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Lockdown/ }).click()
  await expect(page.locator('.context strong')).toHaveText('Lockdown')
  const all = Number(await page.locator('.match-section h2 .hint').textContent())
  await page.locator('.chips .chip', { hasText: 'Feb 10' }).click()
  const filtered = Number(await page.locator('.match-section h2 .hint').textContent())
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(all)
  await expect(page).toHaveURL(/map=Lockdown/)
  await expect(page).toHaveURL(/days=2026-02-10/)
})

test('plays back a match and shows event tooltips at the right place', async ({ page, request }) => {
  await page.goto(`./#map=AmbroseValley&match=${MATCH}`)
  await expect(page.locator('.players li')).toHaveCount(15)

  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Pause' }).click()
  const clock = await page.locator('.clock strong').textContent()
  expect(clock).not.toBe('0:00')
  expect(clock).not.toBe('12:09')

  await page.locator('.timeline input[type=range]').fill('729')
  const data = await (await request.get('data/AmbroseValley.json')).json()
  const human = data.matches[MATCH].players.find((p: { bot: boolean }) => !p.bot)
  const kill = human.events.find((e: string[]) => e[3] === 'BotKill')
  const pt = await canvasPointFor(page, kill[1], kill[2])
  await page.mouse.move(pt.x, pt.y)
  await expect(page.locator('.tooltip')).toBeVisible()
  await expect(page.locator('.tooltip')).toContainText('killed a bot')
})

test('heatmap toggles and deep links restore state', async ({ page }) => {
  await page.goto('./#map=GrandRift&heat=death')
  await expect(page.locator('.context strong')).toHaveText('Grand Rift')
  await expect(page.getByRole('radio', { name: 'Deaths' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.heat-legend')).toBeVisible()
  await page.getByRole('radio', { name: 'Off' }).click()
  await expect(page.locator('.heat-legend')).toHaveCount(0)
})

test('clicking a marker in the aggregate view opens its match', async ({ page, request }) => {
  await page.goto('./#map=Lockdown')
  await expect(page.locator('.banner')).toBeVisible()
  const data = await (await request.get('data/Lockdown.json')).json()
  const [matchId, match] = Object.entries(data.matches).find(([, m]) =>
    (m as { players: { events: string[][] }[] }).players.some((p) => p.events.some((e) => e[3] === 'KilledByStorm')),
  ) as [string, { players: { events: [number, number, number, string][] }[] }]
  const storm = match.players.flatMap((p) => p.events).find((e) => e[3] === 'KilledByStorm')!
  const pt = await canvasPointFor(page, storm[1], storm[2])
  await page.mouse.move(pt.x, pt.y)
  await expect(page.locator('.tooltip')).toBeVisible()
  await page.mouse.click(pt.x, pt.y)
  await expect(page).toHaveURL(/match=/)
  expect(matchId.length).toBeGreaterThan(0)
  await expect(page.locator('.players')).toBeVisible()
})
