import { test, expect } from '@playwright/test'

test.describe('Survey Form Flow', () => {
  test('should load the survey and allow starting questions', async ({ page }) => {
    // Navigate to root (which serves or redirects to default research form)
    await page.goto('/')

    // Expect survey title to be visible
    await expect(page.locator('h1')).toBeVisible()

    // Find the start survey button
    const startButton = page.getByRole('button', { name: /Iniciar pesquisa|Start Survey/i })
    await expect(startButton).toBeVisible()

    // Click to start
    await startButton.click()

    // Verify first question appears with question numbering
    await expect(page.locator('h2')).toBeVisible()
    await expect(page.getByRole('button', { name: /OK|Próximo|Next/i })).toBeVisible()
  })

  test('should display validation error on empty required submission', async ({ page }) => {
    await page.goto('/')

    const startButton = page.getByRole('button', { name: /Iniciar pesquisa|Start Survey/i })
    await startButton.click()

    // Try to advance without selecting/filling anything
    const okButton = page.getByRole('button', { name: /OK|Próximo|Next/i })
    await okButton.click()

    // Expect validation error notice
    await expect(
      page.getByText(/Este campo é obrigatório|This field is required|Por favor, revise/i)
    ).toBeVisible()
  })
})
