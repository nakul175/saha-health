const { test, expect } = require(process.env.SAHA_PLAYWRIGHT_MODULE ?? '@playwright/test');
test('reporting bridge synthetic browser action', async ({ page }) => {
  test.info().annotations.push({ type: 'scenario', description: process.env.SAHA_BRIDGE_SCENARIO ?? 'SCN-TC-BR-UX-01-A' });
  await page.setContent('<button id="review">Review synthetic record</button><p id="status">Pending</p><script>document.querySelector("button").onclick=()=>document.querySelector("p").textContent="Reviewed"</script>');
  await page.getByRole('button', { name: 'Review synthetic record' }).click();
  await expect(page.locator('#status')).toHaveText('Reviewed');
});
