const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
// Check the actual eligibility, refund and checkout expressions used in the page.
const functions = script.split('\n').filter(line => /^const (proofMediaAvailable|failureReasons|validClaimDetails|visibleOnDashboard|eligible|canPurchase|hasProtectionFee|discountAmount|refundAmount|couponValid)=/.test(line)).join('\n');
vm.runInNewContext(functions + `
assert.equal(eligible(false, 'quiz', 3), false);
assert.equal(eligible(true, 'quiz', 1), true);
assert.equal(eligible(true, 'term', 2), false);
assert.equal(eligible(true, 'term', 3), false);
assert.equal(canPurchase(false, false), false);
assert.equal(canPurchase(true, false), true);
assert.equal(canPurchase(true, true), false);
assert.equal(canPurchase(false, true), false);
// Service closure only gates new purchases, not an existing protected claim.
assert.equal(eligible(true, 'quiz'), true);
assert.equal(validClaimDetails('Marks below the passing requirement','yes','25'), true);
assert.equal(validClaimDetails('Did not attempt the exam','no',''), true);
assert.equal(validClaimDetails('Other reason','yes','0'), true);
assert.equal(validClaimDetails('Other reason','yes',''), false);
assert.equal(validClaimDetails('Other reason','yes','-1'), false);
assert.equal(validClaimDetails('Other reason','yes','not a number'), false);
assert.equal(validClaimDetails('Unknown','yes','10'), false);
assert.equal(validClaimDetails('Other reason','','10'), false);
const createdAt = 1000000000;
assert.equal(proofMediaAvailable(createdAt, createdAt+60*86400000-1), true);
assert.equal(proofMediaAvailable(createdAt, createdAt+60*86400000), false);
assert.equal(visibleOnDashboard(createdAt,360,createdAt+60*86400000), true);
for (const days of [60,360]) {
assert.equal(visibleOnDashboard(createdAt, days, createdAt), true);
assert.equal(visibleOnDashboard(createdAt, days, createdAt + days*86400000 - 1), true);
assert.equal(visibleOnDashboard(createdAt, days, createdAt + days*86400000), false);
assert.equal(visibleOnDashboard(createdAt, days, createdAt + (days+1)*86400000), false);
}
assert.equal(visibleOnDashboard(createdAt, 60, createdAt + 60*86400000), false);
assert.equal(visibleOnDashboard(createdAt, 360, createdAt + 60*86400000), true);
assert.equal(visibleOnDashboard(undefined, 60, createdAt), false);
assert.equal(refundAmount(50), 40);
assert.equal(refundAmount(61), 51);
assert.equal(discountAmount(50), 75);
assert.equal(discountAmount(61), 92);
assert.equal(discountAmount(100), 150);
assert.equal(hasProtectionFee(null), false);
assert.equal(hasProtectionFee(0), false);
assert.equal(hasProtectionFee(NaN), false);
assert.equal(hasProtectionFee(50), true);
assert.equal(hasProtectionFee(50.5), false);
assert.equal(refundAmount(5), 0);
const c = {assigned:true,course:'Statistics Quiz 1',expiry:'2027-01-01',used:0,limit:1};
assert.equal(couponValid(c, c.course, '2026-10-20'), true);
assert.equal(couponValid(c, 'Mathematics Quiz 1', '2026-10-20'), false);
assert.equal(couponValid(c, c.course, '2027-01-02'), false);
assert.equal(couponValid({...c, used:1}, c.course, '2026-10-20'), false);
assert.equal(couponValid({...c, assigned:false}, c.course, '2026-10-20'), false);
`, {assert});
assert.ok(!/free[- ]course/i.test(html), 'Free-course benefit must be removed');
assert.ok(!html.includes('value="term"'), 'Outcome B must not be offered');
assert.ok(!html.match(/<section id="courses">([\s\S]*?)<\/section>/)[1].includes('settings-fee'), 'Fee editor belongs in Manage Course');
assert.ok(html.includes('id="course-settings-form"'), 'Manage Course must include protection settings');
const purgeFunction = script.match(/function purgeExpiredProofMedia\(\)[\s\S]*?(?=\nfunction renderDashboards)/)[0];
const storedClaim = {id:'EP-TEST',createdAt:Date.now()-60*86400000,proof:'blob:original',reason:'Other reason',marks:25,context:'Keep this',notes:['Private note'],coupon:{code:'KEEP'}};
const keptMetadata = {...storedClaim}; delete keptMetadata.proof;
const removedUrls = [];
const fields = new Map();
vm.runInNewContext(functions + '\n' + purgeFunction + '\npurgeExpiredProofMedia();', {
  claim:storedClaim, proofUrl:'blob:preview', replacementUrl:'blob:replacement',
  Date, URL:{revokeObjectURL:url=>removedUrls.push(url)},
  $:id=>{if(!fields.has(id))fields.set(id,{value:'test',removeAttribute(){}});return fields.get(id);}
});
assert.equal(storedClaim.proof,null);
const remainingMetadata = {...storedClaim}; delete remainingMetadata.proof;
assert.deepEqual(remainingMetadata,keptMetadata,'Media cleanup must retain all other claim records');
assert.deepEqual(removedUrls,['blob:original','blob:preview','blob:replacement']);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const match of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), 'Missing element: '+match[1]);
for (const match of html.matchAll(/href="#([^\"]+)"/g)) assert.ok(ids.includes(match[1]), 'Missing navigation target');
console.log('Passed: 60-day proof retention, claim details validation, 60/360-day boundaries, syntax, coverage eligibility, fee deduction, coupon eligibility/expiry/usage, unique IDs and navigation targets.');
