#!/usr/bin/env python3
"""Real Chromium, mocked workspace transport. Does not test the Saha backend."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
import argparse
import json
import importlib.metadata
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--chromium', default='')
parser.add_argument('--out', default='/tmp/saha-today-ui')
args = parser.parse_args()
out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT / 'public')))
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
fixture = {'environment': 'synthetic', 'role': 'asha', 'user': {'userId': 'synthetic-asha'},
 'membership': {'userId': 'synthetic-asha', 'role': 'asha', 'status': 'active', 'displayName': 'Sunita'},
 'organisation': {'id': 'synthetic-org', 'name': 'Synthetic district'}, 'people': [
 {'id': 'p-1', 'assigned': True, 'name': 'Meena', 'village': 'Demo village', 'task': 'Routine follow-up', 'due': 'Today', 'status': 'due'},
 {'id': 'p-2', 'assigned': True, 'name': 'Meena', 'village': 'Another demo village', 'task': 'Visit', 'due': 'Tomorrow', 'status': 'in_progress'},
 {'id': 'p-3', 'assigned': False, 'name': 'Hidden person'}]}
checks = []
def check(name, ok):
    checks.append({'name': name, 'passed': bool(ok)})
    if not ok: raise AssertionError(name)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({'executable_path': args.chromium} if args.chromium else {}))
        context = browser.new_context(viewport={'width': 360, 'height': 640}, service_workers='block')
        page = context.new_page()
        request_methods = []
        state = {'body': fixture, 'status': 200}
        def response(route):
            request_methods.append(route.request.method)
            route.fulfill(status=state['status'], content_type='application/json', body=json.dumps(state['body']))
        page.route('**/api/workspace', response)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '/worker-today/')
        page.get_by_text('Work list loaded.', exact=False).wait_for()
        check('Two assigned records rendered', page.locator('article').count() == 2)
        check('Out-of-scope content absent', 'Hidden person' not in page.locator('body').inner_text())
        check('No horizontal overflow at 360x640', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        primary = page.locator('article.next .action').bounding_box()
        nav = page.locator('nav').bounding_box()
        check('Primary action not covered by navigation', primary['y'] + primary['height'] <= nav['y'])
        check('Primary touch target at least 44px', primary['height'] >= 44)
        check('Link reuses protected existing journey', page.locator('article.next .action').get_attribute('href') == '/app?patient=p-1')
        page.screenshot(path=str(out / 'today-360.png'), full_page=True)
        page.get_by_role('button', name='People', exact=True).click()
        page.get_by_label('Name, place or record').fill('meena')
        check('Duplicate names remain separate results', page.locator('article').count() == 2)
        page.get_by_label('Name, place or record').fill('Another')
        check('Contextual search narrows without guessing', page.locator('article').count() == 1 and page.locator('article .action').get_attribute('href') == '/app?patient=p-2')
        page.get_by_role('button', name='My Space', exact=True).click()
        check('No unimplemented earning/payment promise', 'have not been added here' in page.locator('#body').inner_text())
        check('No local personal data persistence', page.evaluate('localStorage.length === 0 && sessionStorage.length === 0'))
        check('No mutation request from navigation', set(request_methods) == {'GET'})
        state['body'] = {**fixture, 'people': []}; page.reload(); page.get_by_text('Work list loaded.', exact=False).wait_for()
        page.get_by_role('button', name='Today', exact=True).click()
        check('Successful empty list is explicit', 'No open work is listed' in page.locator('#body').inner_text())
        state['status'] = 403; page.reload(); page.get_by_role('alert').wait_for()
        check('Revocation clears people', page.locator('article').count() == 0 and 'Meena' not in page.locator('body').inner_text())
        check('Error is not shown as empty caseload', 'access could not be confirmed' in page.get_by_role('alert').inner_text())
        state['status'] = 200; state['body'] = {**fixture, 'people': None}; page.reload(); page.get_by_role('alert').wait_for()
        check('Malformed data produces error', 'work list could not be read' in page.get_by_role('alert').inner_text())
        state['body'] = {**fixture, 'patientPaging': {'total': 100, 'window': []}}; page.reload(); page.get_by_role('alert').wait_for()
        check('Incomplete paged list is not a complete task list', 'paged list' in page.get_by_role('alert').inner_text())
        attack = {**fixture['people'][0], 'name': '<img src=x onerror="window.pwned=1">', 'id': 'a&visit=evil#x'}
        state['body'] = {**fixture, 'people': [attack]}; page.reload(); page.get_by_text('Work list loaded.', exact=False).wait_for()
        check('Names render as text not HTML', page.locator('article img').count() == 0 and page.evaluate('window.pwned === undefined'))
        check('Identifier cannot inject query arguments', page.locator('article .action').get_attribute('href') == '/app?patient=a%26visit%3Devil%23x')
        page.evaluate('document.documentElement.style.fontSize="34px"')
        check('200% text reflows', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.locator('article .action').focus()
        check('Primary action keyboard focusable', page.locator('article .action').evaluate('(el)=>document.activeElement===el'))
        page.evaluate('document.documentElement.style.fontSize="17px"')
        page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(out/'text-safety-390.png'),full_page=True)
        page.evaluate('dispatchEvent(new Event("offline"))')
        check('Offline state clears stale interactive records', page.locator('article').count() == 0 and 'does not store visit data' in page.get_by_role('alert').inner_text())
        check('No browser exceptions', not errors)
        result = {'kind': 'Real Chromium / mocked workspace API; not built Saha backend or handset',
          'playwright': importlib.metadata.version('playwright'), 'browser': browser.version,
          'passed': len(checks), 'failed': 0, 'checks': checks}
        (out/'result.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result))
        browser.close()
except Exception as error:
    (out/'result.json').write_text(json.dumps({'kind': 'Browser test execution', 'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'execution': 'blocked_environment' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error) else 'failed', 'error': str(error), 'checks': checks}, indent=2))
    raise
finally:
    server.shutdown()
