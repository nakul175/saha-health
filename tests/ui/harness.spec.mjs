// Harness self-checks. Each test here is marked test.fail(): it passes only when the check under it really fails, so a green run
// proves the accessibility scan, the browser-problem collector, the allow-list and the screenshot masks can all do their job.
// They need no Worker data: the pages are written in place.
import { test, expect } from './fixtures.mjs';

test.describe('the checks can fail', () => {
  test('the axe scan fails on inaccessible markup', async ({ lab }) => {
    test.fail(true, 'an image without a text alternative, an unlabelled field and an empty button must be reported as serious or critical');
    const page = await lab.open(null);
    await page.setContent('<!doctype html><html lang="en"><head><title>t</title></head><body><main><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><input type="text"><button></button></main></body></html>');
    await lab.scan(page, 'harness · inaccessible markup');
  });

  test('an uncaught page error fails the journey', async ({ lab }) => {
    test.fail(true, 'a thrown error in the page must be collected and fail the test');
    const page = await lab.open(null);
    await page.setContent('<!doctype html><html lang="en"><body><p>x</p></body></html>');
    await page.evaluate(() => { setTimeout(() => { throw new Error('harness: uncaught error'); }, 0); });
    await page.waitForTimeout(200);
  });

  test('a console error fails the journey', async ({ lab }) => {
    test.fail(true, 'console.error in the page must be collected and fail the test');
    const page = await lab.open(null);
    await page.setContent('<!doctype html><html lang="en"><body><p>x</p></body></html>');
    await page.evaluate(() => console.error('harness: unexpected console error'));
  });

  test('an HTTP 5xx answer fails the journey', async ({ lab }) => {
    test.fail(true, 'a 5xx response must be collected and fail the test');
    const page = await lab.open(null);
    await page.route('**/harness-boom', route => route.fulfill({ status: 500, body: 'boom' }));
    await page.goto('about:blank');
    await page.setContent('<!doctype html><html lang="en"><body><p>x</p></body></html>');
    await page.evaluate(() => fetch('http://127.0.0.1:1/harness-boom').catch(() => {}));
    await page.waitForTimeout(200);
  });

  test('an allow-list entry that does not match does not hide the message', async ({ lab }) => {
    test.fail(true, 'an allow entry for another message must not hide this one');
    lab.allow(/some other message/, 'harness: deliberately unrelated');
    const page = await lab.open(null);
    await page.setContent('<!doctype html><html lang="en"><body><p>x</p></body></html>');
    await page.evaluate(() => console.error('harness: a message that is not allowed'));
  });
});

test.describe('the checks that must pass', () => {
  test('an allow-list entry with a reason lets exactly that message through, and it is listed', async ({ lab }, testInfo) => {
    lab.allow(/harness: known harmless message/, 'harness: proves the allow-list works and is recorded');
    const page = await lab.open(null);
    await page.setContent('<!doctype html><html lang="en"><body><p>x</p></body></html>');
    await page.evaluate(() => console.error('harness: known harmless message'));
    await page.waitForTimeout(200);
    expect(lab.problems.map(p => p.text)).toEqual(['harness: known harmless message']);
    expect(() => lab.allow(/x/, '')).toThrow(/reason/);          // an entry without a reason is refused
  });

  test('screenshot masks hide dates, receipt numbers and codes; unmasked, the same page differs', async ({ lab }) => {
    const page = await lab.open(null);
    const render = async (date, receipt, code) => {
      await page.setContent(`<!doctype html><html lang="en"><body style="font:16px Arial"><p>Visit on ${date}</p><p>Receipt ${receipt}</p><p>Code ${code}</p><p>Fixed text</p></body></html>`);
      const masked = await page.screenshot({ mask: lab.dynamic(page), maskColor: '#9aa5ab' }), plain = await page.screenshot();
      return { masked, plain };
    };
    const a = await render('3 Oct 2026, 8:00 am', 'SIM-29E92672', 'B8A31713BE5CDE6EDEABA232');
    const b = await render('4 Nov 2026, 9:41 pm', 'SIM-0F0F0F0F', 'A1B2C3D4E5F60718293A4B5C');
    expect(Buffer.compare(a.plain, b.plain), 'without masks the two renders differ').not.toBe(0);
    expect(Buffer.compare(a.masked, b.masked), 'with masks the two renders are identical').toBe(0);
  });
});
