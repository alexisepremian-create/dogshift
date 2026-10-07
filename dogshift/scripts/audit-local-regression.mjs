// Integration tests against the synthetic, isolated audit database/server only.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { encode } from 'next-auth/jwt';
import Stripe from 'stripe';
const url=new URL(process.env.DATABASE_URL||'');
if(url.hostname!=='127.0.0.1'||url.port!=='55437'||url.pathname!=='/dogshift_audit') throw new Error('LOCAL_AUDIT_DB_ONLY');
const db=new PrismaClient();
const base='http://localhost:3107';
const cookies={};
for(const role of ['owner','sitter']) cookies[role]='authjs.session-token='+await encode({token:{sub:'audit-'+role,email:role+'@example.test',role:role.toUpperCase()},secret:'local-audit-only-secret-never-production',salt:'authjs.session-token'});
async function post(path,body,role='owner',headers={}){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',cookie:cookies[role]||'',...headers},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
const passed=[];
try {
 await db.booking.updateMany({where:{userId:'audit-owner',sitterId:'s-audit',status:'PENDING_PAYMENT'},data:{status:'CANCELLED'}});
 await db.user.update({where:{id:'audit-google'},data:{passwordHash:null}});
 let r=await post('/api/auth/register',{email:'google@example.test',password:'AuditAttack123!',name:'Test'},'none');
 assert.equal(r.status,409); assert.equal((await db.user.findUnique({where:{id:'audit-google'},select:{passwordHash:true}})).passwordHash,null); passed.push('Existing passwordless account cannot be claimed');
 const freshEmail=`audit-${Date.now()}@example.test`;
 const signup=await post('/api/auth/register',{email:freshEmail,password:'AuditLocal123!',name:'Fictif audit'},'none');
 assert.equal(signup.status,200,JSON.stringify(signup));
 assert.ok((await db.user.findUnique({where:{email:freshEmail},select:{passwordHash:true}}))?.passwordHash);
 passed.push('New synthetic account registration succeeds with hashed password');
 for(const route of ['booking','activation','notification','logs','candidature','dog-news','relance-owner']){
   const response=await fetch(base+'/api/agents/'+route,{method:route==='logs'?'GET':'POST',headers:{'content-type':'application/json'},...(route==='logs'?{}:{body:'{}'})});
   assert.equal(response.status,401,route);
 }
 assert.equal((await post('/api/maestro',{},'none')).status,401); passed.push('Unauthenticated sensitive automation routes denied before side effects');
 await db.sitterProfile.update({where:{sitterId:'s-audit'},data:{avatarUrl:'data:image/png;base64,'+'A'.repeat(50000)}});
 const publicList=await fetch(base+'/api/sitters').then(r=>r.text()); assert.ok(!publicList.includes('A'.repeat(1000))); assert.ok(publicList.includes('/api/sitters/s-audit/avatar')); passed.push('Public listing returns an avatar URL, never the inline blob');
 const day=new Date(Date.now()+30*86400000).toISOString().slice(0,10), pensionDay=new Date(Date.now()+32*86400000).toISOString().slice(0,10), nextDay=new Date(Date.now()+33*86400000).toISOString().slice(0,10);
 const common={sitterId:'s-audit',dogProfileId:'audit-dog',dogSize:'small',ownerPhone:'+41790000000'};
 assert.equal((await post('/api/bookings',{...common,service:'Garde',startDate:day,endDate:day})).status,400);
 const ids=[];
 for(const c of [{service:'Garde',startAt:day+'T08:00:00Z',endAt:day+'T10:00:00Z'},{service:'Promenade',startAt:day+'T11:00:00Z',endAt:day+'T12:00:00Z'},{service:'Pension',startDate:pensionDay,endDate:nextDay}]){
   r=await post('/api/bookings',{...common,...c}); assert.equal(r.status,200,JSON.stringify(r)); ids.push(r.body.bookingId);
 }
 passed.push('Garde hourly, Promenade hourly and Pension overnight create valid bookings');
 const raceDay=new Date(Date.now()+41*86400000).toISOString().slice(0,10);
 const racePayload={...common,service:'Garde',startAt:raceDay+'T08:00:00Z',endAt:raceDay+'T10:00:00Z'};
 for(const bad of [{numberOfDogs:2},{additionalDogProfileIds:['audit-dog']},{dogProfileId:null},{dogProfileId:'not-owned'}]){
   assert.equal((await post('/api/bookings',{...racePayload,...bad})).status,400);
 }
 await db.dogProfile.update({where:{id:'audit-dog'},data:{weightKg:30}});
 await db.sitterProfile.update({where:{sitterId:'s-audit'},data:{acceptsLarge:false}});
 assert.equal((await post('/api/bookings',{...racePayload,dogSize:'small'})).body.error,'DOG_SIZE_NOT_ACCEPTED');
 await db.dogProfile.update({where:{id:'audit-dog'},data:{weightKg:8,neutered:false}});
 await db.sitterProfile.update({where:{sitterId:'s-audit'},data:{acceptsLarge:true,neuteredRequired:true}});
 assert.equal((await post('/api/bookings',racePayload)).body.error,'DOG_NOT_NEUTERED');
 await db.dogProfile.update({where:{id:'audit-dog'},data:{neutered:true}});
 await db.sitterProfile.update({where:{sitterId:'s-audit'},data:{neuteredRequired:false}});
 passed.push('Single owned dog required; real weight and sterilization cannot be bypassed by client fields');
 const race=await Promise.all([post('/api/bookings',racePayload),post('/api/bookings',racePayload)]);
 assert.deepEqual(race.map(x=>x.status).sort(),[200,409],JSON.stringify(race));
 const heldId=race.find(x=>x.status===200).body.bookingId;
 await db.booking.update({where:{id:heldId},data:{status:'PAYMENT_FAILED'}});
 assert.equal((await post('/api/bookings',racePayload)).status,409,'Failed but retryable payment must keep its slot');
 await db.booking.update({where:{id:heldId},data:{createdAt:new Date(Date.now()-31*60000)}});
 const replacement=await post('/api/bookings',racePayload);assert.equal(replacement.status,200,JSON.stringify(replacement));
 assert.equal((await db.booking.findUnique({where:{id:heldId}})).status,'CANCELLED');
 const expiredId=replacement.body.bookingId;
 await db.booking.update({where:{id:expiredId},data:{createdAt:new Date(Date.now()-31*60000)}});
 const expired=await post('/api/stripe/payment-intent',{bookingId:expiredId});assert.equal(expired.status,409);assert.equal(expired.body.error,'BOOKING_EXPIRED');
 passed.push('Concurrent slot creation has one winner; unpaid old holds expire and cannot start payment');
 const id=ids[0];
 const stripe=new Stripe('sk_test_local_audit_placeholder');
 async function webhook(paymentStatus,eventId){
  const payload=JSON.stringify({id:eventId,object:'event',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_local_'+id,object:'checkout.session',payment_status:paymentStatus,metadata:{bookingId:id}}}});
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_local_audit_only'});
  const response=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload});
  assert.equal(response.status,200,await response.text());
 }
 await webhook('unpaid','evt_local_unpaid'); assert.equal((await db.booking.findUnique({where:{id}})).status,'PENDING_PAYMENT'); passed.push('Unpaid signed checkout cannot confirm a booking');
 await webhook('paid','evt_local_paid'); let booking=await db.booking.findUnique({where:{id}}); assert.equal(booking.status,'PAID'); assert.ok(booking.paidAt); passed.push('Simulated signed payment sets PAID and paidAt');
 await webhook('paid','evt_local_paid'); assert.equal((await db.booking.findUnique({where:{id}})).status,'PAID');
 r=await post('/api/host/requests/'+id+'/accept',{},'sitter'); assert.equal(r.status,200,JSON.stringify(r)); assert.equal((await db.booking.findUnique({where:{id}})).status,'CONFIRMED'); passed.push('Authenticated sitter accepts request and confirms booking');
 await webhook('paid','evt_local_paid'); assert.equal((await db.booking.findUnique({where:{id}})).status,'CONFIRMED');
 await db.booking.update({where:{id},data:{status:'CANCELLED'}});
 await webhook('paid','evt_local_paid'); assert.equal((await db.booking.findUnique({where:{id}})).status,'CANCELLED'); passed.push('Webhook retries cannot downgrade confirmed or resurrect cancelled booking');
 const emails=await db.emailLog.count({where:{to:{endsWith:'@example.test'}}}).catch(()=>null);
 console.log(JSON.stringify({passed,emails,limitation:'Stripe event is generated locally; no Stripe charge, real provider delivery or transfer is tested.'},null,2));
} finally {await db.$disconnect();}
