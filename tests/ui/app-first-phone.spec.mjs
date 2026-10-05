// The additive /app route uses the actual authenticated workspace and record mutation flow.
import { test, expect } from './support/fixtures.mjs';
import { team, load, openPatient, field } from './support/flows.mjs';

test('app-first: tabs distinguish device sync, receipts and preserved visit review', async ({ lab }) => {
 const t=await team(lab),page=await load(lab,t.asha);
 await page.goto('/app');
 const nav=page.getByRole('navigation',{name:'App navigation'});
 await expect(nav.getByRole('button',{name:'Today',exact:true})).toBeVisible();
 await expect(page.getByText('This list is not filtered to today.',{exact:false})).toBeVisible();
 await nav.getByRole('button',{name:'Sync',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your sync centre'})).toBeVisible();
 await expect(page.getByText('Its encrypted queue is not read by this screen.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'View submissions'}).click();
 await expect(page.getByRole('heading',{name:'Programme submissions'})).toBeVisible();
 await nav.getByRole('button',{name:'More',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open full web workspace'})).toHaveAttribute('href','/');
 await expect(page.getByRole('button',{name:'Connections',exact:true})).toBeHidden();
 await nav.getByRole('button',{name:'Today',exact:true}).click();
 await openPatient(page);
 await page.getByRole('button',{name:'Start visit',exact:true}).click();
 await field(page,'Weight · kg').fill('57.5');
 await nav.getByRole('button',{name:'People',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toBeVisible();
 await page.getByRole('button',{name:'Keep editing'}).click();
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await expect(page.getByText('Draft saved in the workspace.')).toBeVisible();
 await page.getByRole('tab',{name:/Review & act/}).click();
 await expect(page.getByRole('button',{name:'Confirm visit',exact:true})).toBeDisabled();
 const w=await lab.workspace(t.asha,t.org),v=w.visits.find(v=>v.personId===t.meenaId);
 expect(v.state).toBe('draft');expect(v.facts.weight).toBe('57.5');
 const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
});
