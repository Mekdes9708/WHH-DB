// Project page layout and project actions. Load after partner-admin.js.
(function () {
    'use strict';
    const canManage = () => isAdmin() && Boolean(state.project?.project_id);
    const inactiveText = value => value === null || value === undefined || value === '' ? 'Not recorded' : value;
    const category = (name, custom) => String(name || '').trim().toLowerCase() === 'other' && custom ? custom : name;

    async function addRecord(tab, loader, buttonId, button) {
        if (!canManage()) return;
        const projectId = state.project.project_id;
        button.disabled = true;
        try {
            switchTabs(projectTabs, tab);
            await loader();
            if (state.project?.project_id !== projectId) return;
            const add = $(buttonId);
            if (!add) throw new Error('Entry is unavailable. Check your admin role and access to this section.');
            add.click();
        } catch (error) {
            toast(error.message || 'Unable to open project entry.');
        } finally {
            button.disabled = false;
        }
    }

    function deleteProject() {
        if (!canManage()) return;
        const project = {...state.project};
        const confirmation = String(project.project_code || '').trim() || String(project.project_name || '').trim();
        openModal({
            title: 'Delete project',
            saveText: 'Delete project',
            body: `<p>Delete <strong>${esc(project.project_name)}</strong>?</p>
                <p>Deletion is allowed only if this project has no linked records. If it has partnerships, locations, budgets, participants, documents, or other links, deletion will be blocked.</p>
                <div class="form-group"><label for="projectDeleteConfirm">Type <strong>${esc(confirmation)}</strong> to confirm *</label><input id="projectDeleteConfirm" autocomplete="off" required></div>`,
            onSave: async () => {
                const typed = $('projectDeleteConfirm').value.trim();
                if (typed !== confirmation) throw new Error('The project confirmation does not match.');
                const {error} = await supabaseClient.rpc('whh_delete_unlinked_project', {
                    p_project_id: project.project_id,
                    p_confirmation: typed
                });
                if (error) throw new Error(error.message || 'Unable to delete this project.');
                state.project = null;
                $('projectHeaderActions')?.remove();
                showWorkspace('projects');
                await loadProjects();
                toast('Project deleted.');
            }
        });
    }

    window.renderProjectOverview = async function () {
        const project = state.project;
        const container = $('projectOverviewTabContent');
        if (!project || !container) return;
        const profile = $('projectProfileView');
        const header = profile?.querySelector('.record-header');
        header?.classList.add('project-summary-header');
        $('projectHeaderActions')?.remove();
        if (header && canManage()) {
            const actions = document.createElement('div');
            actions.id = 'projectHeaderActions';
            actions.className = 'project-page-actions';
            actions.innerHTML = '<button id="projectEditAction" class="primary-button" type="button">Edit project</button><button id="projectDeleteAction" class="project-delete-button" type="button">Delete project</button>';
            header.append(actions);
            $('projectEditAction').onclick = () => projectForm(state.project);
            $('projectDeleteAction').onclick = deleteProject;
        }
        const status = lookupName('project_statuses','project_status_id','project_status_name',project.project_status_id);
        const intervention = category(lookupName('intervention_types','intervention_type_id','intervention_type_name',project.intervention_type_id), project.intervention_type_other);
        container.innerHTML = `
            <section class="project-details-card">
                <h3>Project details</h3>
                <dl class="project-facts">
                    <div><dt>Status</dt><dd>${esc(inactiveText(status))}</dd></div>
                    <div><dt>Intervention type</dt><dd>${esc(inactiveText(intervention))}</dd></div>
                    <div><dt>Start date</dt><dd>${esc(fmtDate(project.start_date))}</dd></div>
                    <div><dt>End date</dt><dd>${esc(fmtDate(project.end_date))}</dd></div>
                    <div><dt>Co-designed</dt><dd>${project.is_co_designed == null ? 'Not recorded' : boolText(project.is_co_designed)}</dd></div>
                </dl>
                <div class="project-description"><h4>Description</h4><p>${esc(project.project_description || 'No description recorded.')}</p></div>
            </section>
            ${canManage() ? `
            <section class="project-entry-card">
                <div><h3>Add project records</h3><p>Record implementation locations, participant totals, sectors, and budgets. Review existing entries in the tabs above.</p></div>
                <div class="project-entry-actions">
                    <button id="projectAddLocationAction" class="secondary-button" type="button">Add location</button>
                    <button id="projectAddParticipantsAction" class="secondary-button" type="button">Add participant totals</button>
                    <button id="projectAddSectorAction" class="secondary-button" type="button">Add sector</button>
                    <button id="projectAddBudgetAction" class="secondary-button" type="button">Add budget</button>
                </div>
            </section>` : ''}`;
        if (canManage()) {
            $('projectAddLocationAction').onclick = event => addRecord('locations',loadProjectLocations,'addLocationBtn',event.currentTarget);
            $('projectAddParticipantsAction').onclick = event => addRecord('participants',loadProjectParticipants,'addParticipantBtn',event.currentTarget);
            $('projectAddSectorAction').onclick = event => addRecord('sectors',loadProjectSectors,'addSectorBtn',event.currentTarget);
            $('projectAddBudgetAction').onclick = event => addRecord('budgets',loadProjectBudgets,'addBudgetBtn',event.currentTarget);
        }
    };

    const originalProjectForm = window.projectForm;
    window.projectForm = function (record = null) {
        const result = originalProjectForm(record);
        const form = $('modalForm');
        const body = form?.querySelector('.modal-body');
        if (body) {
            const note = document.createElement('p');
            note.className = 'project-form-note';
            note.textContent = record
                ? 'Edit the project details here. Locations, participant totals, sectors, and budgets are managed from the saved project page.'
                : 'First save these basic details. The project page will then open with entry buttons for locations, participant totals, sectors, and budgets.';
            body.prepend(note);
        }
        const submit = form?.querySelector('button[type="submit"]');
        if (submit) submit.textContent = record ? 'Save changes' : 'Save and open project';
        return result;
    };
    if (state.project && !$('projectProfileView')?.classList.contains('hidden')) {
        window.renderProjectOverview();
    }
})();
