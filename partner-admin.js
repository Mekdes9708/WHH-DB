// Load after app.js, fixes.js, and participants.js.
// Adds category details and partner administration to the existing forms.
(function () {
    'use strict';
    const fields = {
        pfType: ['pfTypeOther', 'Partner Type'],
        pfLegal: ['pfLegalOther', 'Legal Status'],
        pfReach: ['pfReachOther', 'Geographic Reach'],
        psType: ['psTypeOther', 'Partnership Type'],
        editPartnershipType: ['editPartnershipTypeOther', 'Partnership Type'],
        prIntervention: ['prInterventionOther', 'Intervention Type'],
        buType: ['buTypeOther', 'Budget Type'],
        caType: ['caTypeOther', 'Assessment Type'],
        fbFrom: ['fbFromOther', 'Feedback Sender'],
        fbTo: ['fbToOther', 'Feedback Recipient'],
        agType: ['agOther', 'Agreement Type'],
        cgDomain: ['cgOther', 'Capacity Domain'],
        csType: ['csOther', 'Support Type'],
        fbType: ['fbTypeOther', 'Feedback Type'],
        fbMechanism: ['fbMechOther', 'Feedback Mechanism'],
        mtType: ['mtOther', 'Meeting Type'],
        acModule: ['acOther', 'Related Module'],
        stType: ['stOther', 'Success Type'],
        exReason: ['exOther', 'Reason for Ending'],
        exFuture: ['exFutureOther', 'Future Relationship'],
        dcType: ['dcOther', 'Document Type'],
        secId: ['secOther', 'Sector']
    };
    // Numeric category selectors must use real lookup IDs seeded by the SQL.
    const lookupFields = new Set(['pfType','pfLegal','psType','editPartnershipType','prIntervention','buType','cgDomain','fbMechanism','mtType','secId']);
    const other = select => String(select?.options[select.selectedIndex]?.textContent || '').trim().toLowerCase() === 'other';
    let editing = null;
    for (const name of ['partnerForm','projectForm']) {
        const original = window[name];
        window[name] = function(record = null) {
            editing = record;
            try { return original(record); }
            finally { editing = null; }
        };
    }

    const originalModal = window.openModal;
    window.openModal = function(options) {
        const record = editing;
        const wrapped = {...options};
        wrapped.onOpen = async () => {
            try {
                if(options.onOpen) await options.onOpen();
                for(const [id,[inputId,label]] of Object.entries(fields)) {
                    const select = $(id);
                    if(!select) continue;
                    if(![...select.options].some(o=>o.textContent.trim().toLowerCase()==='other') && !lookupFields.has(id)) {
                        select.add(new Option('Other','Other'));
                    }
                    let input = $(inputId);
                    if(!input) {
                        const group=document.createElement('div');
                        group.className='form-group hidden';
                        const title=document.createElement('label');
                        title.htmlFor=inputId;title.textContent=`Please specify ${label} *`;
                        input=document.createElement('input');input.id=inputId;input.maxLength=200;
                        group.append(title,input);select.closest('.form-group').insertAdjacentElement('afterend',group);
                        const column={pfLegal:'legal_status_other',prIntervention:'intervention_type_other'}[id];
                        if(column) input.value=record?.[column] || '';
                    }
                    const sync=()=>{
                        const chosen=other(select);
                        input.closest('.form-group').classList.toggle('hidden',!chosen);
                        input.required=chosen;input.disabled=!chosen;
                    };
                    select.addEventListener('change',sync);sync();
                }
            } catch(error) {
                $('modalMessage').textContent=error.message || 'Unable to prepare this form.';
            }
        };
        if(options.onSave) wrapped.onSave=async()=>{
            for(const [id,[inputId,label]] of Object.entries(fields)) {
                const select=$(id);
                if(select && other(select) && !$(inputId)?.value.trim()) throw new Error(`Please specify ${label}.`);
            }
            return options.onSave();
        };
        return originalModal(wrapped);
    };

    async function rpc(name,args) {
        const {data,error}=await supabaseClient.rpc(name,args);
        if(error) throw new Error(error.message || 'Unable to complete the action.');
        return data;
    }
    function adminButtons() {
        const edit=$('editPartnerButton');
        if(!edit) return;
        let archive=$('partnerDeactivateButton'), remove=$('partnerDeleteButton');
        if(!archive) {
            archive=document.createElement('button');archive.id='partnerDeactivateButton';archive.type='button';archive.className='secondary-button hidden';
            remove=document.createElement('button');remove.id='partnerDeleteButton';remove.type='button';remove.className='secondary-button hidden';remove.textContent='Delete partner';
            edit.parentElement.append(archive,remove);
        }
        const allowed=isAdmin() && Boolean(state.partner?.partner_id);
        archive.classList.toggle('hidden',!allowed);remove.classList.toggle('hidden',!allowed);
        const inactive=state.partner?.is_active===false || ['inactive','archived'].includes(String(state.partner?.partner_status || '').toLowerCase());
        archive.textContent=inactive?'Reactivate partner':'Deactivate partner';
        archive.onclick=()=>{
            if(!isAdmin() || !state.partner) return;
            const partner={...state.partner};
            const activate=partner.is_active===false || ['inactive','archived'].includes(String(partner.partner_status || '').toLowerCase());
            openModal({title:activate?'Reactivate partner':'Deactivate partner',body:`<p>${esc(partner.partner_name)}</p><p>${activate?'This restores the partner to Active status.':'This sets the partner to Inactive. All linked records and history are retained.'}</p>`,onSave:async()=>{
                await rpc('whh_set_partner_active',{p_partner_id:partner.partner_id,p_active:activate});
                await openPartner(partner.partner_id);toast(activate?'Partner reactivated.':'Partner deactivated.');
            }});
        };
        remove.onclick=()=>{
            if(!isAdmin() || !state.partner) return;
            const partner={...state.partner};
            openModal({title:'Delete partner',body:`<p>Delete <strong>${esc(partner.partner_name)}</strong>?</p><p>Deletion is allowed only when there are no linked records, including contacts, documents, projects, and partnerships. Deactivate the partner to retain history.</p><div class="form-group"><label for="partnerDeleteConfirm">Type the partner name to confirm *</label><input id="partnerDeleteConfirm" required autocomplete="off"></div>`,onSave:async()=>{
                const name=$('partnerDeleteConfirm').value.trim();
                if(name!==String(partner.partner_name).trim()) throw new Error('The partner name does not match.');
                await rpc('whh_delete_unlinked_partner',{p_partner_id:partner.partner_id,p_confirmation:name});
                state.partner=null;showWorkspace('partners');await loadPartners();toast('Partner deleted.');
            }});
        };
    }
    const originalPermissions=window.applyPermissions;
    window.applyPermissions=function(){originalPermissions();adminButtons();};
    const originalProjectOverview=window.renderProjectOverview;
    if(typeof originalProjectOverview==='function') window.renderProjectOverview=async function(){
        await originalProjectOverview();
        const container=$('projectOverviewTabContent');
        if(!container || !isAdmin() || !state.project?.project_id) return;
        const entry=document.createElement('section');
        entry.id='projectEntryActions';entry.className='section-panel';
        entry.innerHTML='<h3>Project data entry</h3><p>Add implementation locations and participant totals for this project. Use the Locations and Participants tabs to review or edit existing entries.</p><div class="record-toolbar-actions"><button id="projectAddLocationShortcut" type="button" class="primary-button">Add location</button><button id="projectAddParticipantsShortcut" type="button" class="primary-button">Add participant totals</button></div>';
        container.append(entry);
        $('projectAddLocationShortcut').onclick=async event=>{
            const button=event.currentTarget, projectId=state.project.project_id;
            button.disabled=true;
            try {
                switchTabs(projectTabs,'locations');await loadProjectLocations();
                if(state.project?.project_id!==projectId) return;
                const add=$('addLocationBtn');
                if(!add) throw new Error('Unable to open location entry. Check your admin role and location access.');
                add.click();
            } catch(error){toast(error.message || 'Unable to open location entry.');}
            finally{button.disabled=false;}
        };
        $('projectAddParticipantsShortcut').onclick=async event=>{
            if(!isAdmin() || !state.project) return;
            const button=event.currentTarget, projectId=state.project.project_id;
            button.disabled=true;
            try {
                switchTabs(projectTabs,'participants');await loadProjectParticipants();
                if(state.project?.project_id!==projectId) return;
                const add=$('addParticipantBtn');
                if(!add) throw new Error('Unable to open participant entry. Check your admin role and participant access.');
                add.click();
            } catch(error){toast(error.message || 'Unable to open participant entry.');}
            finally{button.disabled=false;}
        };
    };
    adminButtons();
})();
