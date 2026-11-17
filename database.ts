import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {Partner} from './types';
import {reconcileVerified,type ImportPayload} from './import-validation';
import {localSource} from './reference-data';
import {verifiedLinks} from './reference-data';
import {partnerIdForStakeholder,getStakeholder,stakeholderName,type Stakeholder,type ImplementationAssignment,sourceProjects} from './stakeholders';
const url=import.meta.env.VITE_SUPABASE_URL||'https://osqtrcxuwrskiqubdqpn.supabase.co';
// Publishable browser key from the existing application. No privileged key is used.
const publishable=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_k2zPGkJDZuKVQJMUH0AAsg_ofbv1-xN';
export type LiveRow={partner_id:number;partner_name:string;updated_at:string;[key:string]:unknown};
export type LiveContact={partner_id:number;first_name:string;last_name:string|null;position_title:string|null;email:string|null;phone:string|null;is_primary:boolean;is_active:boolean};
export type Snapshot={contacts:LiveContact[];rows:LiveRow[];details:Record<string,unknown>[];links:{partner_id:number;stakeholder_id:number}[];types:{partner_type_id:number;partner_type_name:string}[];ready:boolean;source:{stakeholders:Stakeholder[];projects:typeof sourceProjects;implementationAssignments:ImplementationAssignment[]}|null;role:string;fullName:string;loadedAt:string};
let client:SupabaseClient|null=null;
const needClient=()=>{if(!client)throw new Error('Sign in to the database first.');return client;};
export async function connectDatabase(email:string,password:string){
 if(client)await disconnectDatabase();client=createClient(url,publishable,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:true},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal||AbortSignal.timeout(30000)})}});
 const {error}=await client.auth.signInWithPassword({email,password});if(error){client=null;throw error;}
 try{return await refreshDatabase();}catch(e){await disconnectDatabase();throw e;}
}
export async function disconnectDatabase(){if(client){await client.auth.signOut();client=null;}}
export async function refreshDatabase():Promise<Snapshot>{
 const db=needClient();const {data:user,error:ue}=await db.auth.getUser();if(ue||!user.user)throw new Error('Your database session has expired. Sign in again.');
 const {data:profile,error:pe}=await db.from('app_users').select('full_name,is_active,user_roles(role_name)').eq('auth_user_id',user.user.id).single();
 if(pe||!profile?.is_active)throw new Error('This account is not an active application user.');
 const role=String((profile.user_roles as unknown as {role_name:string})?.role_name||'');
 const [{data:rows,error:re},{data:types,error:te},{data:contacts,error:ce}]=await Promise.all([db.from('partners').select('*').order('partner_name'),db.from('partner_types').select('partner_type_id,partner_type_name'),db.from('partner_contacts').select('partner_id,first_name,last_name,position_title,email,phone,is_primary,is_active')]);
 if(re)throw re;if(te)throw te;if(ce)throw ce;
 const {data:version,error:ve}=await db.rpc('whh_integration_status');
 if(ve&&!['PGRST202','42883'].includes(ve.code))throw ve;
 const ready=!ve&&version?.version===1;
 let source:Snapshot['source']=null;
 let details:Record<string,unknown>[]=[],links:{partner_id:number;stakeholder_id:number}[]=[];
 if(ready){const [a,b]=await Promise.all([db.from('whh_partner_details').select('*'),db.from('whh_promis_partner_links').select('partner_id,stakeholder_id')]);if(a.error)throw a.error;if(b.error)throw b.error;details=a.data||[];links=b.data||[];
 const [sp,sj,sa]=await Promise.all([db.from('whh_promis_partners').select('*'),db.from('whh_promis_projects').select('*').eq('is_current',true),db.from('whh_promis_assignments').select('*').eq('is_current',true)]);
 if(sp.error)throw sp.error;if(sj.error)throw sj.error;if(sa.error)throw sa.error;
 if(sp.data?.length)source={stakeholders:sp.data.map(r=>({id:Number(r.stakeholder_id),name:r.recorded_name,legalName:r.legal_name,entityNo:r.entity_number,displayedName:null,city:null,sourceTable:'dwh dim_stakeholders'})),projects:(sj.data||[]).map(r=>({id:r.project_code,projectTecId:null,name:r.project_name,status:r.project_status,recordCategory:r.record_category,start:r.start_date,end:r.end_date})),implementationAssignments:(sa.data||[]).map(r=>({projectId:r.project_code,projectTecId:null,stakeholderId:Number(r.stakeholder_id),sourceTable:'dwh fact_implementingPartners'}))};
 }
 return {contacts:contacts||[],rows:(rows||[]) as LiveRow[],details,links,types:types||[],ready,source,role,fullName:profile.full_name||emailFallback(user.user.email),loadedAt:new Date().toISOString()};
}
function emailFallback(email?:string){return email||'Database user';}
export const reconcileWorkbook=(snapshot:Snapshot)=>reconcileVerified(localSource.records,snapshot.rows,url===verifiedLinks.projectUrl?verifiedLinks.links:[]);
export function liveIdentityMap(snapshot:Snapshot){
 const result=new Map<string,LiveRow>();
 for(const r of reconcileWorkbook(snapshot))if(r.match)result.set(`local-workbook-${r.workbookPartnerId}`,r.match);
 for(const link of snapshot.links){const row=snapshot.rows.find(r=>r.partner_id===link.partner_id);if(row)result.set(partnerIdForStakeholder(link.stakeholder_id),row);}
 for(const row of snapshot.rows)result.set(`database-${row.partner_id}`,row);
 return result;
}
export function mergeLiveProfiles(base:Partner[],snapshot:Snapshot){
 const map=liveIdentityMap(snapshot),seen=new Set<number>();
 const merged=base.map(p=>{const r=map.get(p.id);if(!r)return p;seen.add(r.partner_id);return rowToProfile(p,r,snapshot)});
 for(const r of snapshot.rows)if(!seen.has(r.partner_id)){
  const empty:Partner={id:`database-${r.partner_id}`,name:'',acronym:'',type:'',typeOther:'',stage:'Not assessed',country:'',countryOther:'',city:'',regions:'',established:'',registration:'',legalForm:'',legalOther:'',expiry:'',email:'',contact:'',notes:'',updated:'',enabled:true};merged.push(rowToProfile(empty,r,snapshot));
 }
 return merged;
}
function rowToProfile(p:Partner,r:LiveRow,s:Snapshot):Partner{
 const detail=s.details.find(x=>Number(x.partner_id)===r.partner_id);const profile=(detail?.profile||{}) as Partial<Partner>;
 const rawType=s.types.find(t=>t.partner_type_id===r.partner_type_id)?.partner_type_name||'';
 const aliases:Record<string,string>={LNGO:'Local NGO',NNGO:'National NGO',INGO:'International NGO','Community-Based Organization':'Community-based organization'};
 const primary=s.contacts.find(c=>c.partner_id===r.partner_id&&c.is_primary&&c.is_active)||s.contacts.find(c=>c.partner_id===r.partner_id&&c.is_active);
 const str=(key:string)=>typeof r[key]==='string'?r[key] as string:'';
 return {...p,stage:str('partner_status')==='Prospective'?'Prospective':p.stage,...profile,id:p.id,contact:profile.contact??(primary?[primary.first_name,primary.last_name,primary.position_title].filter(Boolean).join(' '):''),email:profile.email??primary?.email??'',name:getStakeholder(p.id)?stakeholderName(getStakeholder(p.id)!):str('partner_name'),acronym:str('acronym'),type:aliases[rawType]||rawType,typeOther:str('partner_type_other'),registration:str('registration_number'),city:str('city')||str('headquarters_location'),country:str('country'),countryOther:'',regions:str('geographic_reach'),established:str('date_established'),notes:str('description'),enabled:r.is_active===true,updated:str('updated_at').slice(0,10)};
}
export async function saveSharedPartner(p:Partner,snapshot:Snapshot){
 if(!snapshot.ready)throw new Error('Run the database setup script before saving shared records.');
 const row=liveIdentityMap(snapshot).get(p.id);const source=getStakeholder(p.id);
 if(source&&!snapshot.links.some(l=>l.stakeholder_id===source.id)&&snapshot.rows.some(r=>r.acronym&&String(r.acronym).trim().toLowerCase()===String(source.name||'').trim().toLowerCase()))throw new Error('Review the possible existing partner identity before creating another shared profile.');
 const aliases:Record<string,string>={'Local NGO':'LNGO','International NGO':'INGO'};
 const previousType=snapshot.types.find(t=>t.partner_type_id===row?.partner_type_id);const equivalent=previousType&&(previousType.partner_type_name.toLowerCase()===p.type.toLowerCase()||previousType.partner_type_name===aliases[p.type]);
 const type=equivalent?previousType:snapshot.types.find(t=>t.partner_type_name.toLowerCase()===p.type.toLowerCase())||snapshot.types.find(t=>t.partner_type_name===aliases[p.type]);
 const payload={partner_name:p.name,acronym:p.acronym||null,registration_number:p.registration||null,partner_type_id:type?.partner_type_id||null,partner_type_other:p.type==='Other'?p.typeOther:null,date_established:p.established||null,city:p.city||null,headquarters_location:p.city||null,country:(p.country==='Other'?p.countryOther:p.country)||null,geographic_reach:p.regions||null,description:p.notes||null,is_active:p.enabled};
 const profile={stage:p.stage,legalForm:p.legalForm,legalOther:p.legalOther,expiry:p.expiry,email:p.email,contact:p.contact};
 const {data,error}=await needClient().rpc('whh_save_partner',{p_partner_id:row?.partner_id||null,p_expected_updated_at:row?.updated_at||null,p_fields:payload,p_profile:profile,p_stakeholder_id:source?.id||null});
 if(error)throw new Error(error.code==='40001'?'Someone else updated this partner. Refresh the database and review their changes before saving.':error.message);
 if(!data?.partner_id)throw new Error('The database did not confirm a saved partner.');
 try{return {id:Number(data.partner_id),snapshot:await refreshDatabase()};}catch{throw new Error('The partner was saved to the database, but the refreshed record could not be loaded. Refresh the database before making another change.');}
}
export async function applySourceImport(payload:ImportPayload,fileName:string){
 const {data,error}=await needClient().rpc('whh_apply_promis_import',{p_payload:payload,p_file_name:fileName});if(error)throw error;return data;
}
export async function getAudit(partnerId:number){const {data,error}=await needClient().from('whh_partner_audit').select('audit_id,changed_at,changed_by,table_name,operation,before_record,after_record').eq('partner_id',partnerId).order('changed_at',{ascending:false}).limit(30);if(error)throw error;return data||[];}

// Authenticated client only; privileged workflow operations are checked by SQL RPCs.
export const workflowClient=()=>needClient();
