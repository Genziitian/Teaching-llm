const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function load(file,mocks={}){const exports={};const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,Buffer,File,FormData,Response,Uint8Array,Date,console:{error(){}},process:{env:{RAZORPAY_KEY_ID:'test-key',RAZORPAY_KEY_SECRET:'test-secret'}},require:name=>mocks[name]||require(name)});return exports}
const policy=load('src/lib/exam-protection/policy.ts')
function server(db){return load('src/lib/exam-protection/server.ts',{'@/lib/db':{prisma:db},'./policy':policy})}
function route(db,session,extra={}){const services=server(db);return load('src/app/api/exam-protection/[[...path]]/route.ts',{'@/lib/db':{prisma:db},'@/lib/auth':{getSession:async()=>session},'@/lib/ratelimit':{checkRateLimit:async()=>({success:true})},'@/lib/exam-protection/policy':policy,'@/lib/exam-protection/server':services,'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},...extra})}
const student={userId:'student-a',role:'STUDENT',email:'student@example.test',name:'Student'}
const manager={userId:'manager-a',role:'MANAGER',email:'manager@example.test',name:'Manager'}
const details={reason:'Other reason',attempted:true,marks:'25.5',message:'Please review my result.',benefit:'refund',resultsReleased:true}
const context=(...path)=>({params:{path}})

test('each subject fee produces fee-minus-10 refunds and whole-rupee 1.5x discounts',()=>{
  for(const [fee,refund,discount]of[[10,0,15],[50,40,75],[61,51,92],[100,90,150]]){assert.equal(policy.refundForFee(fee),refund);assert.equal(policy.discountForFee(fee),discount)}
  assert.equal(policy.parseFee(''),null);assert.equal(policy.parseFee(null),null);assert.equal(policy.parseFee(undefined),undefined)
  for(const value of[-1,0,9,50.5,Infinity,'not a number',1000001])assert.throws(()=>policy.parseFee(value))
})
test('marks are required for attempted exams, with zero accepted; not-attempted claims keep marks null',()=>{
  assert.equal(policy.validateClaimDetails(details).marks,25.5)
  assert.equal(policy.validateClaimDetails({...details,marks:0}).marks,0)
  assert.equal(policy.validateClaimDetails({...details,attempted:false,marks:null}).marks,null)
  for(const marks of['',null,undefined,false,-1,'invalid',Infinity])assert.throws(()=>policy.validateClaimDetails({...details,marks}))
  for(const patch of[{reason:'invalid'},{attempted:'yes'},{benefit:'free'},{resultsReleased:false},{message:'x'.repeat(2001)}])assert.throws(()=>policy.validateClaimDetails({...details,...patch}))
})
test('student 60-day and manager 360-day visibility exclude the exact boundary',()=>{
  const now=new Date('2026-10-20T00:00:00Z')
  for(const days of[60,360]){assert.equal(policy.visible(new Date(now.getTime()-days*policy.DAY+1),days,now),true);assert.equal(policy.visible(new Date(now.getTime()-days*policy.DAY),days,now),false)}
})
test('proof cleanup deletes only expired media rows and keeps claims and purchase records',async()=>{
  let where
  const services=server({protectionProof:{deleteMany:async args=>{where=args.where;return{count:2}}},protectionClaim:{deleteMany:()=>assert.fail('Claim deletion is forbidden')},protectionPurchase:{deleteMany:()=>assert.fail('Purchase deletion is forbidden')}})
  assert.equal((await services.cleanupProtectionMedia()).count,2)
  assert.ok(where.expiresAt.lte instanceof Date)
})
test('proof expiry is anchored to original claim submission even after replacements',()=>{
  const services=server({}),submitted=new Date('2026-10-20T01:00:00Z')
  assert.equal(services.proofExpiry(submitted).getTime(),submitted.getTime()+60*policy.DAY)
})
test('proof upload validates content signature, MIME and size rather than trusting file extensions',async()=>{
  const services=server({})
  const form=new FormData();form.append('proof',new File([Buffer.from([137,80,78,71,13,10,26,10])],'results.png',{type:'image/png'}))
  assert.equal((await services.proofFile(form,true)).mime,'image/png')
  const bad=new FormData();bad.append('proof',new File(['<script>bad</script>'],'result.png',{type:'image/png'}))
  await assert.rejects(()=>services.proofFile(bad,true),/real PNG/)
  const huge=new FormData();huge.append('proof',new File([new Uint8Array(5*1024*1024+1)],'result.png',{type:'image/png'}))
  await assert.rejects(()=>services.proofFile(huge,true),/5 MB/)
  await assert.rejects(()=>services.proofFile(new FormData(),true),/Upload/)
})
test('student claim lookup is always scoped to the signed-in owner and 60-day visibility',async()=>{
  let query;const services=server({protectionClaim:{findFirst:async args=>{query=args;return null}}})
  await assert.rejects(()=>services.ownedClaim('someone-elses-claim',student),/not found/)
  assert.equal(query.where.purchase.userId,student.userId)
  assert.ok(query.where.createdAt.gt instanceof Date)
})
test('unauthenticated users cannot access protection data',async()=>{assert.equal((await route({},null).GET({},context())).status,401)})
test('students cannot edit manager-only course fees or service availability',async()=>{
  const api=route({},student)
  assert.equal((await api.PUT({json:async()=>({fee:50})},context('courses','course-a'))).status,403)
  assert.equal((await api.PUT({json:async()=>({isOpen:true})},context('settings'))).status,403)
})
test('unconfigured fee can be removed without editing the existing course service',async()=>{
  let update
  const db={course:{findUnique:async()=>({id:'course-a'})},protectionCourse:{upsert:async args=>{update=args;return args.update}}}
  const result=await route(db,manager).PUT({json:async()=>({fee:null})},context('courses','course-a'))
  assert.equal(result.status,200);assert.equal(update.update.fee,null)
})
test('closed service blocks payment creation before any provider or purchase write',async()=>{
  const db={protectionSettings:{findUnique:async()=>({isOpen:false})}}
  const result=await route(db,student).POST({json:async()=>({acceptedRules:true,courseId:'course-a'})},context('purchase'))
  assert.equal(result.status,409);assert.match(result.body.error,/closed/)
})
test('submitted claims use the verified purchase identity and fee; uploaded media has its own expiry',async()=>{
  let saved,notification
  const tx={protectionClaim:{create:async args=>{saved=args.data;return{id:'claim-a',status:'Submitted'}}},notification:{create:async args=>{notification=args.data}}}
  const db={protectionPurchase:{findFirst:async args=>{assert.equal(args.where.userId,student.userId);assert.equal(args.where.status,'PAID');return{id:'purchase-a',fee:61}}},$transaction:async fn=>fn(tx)}
  const form=new FormData();form.append('data',JSON.stringify({...details,purchaseId:'purchase-a',fee:999,refundAmount:999}));form.append('proof',new File([Buffer.from([137,80,78,71,13,10,26,10])],'result.png',{type:'image/png'}))
  const response=await route(db,student).POST({formData:async()=>form},context('claims'))
  assert.equal(response.status,201);assert.equal(saved.purchaseId,'purchase-a');assert.equal(saved.fee,undefined);assert.equal(saved.refundAmount,undefined)
  assert.equal(saved.proof.create.expiresAt.getTime(),saved.createdAt.getTime()+60*policy.DAY)
  assert.equal(notification.userId,student.userId)
})
test('manual refunds require approval and the exact amount paid minus 10',async()=>{
  const claim={id:'claim-a',status:'Approved',benefit:'refund',deliveredAt:null,purchase:{fee:61,userId:student.userId,user:{email:student.email}}}
  const db={protectionClaim:{findFirst:async()=>claim}}
  const response=await route(db,manager).POST({json:async()=>({action:'refund',delivered:true,refundAmount:40})},context('claims','claim-a','action'))
  assert.equal(response.status,400);assert.match(response.body.error,/exact fee/)
})
test('concurrent duplicate delivery is guarded by undelivered state, and notes never notify students',async()=>{
  let predicate,events=[],notifications=0
  const tx={protectionClaim:{updateMany:async args=>{predicate=args.where;return{count:1}},findUniqueOrThrow:async()=>({purchase:{userId:student.userId}})},protectionClaimEvent:{create:async args=>events.push(args.data)},notification:{create:async()=>notifications++}}
  const services=server({$transaction:async fn=>fn(tx)})
  await services.claimChange('claim-a','Processing',manager.userId,{deliveredAt:new Date(),status:'Processing'},'Refund sent')
  assert.equal(predicate.deliveredAt,null);assert.equal(notifications,1)
  await services.claimChange('claim-a','Processing',manager.userId,{},'Private review context',true)
  assert.equal(events[1].internal,true);assert.equal(notifications,1)
})
test('manager cannot complete a benefit before actual delivery',async()=>{
  const claim={id:'claim-a',status:'Approved',benefit:'refund',deliveredAt:null,purchase:{fee:50,userId:student.userId,user:{email:student.email}}}
  const db={protectionClaim:{findFirst:async()=>claim}}
  const response=await route(db,manager).POST({json:async()=>({action:'complete'})},context('claims','claim-a','action'))
  assert.equal(response.status,409)
})
test('mixed-subject bundles cannot receive a protection coupon',async()=>{
  const claim={id:'claim-a',status:'Approved',benefit:'coupon',deliveredAt:null,purchase:{fee:50,subject:'Python',userId:student.userId,user:{email:student.email}}}
  const db={protectionClaim:{findFirst:async()=>claim},coupon:{findUnique:async()=>({id:'coupon-a',discountType:'FIXED',discountValue:75,currentUses:0,isHidden:true,isActive:false})},couponUsage:{findFirst:async()=>null},bundleOffering:{findUnique:async()=>({id:'bundle-a',courses:[{course:{subject:'Python'}},{course:{subject:'Mathematics'}}]})}}
  const response=await route(db,manager).POST({json:async()=>({action:'coupon',delivered:true,code:'PYTHON75',bundleId:'bundle-a'})},context('claims','claim-a','action'))
  assert.equal(response.status,400);assert.match(response.body.error,/Mixed-subject/)
})
test('coupon reveal is owner-only and never restarts an existing seven-day expiry',async()=>{
  let updates=0
  const claim={id:'claim-a',createdAt:new Date(),deliveredAt:new Date(),couponId:'coupon-a',coupon:{id:'coupon-a'},purchase:{userId:student.userId,user:{email:student.email}}}
  const tx={protectionClaim:{updateMany:async()=>({count:0})},coupon:{update:async()=>updates++}}
  const db={protectionClaim:{findFirst:async()=>claim},$transaction:async fn=>fn(tx)}
  const response=await route(db,student).POST({},context('claims','claim-a','reveal'))
  assert.equal(response.status,200);assert.equal(updates,0)
  assert.equal((await route(db,{...student,userId:'other-user'}).POST({},context('claims','claim-a','reveal'))).status,403)
})

test('My Coupons stays owner-scoped and independent of the 60-day claim dashboard cutoff',async()=>{
  const oldClaim={id:'old-claim',createdAt:new Date(Date.now()-90*policy.DAY),couponRevealedAt:null,purchase:{courseName:'Python Quiz 1',fee:50},coupon:{code:'PRIVATE75',expiresAt:null,currentUses:0,maxUses:1,isActive:false}}
  const db={protectionProof:{deleteMany:async()=>({count:0})},protectionSettings:{findUnique:async()=>({isOpen:false})},protectionCourse:{findMany:async()=>[]},protectionPurchase:{findMany:async()=>[]},protectionClaim:{findMany:async args=>{if(args.where.couponId){assert.equal(args.where.purchase.userId,student.userId);assert.equal(args.where.createdAt,undefined);return[oldClaim]}return[]}}}
  const response=await route(db,student).GET({},context())
  assert.equal(response.status,200);assert.equal(response.body.claims.length,0);assert.equal(response.body.coupons.length,1);assert.equal(response.body.coupons[0].coupon.code,null)
})
test('coupon assignment narrows the existing coupon to the same account and eligible bundle',async()=>{
  let couponUpdate
  const claim={id:'claim-a',status:'Approved',benefit:'coupon',deliveredAt:null,purchase:{fee:61,subject:'Python',userId:student.userId,user:{email:student.email}}}
  const coupon={id:'coupon-a',code:'PYTHON92',discountType:'FIXED',discountValue:92,currentUses:0,isHidden:true,isActive:false}
  const tx={protectionClaim:{updateMany:async()=>({count:1})},coupon:{update:async args=>{couponUpdate=args.data}},protectionClaimEvent:{create:async()=>{}},notification:{create:async()=>{}}}
  const db={protectionClaim:{findFirst:async()=>claim},coupon:{findUnique:async()=>coupon},couponUsage:{findFirst:async()=>null},bundleOffering:{findUnique:async()=>({id:'python-only',name:'Python',courses:[{course:{subject:'Python',name:'Python Quiz 1'}}]})},$transaction:async fn=>fn(tx)}
  const response=await route(db,manager).POST({json:async()=>({action:'coupon',delivered:true,code:'PYTHON92',bundleId:'python-only'})},context('claims','claim-a','action'))
  assert.equal(response.status,200);assert.equal(couponUpdate.targetUserEmails,JSON.stringify([student.email]));assert.equal(couponUpdate.targetBundleIds,JSON.stringify(['python-only']));assert.equal(couponUpdate.isActive,false);assert.equal(couponUpdate.maxUses,1)
})
test('first coupon reveal starts exactly seven days; subsequent reveals cannot extend it',async()=>{
  let updated
  const claim={id:'claim-a',deliveredAt:new Date(),couponId:'coupon-a',coupon:{id:'coupon-a'},purchase:{userId:student.userId,user:{email:student.email}}}
  const tx={protectionClaim:{updateMany:async()=>({count:1})},coupon:{update:async args=>{updated=args.data}}}
  const db={protectionClaim:{findFirst:async args=>{assert.equal(args.where.createdAt,undefined);return claim}},$transaction:async fn=>fn(tx)}
  const before=Date.now(),response=await route(db,student).POST({},context('claims','claim-a','reveal'))
  assert.equal(response.status,200);assert.equal(updated.isActive,true);assert.ok(updated.expiresAt.getTime()>=before+7*policy.DAY);assert.ok(updated.expiresAt.getTime()<=Date.now()+7*policy.DAY)
})
test('multipart requests with oversized payloads are rejected before parsing file data',async()=>{
  const services=server({})
  const request=new Request('https://example.test/proof',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=test'},body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(6*1024*1024+1));controller.close()}}),duplex:'half'})
  await assert.rejects(()=>services.limitedForm(request),error=>error.status===413)
})
test('protection never activates on a forged payment callback',async()=>{
  const response=await route({},student).POST({json:async()=>({razorpay_order_id:'order-a',razorpay_payment_id:'pay-a',razorpay_signature:'0'.repeat(64)})},context('verify'))
  assert.equal(response.status,400);assert.match(response.body.error,/signature/)
})
test('captured provider amount and currency must match the fee snapshot before activation',async()=>{
  const crypto=require('node:crypto'),signature=crypto.createHmac('sha256','test-secret').update('order-a|pay-a').digest('hex')
  for(const amount of[6000,6100]){
    let activated=false
    class FakeProvider{payments={fetch:async()=>({order_id:'order-a'})};orders={fetchPayments:async()=>({items:[{id:'pay-a',order_id:'order-a',status:'captured',amount,currency:'INR'}]})}}
    const purchase={id:'purchase-a',status:'PENDING',userId:student.userId,fee:61,courseName:'Python Quiz 1'}
    const tx={protectionPurchase:{updateMany:async args=>{assert.equal(args.where.status,'PENDING');activated=true;return{count:1}}},notification:{create:async()=>{}}}
    const db={protectionPurchase:{findFirst:async args=>{assert.equal(args.where.userId,student.userId);return purchase},findUniqueOrThrow:async()=>({...purchase,status:'PAID'})},$transaction:async fn=>fn(tx)}
    const response=await route(db,student,{razorpay:FakeProvider}).POST({json:async()=>({razorpay_order_id:'order-a',razorpay_payment_id:'pay-a',razorpay_signature:signature})},context('verify'))
    assert.equal(response.status,amount===6100?200:409);assert.equal(activated,amount===6100)
  }
})
