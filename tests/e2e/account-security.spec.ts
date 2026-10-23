import {expect,test} from '@playwright/test';
test('deactivation requires fresh UI verification and explicit confirmation without claiming erasure',async({page})=>{
 const id='40000000-0000-4000-8000-000000000001';let verified=false;
 await page.route('**/api/v1/me',r=>r.fulfill({json:{data:{id,displayName:'Synthetic owner',locale:'en',timeZone:'UTC',revision:1,capabilities:[]}}}));
 await page.route('**/api/v1/auth/mfa',r=>{if(r.request().method()==='POST'){verified=true;return r.fulfill({json:{data:{verified:true}}});}return r.fulfill({json:{data:{factors:[{id,status:'verified'}]}}});});
 await page.route('**/api/v1/auth/deactivate',r=>{expect(verified).toBe(true);expect(r.request().postDataJSON()).toEqual({confirmation:'DEACTIVATE',expectedRevision:1});return r.fulfill({json:{data:{deactivated:true,recordedAt:'2026-10-18T00:00:00Z',revision:2,sessionsRevoked:true}}});});
 await page.goto('/app/settings');await page.getByText('Account security and deactivation',{exact:true}).click();
 const panel=page.getByRole('region',{name:'Account security',exact:true});await panel.getByText('Deactivate my account',{exact:true}).click();
 await expect(panel.getByRole('button',{name:'Deactivate my ORYQEN account'})).toBeDisabled();
 await panel.getByLabel('Account authenticator code').fill('123456');await panel.getByRole('button',{name:'Verify account authenticator'}).click();
 await panel.getByLabel('Type DEACTIVATE to confirm').fill('DEACTIVATE');await panel.getByRole('button',{name:'Deactivate my ORYQEN account'}).click();
 await expect(panel.getByRole('status')).toContainText('deactivated');await expect(panel).toContainText('This was not a deletion');
});
