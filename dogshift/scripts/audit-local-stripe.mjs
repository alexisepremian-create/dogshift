// Real Stripe SANDBOX API, synthetic local booking; never accepts a live key.
import fs from 'node:fs';import assert from 'node:assert/strict';import Stripe from 'stripe';import {PrismaClient} from '@prisma/client';import {encode} from 'next-auth/jwt';
const u=new URL(process.env.DATABASE_URL||'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55437');assert.equal(u.pathname,'/dogshift_audit');
const text=fs.readFileSync(process.env.AUDIT_STRIPE_ENV_FILE,'utf8');
const vars=Object.fromEntries(text.split('\n').filter(l=>!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
assert.ok(vars.STRIPE_SECRET_KEY?.startsWith('sk_test_'));const stripe=new Stripe(vars.STRIPE_SECRET_KEY);assert.equal((await stripe.balance.retrieve()).livemode,false);
const cookie='authjs.session-token='+await encode({token:{sub:'audit-owner',email:'owner@example.test',role:'OWNER'},secret:'local-audit-only-secret-never-production',salt:'authjs.session-token'});
const db=new PrismaClient();
const base='http://localhost:3107';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
try{
 const day=new Date(Date.now()+35*86400000).toISOString().slice(0,10);
 const availability=await fetch(base+`/api/sitters/s-audit/slots?date=${day}&service=DOGSITTING&durationMin=120`).then(r=>r.json());
 const slot=availability.slots?.find(s=>s.status==='AVAILABLE'&&s.startMin>=480);assert.ok(slot,'Available synthetic slot required');
 const start=new Date(slot.startAt),end=new Date(slot.endAt);
 const b=await post('/api/bookings',{sitterId:'s-audit',service:'Garde',startAt:start.toISOString(),endAt:end.toISOString(),dogProfileId:'audit-dog',ownerPhone:'+41790000000'});assert.equal(b.status,200,JSON.stringify(b));
 const bookingId=b.body.bookingId;
 const intents=await Promise.all([post('/api/stripe/payment-intent',{bookingId}),post('/api/stripe/payment-intent',{bookingId})]);
 for(const r of intents)assert.equal(r.status,200,JSON.stringify({status:r.status,error:r.body.error}));
 assert.equal(intents[0].body.intentId,intents[1].body.intentId);const pi=intents[0].body.intentId;
 assert.equal((await stripe.paymentIntents.retrieve(pi)).livemode,false);
 const confirmed=await stripe.paymentIntents.confirm(pi,{payment_method:'pm_card_visa',return_url:base+'/account/bookings'});assert.equal(confirmed.status,'succeeded');assert.equal(confirmed.livemode,false);
 const retry=await post('/api/stripe/payment-intent',{bookingId});assert.equal(retry.status,409);assert.equal(retry.body.error,'PAYMENT_ALREADY_COMPLETED');
 // Deliver the verified sandbox object locally; this tests the app signature path,
 // not the connectivity/configuration of a production Stripe webhook endpoint.
 const payload=JSON.stringify({id:'evt_local_sandbox_'+pi,object:'event',type:'payment_intent.succeeded',livemode:false,data:{object:confirmed}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_local_audit_only'});
 const r=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload});assert.equal(r.status,200,await r.text());
 const saved=await db.booking.findUnique({where:{id:bookingId}});assert.equal(saved.status,'PAID');assert.ok(saved.paidAt);
 console.log(JSON.stringify({bookingId,paymentIntentId:pi,livemode:false,status:confirmed.status,amount:confirmed.amount,currency:confirmed.currency,concurrentCreation:'same intent',retryAfterSuccess:'blocked 409',localWebhook:saved.status,chargeRecorded:Boolean(saved.stripeChargeId),limitations:['No real charge','No live webhook connectivity validation','No Connect payout to a sitter tested','TWINT/3DS/refund not tested']},null,2));
}finally{await db.$disconnect();}
