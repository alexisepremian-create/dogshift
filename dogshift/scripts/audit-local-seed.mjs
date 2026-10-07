// Synthetic local data only. Never load a production environment for this script.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const url=new URL(process.env.DATABASE_URL||'');
if(url.hostname!=='127.0.0.1'||url.port!=='55437'||url.pathname!=='/dogshift_audit') throw new Error('LOCAL_AUDIT_DB_ONLY');
const db=new PrismaClient();
const passwordHash=await bcrypt.hash('AuditLocal123!',12);
for(const [id,email,role] of [['audit-owner','owner@example.test','OWNER'],['audit-sitter','sitter@example.test','SITTER'],['audit-google','google@example.test','OWNER']]){
 await db.user.upsert({where:{id},update:{},create:{id,email,name:id,role,passwordHash:id==='audit-google'?null:passwordHash,emailVerified:new Date(),...(role==='SITTER'?{sitterId:'s-audit'}:{})}});
}
await db.sitterProfile.upsert({where:{sitterId:'s-audit'},update:{termsVersion:'2026-01-15-v1'},create:{userId:'audit-sitter',sitterId:'s-audit',displayName:'Dogsitter fictif',city:'Lausanne',postalCode:'1000',bio:'Profil fictif utilisé uniquement dans les tests locaux.',published:true,verificationStatus:'approved',lifecycleStatus:'activated',services:['Promenade','Garde','Pension'],pricing:{Promenade:20,Garde:20,Pension:40},stripeAccountId:'acct_audit',stripeAccountStatus:'ENABLED',termsAcceptedAt:new Date(),termsVersion:'2026-01-15-v1',capacityPlaces:6,lat:46.52,lng:6.63,pensionVerifStatus:'approved',pensionAcceptedSizes:['small','medium','large']}});
for(const serviceType of ['PROMENADE','DOGSITTING','PENSION']){
 await db.serviceConfig.upsert({where:{sitterId_serviceType:{sitterId:'s-audit',serviceType}},update:{},create:{sitterId:'s-audit',serviceType,enabled:true,slotStepMin:30,minDurationMin:30,maxDurationMin:1440,leadTimeMin:0,bufferBeforeMin:0,bufferAfterMin:0,overnightRequired:serviceType==='PENSION'}});
 for(let dayOfWeek=0;dayOfWeek<7;dayOfWeek++){
  const id=`audit-${serviceType}-${dayOfWeek}`;
  await db.availabilityRule.upsert({where:{id},update:{},create:{id,sitterId:'s-audit',serviceType,dayOfWeek,startMin:0,endMin:1440,status:'AVAILABLE'}});
 }
}
await db.dogProfile.upsert({where:{id:'audit-dog'},update:{},create:{id:'audit-dog',userId:'audit-owner',name:'Chien fictif',weightKg:8,neutered:true}});
console.log('Synthetic local owner, sitter and dog ready.');
await db.$disconnect();
