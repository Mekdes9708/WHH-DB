export const workflowKinds=['contact','project','partnership','projectLink','meeting','action','document'] as const;
export type WorkflowKind=typeof workflowKinds[number];
export function validateWorkflow(kind:WorkflowKind,f:Record<string,unknown>){
 const required:Record<WorkflowKind,string[]>={contact:['partner_id','first_name'],project:['project_code','project_name'],partnership:['partner_id','partnership_title'],projectLink:['partnership_id','project_id'],meeting:['partnership_id','meeting_date','meeting_title'],action:['partnership_id','action_description','target_date','responsible_person','action_status_id'],document:['partner_id','document_title','document_type','storage_path']};
 for(const k of required[kind])if(f[k]==null||String(f[k]).trim()==='')throw new Error('Complete all required fields.');
 if(f.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email)))throw new Error('Enter a valid email address.');
 for(const [a,b] of [['start_date','end_date'],['contract_start_date','contract_end_date']])if(f[a]&&f[b]&&String(f[a])>String(f[b]))throw new Error('End date must be on or after the start date.');
 if(f.is_primary===true&&f.is_active===false)throw new Error('An inactive contact cannot be primary.');
 if(f.intervention_type_other!=null&&!String(f.intervention_type_other).trim())throw new Error('Specify the other intervention type.');
 for(const v of Object.values(f))if(typeof v==='string'&&v.length>12000)throw new Error('Text fields must be 12,000 characters or fewer.');
}
export function validateFile(file:{name:string;size:number}){
 if(file.size<=0||file.size>20*1024*1024)throw new Error('Choose a nonempty file no larger than 20 MB.');
 if(!/\.(pdf|docx|xlsx|csv|txt|png|jpg|jpeg)$/i.test(file.name))throw new Error('Use PDF, DOCX, XLSX, CSV, TXT, PNG or JPEG.');
}
