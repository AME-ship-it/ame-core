import assert from 'node:assert/strict';
export async function verifyPublicPassportBrowser(tab,origin){
 await tab.goto(origin+'/passport');await tab.playwright.getByLabel('Explore by agent ID',{exact:true}).fill('1');await tab.playwright.getByRole('button',{name:'Open Passport ↗',exact:true}).click();
 await tab.playwright.getByRole('button',{name:'Verify Passport ↗',exact:true}).waitFor({state:'visible',timeoutMs:30000});
 assert.ok((await tab.playwright.getByRole('article',{name:'AME Passport 1',exact:true}).count())===1);
 const share=await tab.playwright.getByRole('link',{name:'Share on X ↗',exact:true}).getAttribute('href');assert.equal(new URL(share).searchParams.get('url'),'https://www.ame.guru/passport/1');
 await tab.playwright.getByRole('button',{name:'Verify Passport ↗',exact:true}).click();await tab.playwright.getByText('Fresh onchain ownership checked. Server-attested activity records are consistent.',{exact:true}).waitFor({state:'visible',timeoutMs:30000});
 await tab.reload();await tab.playwright.getByRole('button',{name:'Verify Passport ↗',exact:true}).waitFor({state:'visible',timeoutMs:30000});
 return {publicRead:'PASS',verification:'PASS',reload:'PASS',shareURL:'PASS',walletSigning:'NOT PERFORMED'};
}
