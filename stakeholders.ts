// External source terminology is retained in the adapter only; the UI has one Partners register.
export type Stakeholder={id:number;legalName:string|null;name:string|null;displayedName:string|null;entityNo:string|null;city:string|null;sourceTable:string};
export type StakeholderPartnerLink={partnerId:string;stakeholderId:number;countryOffice:string};
export type ImplementationAssignment={projectTecId:number|null;projectId:string;stakeholderId:number;sourceTable:string};
export type SourceProject={id:string;projectTecId:null;name:string;status:string;recordCategory:string;start:string;end:string};
export type FinanceReference={stakeholderId:number;projectId:string;year:number;sourceTable:string};
export const stakeholders:Stakeholder[]=[];
export const implementationAssignments:ImplementationAssignment[]=[];
export const sourceProjects:SourceProject[]=[];
export const partnerIdForStakeholder=(id:number)=>`promis-stakeholder-${id}`;
export const stakeholderPartnerLinks:StakeholderPartnerLink[]=[];
export const financeReferences:FinanceReference[]=[];
export const stakeholderName=(s:Stakeholder)=>s.legalName||s.displayedName||s.name||`Partner ${s.id}`;
export const getStakeholder=(partnerId:string)=>{const link=stakeholderPartnerLinks.find(x=>x.partnerId===partnerId);return link?stakeholders.find(s=>s.id===link.stakeholderId):undefined};
export function replaceSourceSnapshot(data:{stakeholders:Stakeholder[];projects:SourceProject[];implementationAssignments:ImplementationAssignment[]}){
 stakeholders.splice(0,stakeholders.length,...data.stakeholders);sourceProjects.splice(0,sourceProjects.length,...data.projects);implementationAssignments.splice(0,implementationAssignments.length,...data.implementationAssignments);
 stakeholderPartnerLinks.splice(0,stakeholderPartnerLinks.length,...stakeholders.map(s=>({partnerId:partnerIdForStakeholder(s.id),stakeholderId:s.id,countryOffice:'Ethiopia'})));
}
