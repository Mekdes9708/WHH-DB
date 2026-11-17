import {workflowClient} from './database';
import {validateWorkflow,validateFile,type WorkflowKind} from './workflow-validation';
export type RecordRow=Record<string,any>;
export type WorkflowData={ready:boolean;userId:string;contact:RecordRow[];project:RecordRow[];partnership:RecordRow[];projectLink:RecordRow[];meeting:RecordRow[];action:RecordRow[];document:RecordRow[];lookups:Record<string,RecordRow[]>};
export async function readWorkflows():Promise<WorkflowData>{
 const db=workflowClient();const {data,error}=await db.rpc('whh_workflow_read');
 if(error){if(['PGRST202','42883'].includes(error.code))return {ready:false,userId:'',contact:[],project:[],partnership:[],projectLink:[],meeting:[],action:[],document:[],lookups:{}};throw new Error(error.message)}return {...data,ready:true};
}
export async function saveWorkflow(kind:WorkflowKind,fields:RecordRow,row?:RecordRow){
 validateWorkflow(kind,fields);const {data,error}=await workflowClient().rpc('whh_workflow_save',{p_kind:kind,p_key:row?.whh_record_key||null,p_expected_at:row?.whh_updated_at||null,p_fields:fields});
 if(error)throw Object.assign(new Error(error.code==='40001'?'This record changed while you were editing. Refresh and review the latest version.':error.message),{code:error.code});if(!data?.whh_record_key)throw new Error('The database did not confirm this save.');return data;
}
export async function uploadDocument(partnerId:number,fields:RecordRow,file:File){
 validateFile(file);const path=`${partnerId}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const payload={...fields,partner_id:partnerId,storage_path:path,original_file_name:file.name,mime_type:file.type||null,file_size_bytes:file.size,context_module:'Partner'};
 validateWorkflow('document',payload);const bucket=workflowClient().storage.from('partnership-documents');const upload=await bucket.upload(path,file,{upsert:false});if(upload.error)throw new Error(upload.error.message);
 try{return await saveWorkflow('document',payload)}catch(e){
  // Only remove bytes after an explicit database rejection. A lost response may
  // follow a committed transaction, so automatic deletion would destroy evidence.
  const definite=typeof (e as {code?:string})?.code==='string'&&/^[0-9A-Z]{5}$/.test((e as {code:string}).code);
  if(definite){const cleanup=await bucket.remove([path]);throw new Error((e instanceof Error?e.message:String(e))+(cleanup.error?' File cleanup failed; ask a maintainer to check storage.':''));}
  throw new Error('The upload outcome could not be confirmed. Refresh Documents before retrying. A maintainer may need to check the uploaded file.');
 }
}
export async function openDocument(path:string){const {data,error}=await workflowClient().storage.from('partnership-documents').createSignedUrl(path,60);if(error)throw new Error(error.message);return data.signedUrl;}
