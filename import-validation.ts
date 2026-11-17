export const normalizedName=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu,'');
export type SourcePartner={id:number;name:string;legalName:string|null;entityNo:string;displayedName:null;city:null;sourceTable:string};
export type SourceProject={id:string;projectTecId:null;name:string;status:string;recordCategory:string;start:string;end:string};
export type SourceAssignment={stakeholderId:number;projectId:string;projectTecId:null;sourceTable:string};
export type ImportPayload={stakeholders:SourcePartner[];projects:SourceProject[];implementationAssignments:SourceAssignment[]};
export function parseCsv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw new Error('Unexpected quote in CSV.');quoted=true;continue;}
  if(c===','||c==='\r'||c==='\n'){
   row.push(value);value='';closed=false;
   if(c!==','){if(row.some(v=>v!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}continue;
  }
  if(closed)throw new Error('Unexpected text after a closing quote.');value+=c;
 }
 if(quoted)throw new Error('CSV contains an unclosed quoted field.');
 row.push(value);if(row.some(v=>v!==''))rows.push(row);return rows;
}
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function validateImport(text:string):ImportPayload{
 const rows=parseCsv(text);if(rows.length<2)throw new Error('The CSV must contain a header and at least one relationship.');if(rows.length>25001)throw new Error('Use an export with at most 25,000 relationships.');
 const header=rows[0].map(s=>s.trim());const needed=['stakeholder_id','name','legal_name','entity_number','project_id','project_name','status','record_category','start_date','end_date'];
 if(new Set(header).size!==header.length)throw new Error('CSV has duplicate column names.');
 for(const c of needed)if(!header.includes(c))throw new Error(`Missing column: ${c}`);
 const partners=new Map<number,SourcePartner>(),projects=new Map<string,SourceProject>(),pairs=new Set<string>();const assignments:SourceAssignment[]=[];
 for(let i=1;i<rows.length;i++){
  if(rows[i].length!==header.length)throw new Error(`Row ${i+1}: number of fields differs from the header.`);
  const r=Object.fromEntries(header.map((h,j)=>[h,rows[i][j].trim()]));const id=Number(r.stakeholder_id);
  if(!/^\d+$/.test(r.stakeholder_id)||!Number.isSafeInteger(id)||id<=0)throw new Error(`Row ${i+1}: invalid stakeholder ID.`);
  for(const field of ['name','entity_number','project_id','project_name','status'])if(!r[field])throw new Error(`Row ${i+1}: ${field} is blank.`);
  if(!validDate(r.start_date)||!validDate(r.end_date)||r.start_date>r.end_date)throw new Error(`Row ${i+1}: invalid project dates.`);
  const p:SourcePartner={id,name:r.name,legalName:r.legal_name||null,entityNo:r.entity_number,displayedName:null,city:null,sourceTable:'dwh dim_stakeholders'};
  const project:SourceProject={id:r.project_id,projectTecId:null,name:r.project_name,status:r.status,recordCategory:r.record_category,start:r.start_date,end:r.end_date};
  if(partners.has(id)&&JSON.stringify(partners.get(id))!==JSON.stringify(p))throw new Error(`Conflicting details for stakeholder ${id}.`);
  if(projects.has(project.id)&&JSON.stringify(projects.get(project.id))!==JSON.stringify(project))throw new Error(`Conflicting details for project ${project.id}.`);
  const key=JSON.stringify([id,project.id]);if(pairs.has(key))throw new Error(`Duplicate relationship: ${id} / ${project.id}.`);
  partners.set(id,p);projects.set(project.id,project);pairs.add(key);assignments.push({stakeholderId:id,projectId:project.id,projectTecId:null,sourceTable:'dwh fact_implementingPartners'});
 }
 return {stakeholders:[...partners.values()],projects:[...projects.values()],implementationAssignments:assignments};
}
export function reconcileNames<T extends {partner_id:number;partner_name:string}>(local:{workbookPartnerId:number;name:string}[],live:T[]){
 return local.map(r=>{const matches=live.filter(p=>normalizedName(p.partner_name)===normalizedName(r.name));return {...r,match:matches.length===1?matches[0]:null,status:matches.length===1?'Exact name match':matches.length>1?'Multiple matches':'No match'};});
}

export function reconcileVerified<T extends {partner_id:number;partner_name:string;created_at?:unknown}>(local:{workbookPartnerId:number;name:string}[],live:T[],verified:{workbookPartnerId:number;partnerId:number;createdAt:string}[]){
 return reconcileNames(local,live).map(r=>{
  const link=verified.find(x=>x.workbookPartnerId===r.workbookPartnerId);
  const row=link?live.find(x=>x.partner_id===link.partnerId&&x.created_at===link.createdAt):undefined;
  return row?{...r,match:row,status:normalizedName(row.partner_name)===normalizedName(r.name)?'Verified ID and name':'Verified ID; name changed'}:r;
 });
}
