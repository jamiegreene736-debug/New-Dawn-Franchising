import { test, expect } from "@playwright/test";
import { CAMPAIGN_TEMPLATES, CAMPAIGN_TEMPLATE_GUIDANCE, templateStepValues } from "../shared/campaign-templates";

test("templates preview and create a paused editable email/text campaign", async ({page}) => {
  let campaign: Record<string,unknown> | null=null;
  const writes: string[]=[];
  await page.route("**/api/**",async route=> {
    const url=new URL(route.request().url()),path=url.pathname;
    if(route.request().method()!=='GET') writes.push(path);
    let body: unknown=[];
    if(path==='/api/auth/me') body={role:'admin'};
    if(path==='/api/crm/campaign-templates') body={templates:CAMPAIGN_TEMPLATES,guidance:CAMPAIGN_TEMPLATE_GUIDANCE};
    if(path==='/api/crm/campaigns') body=campaign ? [campaign] : [];
    if(path==='/api/crm/campaign-templates/attorney-introductions/create') {
      const input=route.request().postDataJSON();
      expect(input.includeSms).toBe(true); expect(input.requestKey).toMatch(/^[a-f0-9-]{36}$/);
      campaign={id:'fixture',name:input.name,isActive:false,audienceType:'broker',outreachPolicy:'template_drip',templateId:'attorney-introductions',createdAt:new Date().toISOString(),steps:templateStepValues(CAMPAIGN_TEMPLATES[1],true).map((s,i)=>({...s,id:`step-${i}`,campaignId:'fixture'}))};
      body={id:'fixture',isActive:false};
    }
    if(path==='/api/crm/campaigns/fixture') body=campaign;
    if(path.endsWith('/stats')) body={overview:{},perStep:{}};
    if(path.endsWith('/schedule')) body={windowSummary:'Fixture schedule',enrollments:[]};
    if(path.endsWith('/placement-tests')) body={configured:false,senderReady:false,outreachPaused:true,tests:[]};
    if(path.endsWith('/spam-risk')) return route.fulfill({status:503,json:{message:'Fixture monitor unavailable'}});
    return route.fulfill({json:body});
  });
  await page.goto('/crm?tab=emails');
  await page.getByTestId('campaigns-tab-templates').click();
  await expect(page.getByTestId('campaign-template-library')).toBeVisible();
  await expect(page.getByTestId('use-template-broker-introductions')).toBeVisible();
  await expect(page.getByTestId('use-template-direct-client')).toBeVisible();
  await page.getByTestId('preview-template-attorney-introductions').click();
  await expect(page.getByTestId('template-preview')).toContainText('Immigration eligibility');
  await page.getByText('Reply resources and introduction notes',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Client-approved attorney introduction note'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Client-approved broker introduction note'})).toHaveCount(0);
  await page.getByTestId('use-template-attorney-introductions').click();
  await page.getByTestId('template-campaign-name').fill('Attorney pilot draft');
  await page.getByTestId('create-template-campaign').click();
  await expect(page.getByRole('heading',{name:'Attorney pilot draft'})).toBeVisible();
  await expect(page.getByTestId('button-toggle-campaign')).toContainText('Activate');
  await page.getByTestId('button-add-step').click();
  await expect(page.getByTestId('add-step-email')).toBeVisible();
  await expect(page.getByTestId('add-step-sms')).toBeVisible();
  await expect(page.getByTestId('add-step-call')).toHaveCount(0);
  await expect(page.getByTestId('add-step-linkedin_message')).toHaveCount(0);
  await page.getByTestId('add-step-email').click();
  await expect(page.getByTestId('step-trigger-type')).toBeDisabled();
  expect(writes).toEqual(['/api/crm/campaign-templates/attorney-introductions/create']);
});

test("template library fits mobile and retains keyboard-operable previews",async({page})=> {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/auth/me'?{role:'admin'}:new URL(route.request().url()).pathname==='/api/crm/campaign-templates'?{templates:CAMPAIGN_TEMPLATES,guidance:CAMPAIGN_TEMPLATE_GUIDANCE}:[]}));
  await page.goto('/crm?tab=emails');
  await page.getByTestId('campaigns-tab-templates').click();
  await page.getByTestId('preview-template-direct-client').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('template-preview')).toContainText('Direct client ownership review');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
