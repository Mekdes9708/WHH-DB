// ============================================================
// WHH PARTNERSHIP MANAGEMENT SYSTEM
// COMPLETE CONSOLIDATED APP.JS
// Matches the index.html provided in this chat.
// ============================================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// APPLICATION STATE
// ============================================================

const state = {
    role: "",
    profile: null,

    partner: null,
    partnership: null,
    project: null,
    meeting: null,

    lookups: {},

    partnerRows: [],
    partnershipRows: [],
    projectRows: []
};


// ============================================================
// BASIC HELPERS
// ============================================================

const $ = id =>
    document.getElementById(id);


const esc = value =>
    String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");


function emptyToNull(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value === "string" &&
        value.trim() === ""
    ) {
        return null;
    }

    return value;
}


function numOrNull(value) {

    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isNaN(number)
        ? null
        : number;
}


function boolText(value) {

    return value
        ? "Yes"
        : "No";
}


function fmtDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB"
    );
}


function fmtNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (
        Number.isNaN(number)
    ) {
        return value;
    }

    return number.toLocaleString();
}


function isAdmin() {

    return String(
        state.role || ""
    )
        .toLowerCase()
        .includes("admin");
}


function show(element) {

    element
        ?.classList
        .remove(
            "hidden"
        );
}


function hide(element) {

    element
        ?.classList
        .add(
            "hidden"
        );
}


function setText(
    id,
    value
) {

    const element =
        $(id);

    if (!element) {
        return;
    }

    element.textContent =
        (
            value === null ||
            value === undefined ||
            value === ""
        )
            ? "—"
            : value;
}


function setValue(
    id,
    value
) {

    const element =
        $(id);

    if (!element) {
        return;
    }

    element.value =
        value ?? "";
}


function toast(message) {

    const root =
        $("toastRoot");

    if (!root) {
        return;
    }

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "toast";

    element.textContent =
        message;

    root.appendChild(
        element
    );

    window.setTimeout(
        () =>
            element.remove(),
        3200
    );
}


// ============================================================
// STATUS DISPLAY
// ============================================================

function statusBadge(value) {

    const status =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();


    let className =
        "status-default";


    if (
        [
            "active",
            "completed",
            "approved",
            "closed",
            "addressed",
            "resolved",
            "signed"
        ].includes(status)
    ) {

        className =
            "status-active";
    }


    else if (
        [
            "planned",
            "planning",
            "closing",
            "open",
            "ongoing",
            "in progress",
            "improving",
            "draft",
            "under review",
            "reviewed"
        ].includes(status)
    ) {

        className =
            "status-planned";
    }


    else if (
        [
            "delayed",
            "suspended",
            "terminated",
            "cancelled",
            "overdue"
        ].includes(status)
    ) {

        className =
            "status-delayed";
    }


    return `
        <span
            class="
                status-badge
                ${className}
            "
        >
            ${esc(value || "—")}
        </span>
    `;
}


function emptyRow(
    body,
    span,
    message
) {

    if (!body) {
        return;
    }

    body.innerHTML =
        `
        <tr class="table-empty-row">
            <td colspan="${span}">
                ${esc(message)}
            </td>
        </tr>
        `;
}


// ============================================================
// LOOKUP HELPERS
// ============================================================

function lookupName(
    table,
    idField,
    nameField,
    id
) {

    const rows =
        state.lookups[table]
        || [];


    return (
        rows.find(
            row =>
                String(
                    row[idField]
                )
                ===
                String(id)
        )
        ?.[nameField]
    )
    || "";
}


function lookupIdByName(
    table,
    idField,
    nameField,
    name
) {
    const target = String(name || "").trim().toLowerCase();
    if (!target) return null;

    const row = (state.lookups[table] || []).find(
        item => String(item[nameField] || "").trim().toLowerCase() === target
    );

    return row ? Number(row[idField]) : null;
}


function selectedOptionText(selectId) {
    const select = $(selectId);
    if (!select) return "";
    return select.options[select.selectedIndex]?.textContent?.trim() || "";
}


async function ensurePartnershipTypeFromForm(selectId, otherInputId) {
    const select = $(selectId);
    if (!select) return null;

    const selectedText = selectedOptionText(selectId);
    const selectedId = numOrNull(select.value);

    if (selectedText.toLowerCase() !== "other") {
        return selectedId;
    }

    const customName = $(otherInputId)?.value?.trim() || "";
    if (!customName) {
        throw new Error("Please specify the Partnership Type.");
    }

    const existing = (state.lookups.partnership_types || []).find(
        row => String(row.partnership_type_name || "").trim().toLowerCase() === customName.toLowerCase()
    );

    if (existing) {
        return Number(existing.partnership_type_id);
    }

    const { data, error } = await supabaseClient
        .from("partnership_types")
        .insert({ partnership_type_name: customName, is_active: true })
        .select("partnership_type_id,partnership_type_name,is_active")
        .single();

    if (error) throw error;

    state.lookups.partnership_types = [
        ...(state.lookups.partnership_types || []),
        data
    ].sort((a, b) =>
        String(a.partnership_type_name || "").localeCompare(String(b.partnership_type_name || ""))
    );

    return Number(data.partnership_type_id);
}


function locationTypeId(name) {
    return lookupIdByName(
        "location_types",
        "location_type_id",
        "location_type_name",
        name
    );
}


function locationTypeNameById(id) {
    return lookupName(
        "location_types",
        "location_type_id",
        "location_type_name",
        id
    );
}


function isOfficialAdminLocation(row) {
    return Boolean(
        row &&
        row.admin_pcode &&
        String(row.source_version || "").toLowerCase() === "v04" &&
        !row.is_custom
    );
}


async function createOrReuseCustomLocation(name, typeName, parentLocationId) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;

    const typeId = locationTypeId(typeName);
    if (!typeId) {
        throw new Error(`Location type '${typeName}' is not configured.`);
    }

    let query = supabaseClient
        .from("locations")
        .select("location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom")
        .eq("location_type_id", typeId)
        .ilike("location_name", cleanName);

    if (parentLocationId === null || parentLocationId === undefined) {
        query = query.is("parent_location_id", null);
    } else {
        query = query.eq("parent_location_id", parentLocationId);
    }

    const { data: existing, error: findError } = await query.limit(1);
    if (findError) throw findError;

    if (existing?.length) {
        return existing[0];
    }

    const { data, error } = await supabaseClient
        .from("locations")
        .insert({
            location_name: cleanName,
            location_type_id: typeId,
            parent_location_id: parentLocationId ?? null,
            admin_pcode: null,
            source_version: "custom",
            is_custom: true
        })
        .select("location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom")
        .single();

    if (error) throw error;
    return data;
}


function buildLocationPath(locationId, locationMap) {
    const parts = [];
    const seen = new Set();
    let current = locationMap[locationId];

    while (current && !seen.has(current.location_id)) {
        seen.add(current.location_id);
        const typeName = locationTypeNameById(current.location_type_id);

        if (String(typeName).toLowerCase() !== "country") {
            parts.unshift(current.location_name);
        }

        if (!current.parent_location_id) break;
        current = locationMap[current.parent_location_id];
    }

    return parts.join(" → ");
}


function optionHtml(
    rows,
    idField,
    nameField,
    selected,
    placeholder = "Select..."
) {

    let html =
        `
        <option value="">
            ${esc(placeholder)}
        </option>
        `;


    html +=
        rows
            .map(
                row =>
                    `
                    <option
                        value="${esc(row[idField])}"
                        ${
                            String(
                                row[idField]
                            )
                            ===
                            String(
                                selected ?? ""
                            )
                                ? "selected"
                                : ""
                        }
                    >
                        ${esc(row[nameField])}
                    </option>
                    `
            )
            .join("");


    return html;
}


function otherVisible(
    selectId,
    groupId,
    inputId
) {

    const select =
        $(selectId);

    const group =
        $(groupId);

    const input =
        $(inputId);


    if (
        !select ||
        !group ||
        !input
    ) {
        return;
    }


    function sync() {

        const text =
            select
                .options[
                    select.selectedIndex
                ]
                ?.textContent
                ?.trim()
                .toLowerCase();


        const isOther =
            text === "other";


        group.classList.toggle(
            "hidden",
            !isOther
        );


        input.required =
            isOther;


        if (!isOther) {

            input.value =
                "";
        }
    }


    select.onchange =
        sync;


    sync();
}


// ============================================================
// DATABASE HELPERS
// ============================================================

async function safeSelect(
    table,
    columns = "*"
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(table)
            .select(columns);


    if (error) {
        throw error;
    }


    return data || [];
}


async function safeDelete(
    table,
    key,
    value
) {

    const {
        error
    } =
        await supabaseClient
            .from(table)
            .delete()
            .eq(
                key,
                value
            );


    if (error) {
        throw error;
    }
}


async function upsertRecord(
    table,
    payload,
    idField,
    idValue
) {

    let query;


    if (idValue) {

        query =
            supabaseClient
                .from(table)
                .update(payload)
                .eq(
                    idField,
                    idValue
                )
                .select()
                .single();
    }

    else {

        query =
            supabaseClient
                .from(table)
                .insert(payload)
                .select()
                .single();
    }


    const {
        data,
        error
    } =
        await query;


    if (error) {
        throw error;
    }


    return data;
}


// ============================================================
// MODAL
// ============================================================

function closeModal() {

    const root =
        $("modalRoot");

    if (root) {

        root.innerHTML =
            "";
    }

    document.body.classList.remove("modal-open");
}


function openModal({
    title,
    body,
    saveText = "Save",
    large = false,
    onOpen,
    onSave
}) {

    const root =
        $("modalRoot");


    if (!root) {
        return;
    }


    document.body.classList.add("modal-open");

    root.innerHTML =
        `
        <div class="modal-overlay">

            <div
                class="
                    modal-dialog
                    ${
                        large
                            ? "large-modal"
                            : ""
                    }
                "
            >

                <div class="modal-header">

                    <h3>
                        ${esc(title)}
                    </h3>

                    <button
                        type="button"
                        id="modalClose"
                        class="modal-close-button"
                    >
                        ×
                    </button>

                </div>


                <form id="modalForm">

                    <div class="modal-body">

                        ${body}

                        <div
                            id="modalMessage"
                            class="form-message"
                        ></div>

                    </div>


                    <div class="modal-footer">

                        <button
                            type="button"
                            id="modalCancel"
                            class="secondary-button"
                        >
                            Cancel
                        </button>


                        ${
                            onSave
                                ?
                                `
                                <button
                                    type="submit"
                                    class="primary-button"
                                >
                                    ${esc(saveText)}
                                </button>
                                `
                                :
                                ""
                        }

                    </div>

                </form>

            </div>

        </div>
        `;


    $("modalClose").onclick =
        closeModal;


    $("modalCancel").onclick =
        closeModal;


    if (onSave) {

        $("modalForm").onsubmit =
            async event => {

                event.preventDefault();


                $("modalMessage")
                    .textContent =
                    "";


                try {

                    await onSave();

                    closeModal();

                } catch (error) {

                    console.error(
                        error
                    );


                    $("modalMessage")
                        .textContent =
                        error.message
                        ||
                        "Unable to save record.";
                }
            };
    }


    if (onOpen) {

        window.setTimeout(
            onOpen,
            0
        );
    }
}


// ============================================================
// AUTHENTICATION
// ============================================================

async function loadApplication() {

    const {
        data: {
            user
        }
    } =
        await supabaseClient
            .auth
            .getUser();


    if (!user) {

        show(
            $("loginPage")
        );

        hide(
            $("appPage")
        );

        return;
    }


    // IMPORTANT:
    // Do not add user_role_id here.
    // The existing Supabase relationship already exposes user_roles.
    const {
        data: profile,
        error
    } =
        await supabaseClient
            .from("app_users")
            .select(`
                full_name,
                is_active,

                user_roles (
                    role_name
                )
            `)
            .eq(
                "auth_user_id",
                user.id
            )
            .single();


    if (
        error ||
        !profile ||
        !profile.is_active
    ) {

        await supabaseClient
            .auth
            .signOut();


        show(
            $("loginPage")
        );

        hide(
            $("appPage")
        );


        $("loginMessage")
            .textContent =
            error?.message
            ||
            "This account is not authorized.";


        return;
    }


    state.profile =
        profile;


    state.role =
        profile
            .user_roles
            ?.role_name
        || "";


    $("currentUserName")
        .textContent =
        profile.full_name
        ||
        user.email
        ||
        "";


    $("currentUserRole")
        .textContent =
        state.role;


    hide(
        $("loginPage")
    );

    show(
        $("appPage")
    );


    await loadLookups();

    applyPermissions();

    showWorkspace("home");
    await loadHomeOverview();
}


$("loginForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            $("loginMessage")
                .textContent =
                "";


            const email =
                $("email")
                    .value
                    .trim();


            const password =
                $("password")
                    .value;


            if (
                !email ||
                !password
            ) {

                $("loginMessage")
                    .textContent =
                    "Enter your email and password.";

                return;
            }


            const {
                error
            } =
                await supabaseClient
                    .auth
                    .signInWithPassword({
                        email,
                        password
                    });


            if (error) {

                $("loginMessage")
                    .textContent =
                    error.message;

                return;
            }


            await loadApplication();
        }
    );


$("logoutButton")
    ?.addEventListener(
        "click",
        async () => {

            await supabaseClient
                .auth
                .signOut();

            location.reload();
        }
    );


// ============================================================
// LOOKUPS
// ============================================================

async function loadLookups() {

    const lookupTables = [

        "partner_types",
        "legal_statuses",

        "partnership_types",
        "partnership_statuses",

        "project_statuses",
        "intervention_types",

        "agreement_statuses",

        "capacity_domains",

        "meeting_types",
        "action_statuses",

        "feedback_mechanisms",
        "feedback_resolution_statuses",

        "sustainability_statuses",

        "sectors",
        "budget_types",

        "localization_characteristics",

        "location_types"
    ];


    await Promise.all(

        lookupTables.map(

            async table => {

                try {

                    state.lookups[table] =
                        await safeSelect(
                            table
                        );

                } catch (error) {

                    console.warn(
                        `Lookup ${table}:`,
                        error.message
                    );


                    state.lookups[table] =
                        [];
                }
            }
        )
    );
}


// ============================================================
// ROLE PERMISSIONS
// ============================================================

function applyPermissions() {

    const admin =
        isAdmin();


    [
        "addPartnerButton",
        "editPartnerButton",
        "addContactButton",
        "addPartnershipForPartnerButton",
        "uploadPartnerDocumentButton",

        "addPartnershipButton",
        "editPartnershipButton",
        "addAgreementButton",
        "linkPartnershipProjectButton",
        "addCapacityAssessmentButton",
        "addEquityReviewButton",
        "addFeedbackButton",
        "addMeetingButton",
        "addSuccessStoryButton",
        "addExitStrategyButton",
        "uploadPartnershipDocumentButton",

        "addProjectButton",
        "uploadProjectDocumentButton",
        "addStandaloneMeetingButton"

    ]
        .forEach(
            id => {

                $(id)
                    ?.classList
                    .toggle(
                        "hidden",
                        !admin
                    );
            }
        );
}


// ============================================================
// MAIN NAVIGATION
// ============================================================

// Home overview: uses the signed-in user's existing Supabase permissions.
const homeOverview = (() => {
    const specs = {
        partners: ['partner_id', 'partner_id,partner_name'],
        partnerships: ['partnership_id', 'partnership_id,partnership_title,partner_id'],
        projects: ['project_id', 'project_id'],
        partnership_agreements: ['agreement_id', 'agreement_id,agreement_title,agreement_reference,partnership_id,expiry_date,agreement_status_id'],
        action_points: ['action_point_id', 'action_point_id,action_description,partnership_id,target_date,completion_date,action_status_id,responsible_person,assigned_to'],
        capacity_support_actions: ['capacity_support_id', 'capacity_support_id,capacity_gap_id,planned_support,support_status,completion_date,end_date'],
        capacity_followups: ['capacity_followup_id', 'capacity_followup_id,capacity_support_id,capacity_gap_id,followup_date'],
        capacity_gaps: ['capacity_gap_id', 'capacity_gap_id,capacity_assessment_id'],
        capacity_assessments: ['capacity_assessment_id', 'capacity_assessment_id,partnership_id']
    };
    const closed = value => /^(completed|closed|cancelled|canceled|terminated|expired)$/i.test(String(value || '').trim());
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    let data = {}, errors = {}, generation = 0;
    const expanded = new Set();

    async function readRows(table) {
        const [id, columns] = specs[table];
        const rows = [];
        let start = 0;
        while (true) {
            const result = await supabaseClient.from(table).select(columns).order(id).range(start, start+999);
            if (result.error) throw result.error;
            if (!result.data?.length) return rows;
            rows.push(...result.data);
            start += result.data.length;
        }
    }

    function status(table, idKey, nameKey, id) {
        return (state.lookups[table] || []).find(row => String(row[idKey]) === String(id))?.[nameKey] || '';
    }

    function calculate(rows, today, days) {
        const end = new Date(`${today}T12:00:00`);
        end.setDate(end.getDate()+days);
        const lastDay = dateKey(end);
        const agreements = (rows.partnership_agreements || []).filter(row =>
            row.expiry_date && row.expiry_date >= today && row.expiry_date <= lastDay &&
            !closed(status('agreement_statuses','agreement_status_id','agreement_status_name',row.agreement_status_id))
        ).sort((a,b) => a.expiry_date.localeCompare(b.expiry_date));
        const actions = (rows.action_points || []).filter(row =>
            row.target_date && row.target_date < today && !row.completion_date &&
            !closed(status('action_statuses','action_status_id','action_status_name',row.action_status_id))
        ).sort((a,b) => a.target_date.localeCompare(b.target_date));
        const supports = (rows.capacity_support_actions || []).filter(row => {
            if (String(row.support_status || '').trim().toLowerCase() !== 'completed') return false;
            // A support-specific follow-up or a later gap-level follow-up counts.
            return !(rows.capacity_followups || []).some(followup => {
                if (String(followup.capacity_support_id) === String(row.capacity_support_id)) return true;
                const completion = row.completion_date || row.end_date;
                return followup.capacity_support_id == null && completion && followup.followup_date >= completion &&
                    String(followup.capacity_gap_id) === String(row.capacity_gap_id);
            });
        }).sort((a,b) => String(a.completion_date || a.end_date || '').localeCompare(String(b.completion_date || b.end_date || '')));
        return {agreements, actions, supports};
    }

    function partnershipLabel(id) {
        const p = data.partnerships?.find(row => String(row.partnership_id) === String(id));
        const partner = data.partners?.find(row => String(row.partner_id) === String(p?.partner_id));
        return partner?.partner_name || p?.partnership_title || (id ? `Partnership ${id}` : 'No partnership linked');
    }

    function recordButton(id, tab) {
        if (!id) return '';
        return `<button type="button" class="inline-button" data-overview-partnership="${esc(id)}" data-overview-tab="${tab}">Open partnership</button>`;
    }

    function panel(id, rows, dependencies, makeRow, empty) {
        const target = $(id);
        if (!target) return;
        const failed = dependencies.some(table => errors[table]);
        if (failed) { target.textContent = 'Unable to load this section. Please refresh or check your access.'; return; }
        if (!rows.length) { target.textContent = empty; return; }
        const shown = expanded.has(id) ? rows : rows.slice(0,8);
        target.innerHTML = `<ul class="overview-list">${shown.map(makeRow).join('')}</ul>` +
            (rows.length > 8 ? `<button type="button" class="text-button overview-expand" data-overview-expand="${id}">${expanded.has(id) ? 'Show fewer' : `Show all ${rows.length}`}</button>` : '');
    }

    function render() {
        const today = dateKey(new Date());
        const days = Number($('homeExpiryWindow')?.value || 30);
        const result = calculate(data,today,days);
        const metrics = [
            ['homePartnerCount','partners'], ['homePartnershipCount','partnerships'], ['homeProjectCount','projects']
        ];
        metrics.forEach(([id,table]) => { $(id).textContent = errors[table] ? 'Unavailable' : String(data[table]?.length || 0); });
        const metric = (id, value, tables) => { $(id).textContent = tables.some(t=>errors[t]) ? 'Unavailable' : String(value); };
        metric('homeAgreementCount',result.agreements.length,['partnership_agreements']);
        metric('homeActionCount',result.actions.length,['action_points']);
        metric('homeFollowupCount',result.supports.length,['capacity_support_actions','capacity_followups']);
        $('homeAgreementWindowLabel').textContent = `Expiring within ${days} days`;
        panel('homeAgreements',result.agreements,['partnership_agreements'],row=>
            `<li><div><strong>${esc(row.agreement_title || row.agreement_reference || `Agreement ${row.agreement_id}`)}</strong><p>${esc(partnershipLabel(row.partnership_id))} · Expires ${esc(fmtDate(row.expiry_date))}</p></div>${recordButton(row.partnership_id,'agreements')}</li>`,
            `No agreements expiring in the next ${days} days.`);
        panel('homeActions',result.actions,['action_points'],row=>
            `<li><div><strong>${esc(row.action_description || 'Action point')}</strong><p>${esc(partnershipLabel(row.partnership_id))} · Due ${esc(fmtDate(row.target_date))} · ${esc(row.responsible_person || row.assigned_to || 'No owner recorded')}</p></div>${recordButton(row.partnership_id,'meetings')}</li>`,
            'No overdue actions.');
        panel('homeFollowups',result.supports,['capacity_support_actions','capacity_followups','capacity_gaps','capacity_assessments'],row=>{
            const gap = data.capacity_gaps?.find(g=>String(g.capacity_gap_id)===String(row.capacity_gap_id));
            const assessment = data.capacity_assessments?.find(a=>String(a.capacity_assessment_id)===String(gap?.capacity_assessment_id));
            return `<li><div><strong>${esc(row.planned_support || 'Completed capacity support')}</strong><p>${esc(partnershipLabel(assessment?.partnership_id))} · Completed ${esc(fmtDate(row.completion_date || row.end_date))}</p></div>${recordButton(assessment?.partnership_id,'capacity')}</li>`;
        },'No completed support awaiting a recorded follow-up.');
        $('homeView').querySelectorAll('[data-overview-expand]').forEach(button=>{
            button.onclick = ()=>{const id=button.dataset.overviewExpand; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render();};
        });
        $('homeView').querySelectorAll('[data-overview-partnership]').forEach(button=>{
            button.onclick = async ()=>{
                button.disabled = true;
                try {
                    const id=Number(button.dataset.overviewPartnership), tab=button.dataset.overviewTab;
                    await openPartnership(id);
                    if (Number(state.partnership?.partnership_id)!==id) return;
                    switchTabs(partnershipTabs,tab);
                    if(tab==='agreements') await loadAgreements();
                    else if(tab==='meetings') await loadPartnershipMeetings();
                    else if(tab==='capacity') await loadCapacity();
                } catch(error) { toast(error.message || 'Unable to open this partnership.'); }
                finally { button.disabled=false; }
            };
        });
        const failed=Object.keys(errors).length;
        $('homeLoadStatus').textContent = failed ? 'Some sections could not be loaded. Refresh to retry.' : `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Counts reflect records you can access.`;
    }

    async function load() {
        const request=++generation;
        $('homeRefresh').onclick=load;
        $('homeExpiryWindow').onchange=render;
        $('homeRefresh').disabled=true;
        $('homeLoadStatus').textContent='Loading overview…';
        ['homePartnerCount','homePartnershipCount','homeProjectCount','homeAgreementCount','homeActionCount','homeFollowupCount'].forEach(id=>$(id).textContent='…');
        ['homeAgreements','homeActions','homeFollowups'].forEach(id=>$(id).textContent='Loading…');
        const tables=Object.keys(specs);
        const results=await Promise.allSettled(tables.map(readRows));
        if(request!==generation) return;
        data={}; errors={}; expanded.clear();
        results.forEach((result,i)=>{
            if(result.status==='fulfilled') data[tables[i]]=result.value;
            else errors[tables[i]]=true;
        });
        render();
        $('homeRefresh').disabled=false;
    }
    return {load,calculate,readRows};
})();

async function loadHomeOverview() { await homeOverview.load(); }


// ============================================================

const workspaceIds = [

    "homeView",

    "partnerListView",
    "partnerProfileView",

    "partnershipListView",
    "partnershipDetailView",

    "projectListView",
    "projectProfileView",

    "meetingListView"
];


function showWorkspace(name) {

    workspaceIds.forEach(
        id =>
            hide(
                $(id)
            )
    );


    [
        "homeNav",
        "partnersNav",
        "partnershipsNav",
        "projectsNav",
        "meetingsNav"
    ]
        .forEach(
            id =>
                $(id)
                    ?.classList
                    .remove(
                        "nav-active"
                    )
        );


    if (name === "home") {

        show(
            $("homeView")
        );

        $("homeNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "partners") {

        show(
            $("partnerListView")
        );

        $("partnersNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "partnerProfile") {

        show(
            $("partnerProfileView")
        );

        $("partnersNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "partnerships") {

        show(
            $("partnershipListView")
        );

        $("partnershipsNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "partnershipDetail") {

        show(
            $("partnershipDetailView")
        );

        $("partnershipsNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "projects") {

        show(
            $("projectListView")
        );

        $("projectsNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "projectProfile") {

        show(
            $("projectProfileView")
        );

        $("projectsNav")
            ?.classList
            .add(
                "nav-active"
            );
    }


    if (name === "meetings") {

        show(
            $("meetingListView")
        );

        $("meetingsNav")
            ?.classList
            .add(
                "nav-active"
            );
    }
}


$("homeNav")?.addEventListener("click", async () => {
    showWorkspace("home");
    await loadHomeOverview();
});

$("partnersNav")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "partners"
            );

            await loadPartners();
        }
    );


$("partnershipsNav")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "partnerships"
            );

            await loadPartnerships();
        }
    );


$("projectsNav")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "projects"
            );

            await loadProjects();
        }
    );


$("meetingsNav")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "meetings"
            );

            await loadMeetingsWorkspace();
        }
    );


$("backToPartnersButton")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "partners"
            );

            await loadPartners();
        }
    );


$("backToPartnershipsButton")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "partnerships"
            );

            await loadPartnerships();
        }
    );


$("backToProjectsButton")
    ?.addEventListener(
        "click",
        async () => {

            showWorkspace(
                "projects"
            );

            await loadProjects();
        }
    );


// ============================================================
// TAB MANAGEMENT
// ============================================================

function switchTabs(
    config,
    active
) {

    Object
        .entries(config)
        .forEach(
            ([
                key,
                [
                    button,
                    content
                ]
            ]) => {

                $(button)
                    ?.classList
                    .toggle(
                        "active",
                        key === active
                    );


                $(content)
                    ?.classList
                    .toggle(
                        "hidden",
                        key !== active
                    );
            }
        );
}


const partnerTabs = {

    overview: [
        "overviewTabButton",
        "overviewTabContent"
    ],

    contacts: [
        "contactsTabButton",
        "contactsTabContent"
    ],

    partnerships: [
        "partnerPartnershipsTabButton",
        "partnerPartnershipsTabContent"
    ],

    documents: [
        "partnerDocumentsTabButton",
        "partnerDocumentsTabContent"
    ]
};


const partnershipTabs = {

    overview: [
        "partnershipOverviewTabButton",
        "partnershipOverviewTabContent"
    ],

    agreements: [
        "partnershipAgreementsTabButton",
        "partnershipAgreementsTabContent"
    ],

    projects: [
        "partnershipProjectsTabButton",
        "partnershipProjectsTabContent"
    ],

    capacity: [
        "partnershipCapacityTabButton",
        "partnershipCapacityTabContent"
    ],

    equity: [
        "partnershipEquityTabButton",
        "partnershipEquityTabContent"
    ],

    feedback: [
        "partnershipFeedbackTabButton",
        "partnershipFeedbackTabContent"
    ],

    meetings: [
        "partnershipMeetingsTabButton",
        "partnershipMeetingsTabContent"
    ],

    success: [
        "partnershipSuccessTabButton",
        "partnershipSuccessTabContent"
    ],

    exit: [
        "partnershipExitTabButton",
        "partnershipExitTabContent"
    ],

    documents: [
        "partnershipDocumentsTabButton",
        "partnershipDocumentsTabContent"
    ]
};


const projectTabs = {

    overview: [
        "projectOverviewTabButton",
        "projectOverviewTabContent"
    ],

    partners: [
        "projectPartnersTabButton",
        "projectPartnersTabContent"
    ],

    sectors: [
        "projectSectorsTabButton",
        "projectSectorsTabContent"
    ],

    locations: [
        "projectLocationsTabButton",
        "projectLocationsTabContent"
    ],

    budgets: [
        "projectBudgetsTabButton",
        "projectBudgetsTabContent"
    ],

    participants: [
        "projectParticipantsTabButton",
        "projectParticipantsTabContent"
    ],

    documents: [
        "projectDocumentsTabButton",
        "projectDocumentsTabContent"
    ]
};


// ============================================================
// PARTNER TAB EVENTS
// ============================================================

$("overviewTabButton")
    ?.addEventListener(
        "click",
        () =>
            switchTabs(
                partnerTabs,
                "overview"
            )
    );


$("contactsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnerTabs,
                "contacts"
            );

            await loadPartnerContacts(
                state.partner.partner_id
            );
        }
    );


$("partnerPartnershipsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnerTabs,
                "partnerships"
            );

            await loadPartnerPartnerships(
                state.partner.partner_id
            );
        }
    );


$("partnerDocumentsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnerTabs,
                "documents"
            );

            await loadDocuments(
                {
                    partner_id:
                        state.partner.partner_id
                },
                $("partnerDocumentsContainer")
            );
        }
    );


// ============================================================
// PARTNERSHIP TAB EVENTS
// ============================================================

$("partnershipOverviewTabButton")
    ?.addEventListener(
        "click",
        () =>
            switchTabs(
                partnershipTabs,
                "overview"
            )
    );


$("partnershipAgreementsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "agreements"
            );

            await loadAgreements();
        }
    );


$("partnershipProjectsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "projects"
            );

            await loadPartnershipProjects();
        }
    );


$("partnershipCapacityTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "capacity"
            );

            await loadCapacity();
        }
    );


$("partnershipEquityTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "equity"
            );

            await loadEquity();
        }
    );


$("partnershipFeedbackTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "feedback"
            );

            await loadFeedback();
        }
    );


$("partnershipMeetingsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "meetings"
            );

            await loadPartnershipMeetings();
        }
    );


$("partnershipSuccessTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "success"
            );

            await loadStories();
        }
    );


$("partnershipExitTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "exit"
            );

            await loadExit();
        }
    );


$("partnershipDocumentsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                partnershipTabs,
                "documents"
            );

            await loadDocuments(
                {
                    partnership_id:
                        state.partnership.partnership_id
                },
                $("partnershipDocumentsContainer"),
                true
            );
        }
    );


// ============================================================
// PROJECT TAB EVENTS
// ============================================================

$("projectOverviewTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "overview"
            );

            await renderProjectOverview();
        }
    );


$("projectPartnersTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "partners"
            );

            await loadProjectPartners();
        }
    );


$("projectSectorsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "sectors"
            );

            await loadProjectSectors();
        }
    );


$("projectLocationsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "locations"
            );

            await loadProjectLocations();
        }
    );


$("projectBudgetsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "budgets"
            );

            await loadProjectBudgets();
        }
    );


$("projectParticipantsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "participants"
            );

            await loadProjectParticipants();
        }
    );


$("projectDocumentsTabButton")
    ?.addEventListener(
        "click",
        async () => {

            switchTabs(
                projectTabs,
                "documents"
            );

            await loadDocuments(
                {
                    project_id:
                        state.project.project_id
                },
                $("projectDocumentsContainer")
            );
        }
    );


// ============================================================
// PARTNERS
// ============================================================

async function loadPartners(
    search = ""
) {

    const body =
        $("partnerTableBody");


    emptyRow(
        body,
        6,
        "Loading..."
    );


    let query =
        supabaseClient
            .from("partners")
            .select("*")
            .order(
                "partner_name"
            );


    if (
        search.trim()
    ) {

        query =
            query.ilike(
                "partner_name",
                `%${search.trim()}%`
            );
    }


    const {
        data,
        error
    } =
        await query;


    if (error) {

        emptyRow(
            body,
            6,
            error.message
        );

        return;
    }


    state.partnerRows =
        data || [];


    if (
        !state.partnerRows.length
    ) {

        emptyRow(
            body,
            6,
            "No partners found."
        );

        return;
    }


    body.innerHTML =
        state.partnerRows
            .map(
                partner => {

                    const typeName =
                        lookupName(
                            "partner_types",
                            "partner_type_id",
                            "partner_type_name",
                            partner.partner_type_id
                        );


                    const typeDisplay =
                        (
                            typeName
                                .toLowerCase()
                            ===
                            "other"
                            &&
                            partner.partner_type_other
                        )
                            ?
                            partner.partner_type_other
                            :
                            typeName;


                    const legalStatus =
                        categoryLabel(lookupName(
                            "legal_statuses",
                            "legal_status_id",
                            "legal_status_name",
                            partner.legal_status_id
                        ), partner.legal_status_other);


                    return `
                        <tr
                            class="clickable-row"
                            data-id="${partner.partner_id}"
                        >

                            <td>
                                <span class="table-link">
                                    ${esc(partner.partner_name)}
                                </span>
                            </td>

                            <td>
                                ${esc(partner.acronym || "")}
                            </td>

                            <td>
                                ${esc(typeDisplay)}
                            </td>

                            <td>
                                ${esc(legalStatus)}
                            </td>

                            <td>
                                ${esc(partner.geographic_reach || "")}
                            </td>

                            <td>
                                ${
                                    statusBadge(
                                        partner.partner_status
                                        ||
                                        (
                                            partner.is_active
                                                ? "Active"
                                                : "Inactive"
                                        )
                                    )
                                }
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    body
        .querySelectorAll(
            "tr[data-id]"
        )
        .forEach(
            row => {

                row.onclick =
                    () =>
                        openPartner(
                            Number(
                                row.dataset.id
                            )
                        );
            }
        );
}


$("partnerSearch")
    ?.addEventListener(
        "input",
        event =>
            loadPartners(
                event.target.value
            )
    );


async function openPartner(id) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("partners")
            .select("*")
            .eq(
                "partner_id",
                id
            )
            .single();


    if (error) {

        toast(
            error.message
        );

        return;
    }


    state.partner =
        data;


    showWorkspace(
        "partnerProfile"
    );


    switchTabs(
        partnerTabs,
        "overview"
    );


    renderPartnerProfile();

    await loadPartnerLocalization();
}


function renderPartnerProfile() {

    const partner =
        state.partner;


    const type =
        lookupName(
            "partner_types",
            "partner_type_id",
            "partner_type_name",
            partner.partner_type_id
        );


    const typeDisplay =
        (
            type.toLowerCase()
            ===
            "other"
            &&
            partner.partner_type_other
        )
            ?
            partner.partner_type_other
            :
            type;


    setText(
        "profilePartnerName",
        partner.partner_name
    );


    setText(
        "profilePartnerSubtitle",
        partner.acronym
        ||
        typeDisplay
    );


    $("profilePartnerStatus")
        .innerHTML =
        statusBadge(
            partner.partner_status
            ||
            (
                partner.is_active
                    ? "Active"
                    : "Inactive"
            )
        );


    setText(
        "profilePartnerType",
        typeDisplay
    );


    setText(
        "profileLegalStatus",
        categoryLabel(lookupName(
            "legal_statuses",
            "legal_status_id",
            "legal_status_name",
            partner.legal_status_id
        ), partner.legal_status_other)
    );


    setText(
        "profileDateEstablished",
        fmtDate(
            partner.date_established
        )
    );


    setText(
        "profileHeadquarters",
        partner.headquarters_location
        ||
        partner.city
    );


    setText(
        "profileCountry",
        partner.country
    );


    setText(
        "profileGeographicReach",
        partner.geographic_reach
    );


    setText(
        "profileFirstEngagement",
        fmtDate(
            partner.date_first_engaged_with_whh
        )
    );


    const website =
        $("profileWebsite");


    if (website) {

        website.innerHTML =
            partner.website
                ?
                `
                <a
                    href="${esc(partner.website)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    ${esc(partner.website)}
                </a>
                `
                :
                "—";
    }


    setText(
        "profileAddress",
        partner.address
    );


    setText(
        "profileDescription",
        partner.description
    );


    applyPermissions();
}


async function loadPartnerLocalization() {

    const container =
        $("partnerLocalizationContainer");


    if (!container) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partner_localization_characteristics"
            )
            .select("*")
            .eq(
                "partner_id",
                state.partner.partner_id
            );


    if (error) {

        container.textContent =
            error.message;

        return;
    }


    if (
        !data ||
        !data.length
    ) {

        container.innerHTML =
            `
            <span class="empty-text">
                No localization characteristics recorded.
            </span>
            `;

        return;
    }


    container.innerHTML =
        data
            .map(
                record =>
                    `
                    <span class="tag-item">
                        ${
                            esc(
                                categoryLabel(lookupName(
                                    "localization_characteristics",
                                    "localization_characteristic_id",
                                    "characteristic_name",
                                    record.localization_characteristic_id
                                ), record.other_description)
                            )
                        }
                    </span>
                    `
            )
            .join("");
}


// Category labels preserve custom descriptions without changing lookup IDs.
function categoryLabel(name, custom) {
    return String(name || "").trim().toLowerCase() === "other" && custom
        ? custom : (name || "");
}
function categoryOtherValue(selectId, inputId) {
    const select = $(selectId);
    const name = select?.options[select.selectedIndex]?.textContent?.trim().toLowerCase();
    if (name !== "other") return null;
    const value = $(inputId)?.value?.trim();
    if (!value) throw new Error("Please specify the Other category.");
    if (value.length > 200) throw new Error("The category description must be 200 characters or fewer.");
    return value;
}

function partnerForm(
    record = null
) {
    const partnerTypes = state.lookups.partner_types || [];
    const legalStatuses = state.lookups.legal_statuses || [];
    const localization = (state.lookups.localization_characteristics || [])
        .filter(item => item.is_active !== false)
        .sort((a, b) => {
            const ga = String(a.characteristic_group || "");
            const gb = String(b.characteristic_group || "");
            return ga.localeCompare(gb) || String(a.characteristic_name || "").localeCompare(String(b.characteristic_name || ""));
        });

    openModal({
        title: record ? "Edit Partner" : "Add Partner",
        large: true,

        body: `
        <div class="form-grid">
            <div class="form-group full-field">
                <label>Partner Name *</label>
                <input id="pfName" required value="${esc(record?.partner_name || "")}">
            </div>

            <div class="form-group">
                <label>Acronym</label>
                <input id="pfAcronym" value="${esc(record?.acronym || "")}">
            </div>

            <div class="form-group">
                <label>Registration Number</label>
                <input id="pfRegistration" value="${esc(record?.registration_number || "")}">
            </div>

            <div class="form-group">
                <label>Partner Type *</label>
                <select id="pfType" required>
                    ${optionHtml(
                        partnerTypes,
                        "partner_type_id",
                        "partner_type_name",
                        record?.partner_type_id,
                        "Select partner type"
                    )}
                </select>
            </div>

            <div id="pfTypeOtherGroup" class="form-group hidden">
                <label>Please specify Partner Type *</label>
                <input id="pfTypeOther" value="${esc(record?.partner_type_other || "")}">
            </div>

            <div class="form-group full-field">
                <label>Organization Identity / Localization Characteristics</label>
                <div class="checkbox-grid" id="pfLocalizationGrid">
                    ${localization.length ? localization.map(item => `
                        <label class="checkbox-option">
                            <input
                                type="checkbox"
                                class="pfLoc"
                                value="${item.localization_characteristic_id}"
                                data-name="${esc(item.characteristic_name)}"
                            >
                            <span>${esc(item.characteristic_name)}</span>
                        </label>
                    `).join("") : `
                        <span class="empty-text">No localization characteristics configured.</span>
                    `}
                </div>
            </div>

            <div id="pfLocalizationOtherGroup" class="form-group full-field hidden">
                <label>Please specify Other organization identity *</label>
                <input id="pfLocalizationOther" placeholder="Enter the characteristic">
            </div>

            <div class="form-group full-field">
                <label>Localization / Identity Notes</label>
                <textarea id="pfLocalizationNotes" rows="2">${esc(record?.localization_notes || "")}</textarea>
            </div>

            <div class="form-group">
                <label>Legal Status</label>
                <select id="pfLegal">
                    ${optionHtml(
                        legalStatuses,
                        "legal_status_id",
                        "legal_status_name",
                        record?.legal_status_id,
                        "Select legal status"
                    )}
                </select>
            </div>

            <div class="form-group">
                <label>Date Established</label>
                <input id="pfEstablished" type="date" value="${esc(record?.date_established || "")}">
            </div>

            <div class="form-group">
                <label>Headquarters</label>
                <input id="pfHQ" value="${esc(record?.headquarters_location || record?.city || "")}">
            </div>

            <div class="form-group">
                <label>Country</label>
                <input id="pfCountry" value="${esc(record?.country || "Ethiopia")}">
            </div>

            <div class="form-group">
                <label>Geographic Reach</label>
                <select id="pfReach">
                    <option value="">Select geographic reach</option>
                    ${["Community","Woreda","Zone","Regional","National","Other"].map(value => `
                        <option value="${value}" ${record?.geographic_reach === value ? "selected" : ""}>${value}</option>
                    `).join("")}
                </select>
            </div>

            <div id="pfReachOtherGroup" class="form-group hidden">
                <label>Please specify Geographic Reach *</label>
                <input id="pfReachOther" value="${esc(
                    record?.geographic_reach && !["Community","Woreda","Zone","Regional","National"].includes(record.geographic_reach)
                        ? record.geographic_reach
                        : ""
                )}">
            </div>

            <div class="form-group">
                <label>First Engagement with WHH</label>
                <input id="pfFirst" type="date" value="${esc(record?.date_first_engaged_with_whh || "")}">
            </div>

            <div class="form-group">
                <label>Partner Status</label>
                <select id="pfStatus">
                    ${["Active","Inactive","Prospective","Archived"].map(value => `
                        <option value="${value}" ${(
                            record?.partner_status || (record?.is_active === false ? "Inactive" : "Active")
                        ) === value ? "selected" : ""}>${value}</option>
                    `).join("")}
                </select>
            </div>

            <div class="form-group full-field">
                <label>Website</label>
                <input id="pfWebsite" value="${esc(record?.website || "")}">
            </div>

            <div class="form-group full-field">
                <label>Address</label>
                <input id="pfAddress" value="${esc(record?.address || "")}">
            </div>

            <div class="form-group full-field">
                <label>Organization Description</label>
                <textarea id="pfDescription" rows="4">${esc(record?.description || "")}</textarea>
            </div>
        </div>
        `,

        onOpen: async () => {
            otherVisible("pfType", "pfTypeOtherGroup", "pfTypeOther");

            const reachSelect = $("pfReach");
            const knownReach = ["Community","Woreda","Zone","Regional","National"];
            if (record?.geographic_reach && !knownReach.includes(record.geographic_reach)) {
                reachSelect.value = "Other";
            }
            otherVisible("pfReach", "pfReachOtherGroup", "pfReachOther");

            const syncLocalizationOther = () => {
                const otherCheckbox = [...document.querySelectorAll(".pfLoc")]
                    .find(box => String(box.dataset.name || "").trim().toLowerCase() === "other");
                const group = $("pfLocalizationOtherGroup");
                const input = $("pfLocalizationOther");
                const visible = Boolean(otherCheckbox?.checked);
                group?.classList.toggle("hidden", !visible);
                if (input) input.required = visible;
                if (!visible && input) input.value = "";
            };

            document.querySelectorAll(".pfLoc").forEach(box => {
                box.addEventListener("change", syncLocalizationOther);
            });

            if (record?.partner_id) {
                const { data, error } = await supabaseClient
                    .from("partner_localization_characteristics")
                    .select("localization_characteristic_id,other_description")
                    .eq("partner_id", record.partner_id);

                if (error) throw error;

                const byId = new Map((data || []).map(row => [
                    String(row.localization_characteristic_id),
                    row
                ]));

                document.querySelectorAll(".pfLoc").forEach(checkbox => {
                    const existing = byId.get(String(checkbox.value));
                    checkbox.checked = Boolean(existing);
                    if (
                        existing &&
                        String(checkbox.dataset.name || "").trim().toLowerCase() === "other" &&
                        $("pfLocalizationOther")
                    ) {
                        $("pfLocalizationOther").value = existing.other_description || "";
                    }
                });
            }

            syncLocalizationOther();
        },

        onSave: async () => {
            const partnerTypeText = selectedOptionText("pfType").toLowerCase();
            const reach = $("pfReach").value;

            if (partnerTypeText === "other" && !$("pfTypeOther").value.trim()) {
                throw new Error("Please specify the Partner Type.");
            }

            if (reach === "Other" && !$("pfReachOther").value.trim()) {
                throw new Error("Please specify the Geographic Reach.");
            }

            const otherLocalizationCheckbox = [...document.querySelectorAll(".pfLoc")]
                .find(box => String(box.dataset.name || "").trim().toLowerCase() === "other");

            if (otherLocalizationCheckbox?.checked && !$("pfLocalizationOther").value.trim()) {
                throw new Error("Please specify the Other organization identity.");
            }

            const payload = {
                partner_name: $("pfName").value.trim(),
                acronym: emptyToNull($("pfAcronym").value),
                registration_number: emptyToNull($("pfRegistration").value),
                partner_type_id: numOrNull($("pfType").value),
                partner_type_other: partnerTypeText === "other"
                    ? emptyToNull($("pfTypeOther").value)
                    : null,
                legal_status_id: numOrNull($("pfLegal").value),
                legal_status_other: categoryOtherValue("pfLegal", "pfLegalOther"),
                date_established: emptyToNull($("pfEstablished").value),
                headquarters_location: emptyToNull($("pfHQ").value),
                city: emptyToNull($("pfHQ").value),
                country: emptyToNull($("pfCountry").value) || "Ethiopia",
                geographic_reach: reach === "Other"
                    ? $("pfReachOther").value.trim()
                    : emptyToNull(reach),
                date_first_engaged_with_whh: emptyToNull($("pfFirst").value),
                partner_status: emptyToNull($("pfStatus").value),
                website: emptyToNull($("pfWebsite").value),
                address: emptyToNull($("pfAddress").value),
                description: emptyToNull($("pfDescription").value),
                localization_notes: emptyToNull($("pfLocalizationNotes").value),
                is_active: !["Inactive", "Archived"].includes($("pfStatus").value)
            };

            const saved = await upsertRecord(
                "partners",
                payload,
                "partner_id",
                record?.partner_id
            );

            const selected = [...document.querySelectorAll(".pfLoc:checked")].map(checkbox => ({
                partner_id: saved.partner_id,
                localization_characteristic_id: Number(checkbox.value),
                other_description:
                    String(checkbox.dataset.name || "").trim().toLowerCase() === "other"
                        ? emptyToNull($("pfLocalizationOther").value)
                        : null
            }));

            const { data: existingRows, error: existingError } = await supabaseClient
                .from("partner_localization_characteristics")
                .select("partner_localization_id,localization_characteristic_id")
                .eq("partner_id", saved.partner_id);

            if (existingError) throw existingError;

            if (selected.length) {
                const { error: upsertError } = await supabaseClient
                    .from("partner_localization_characteristics")
                    .upsert(selected, {
                        onConflict: "partner_id,localization_characteristic_id"
                    });

                if (upsertError) throw upsertError;
            }

            const selectedIds = new Set(selected.map(row => String(row.localization_characteristic_id)));
            const staleIds = (existingRows || [])
                .filter(row => !selectedIds.has(String(row.localization_characteristic_id)))
                .map(row => row.partner_localization_id);

            if (staleIds.length) {
                const { error: deleteError } = await supabaseClient
                    .from("partner_localization_characteristics")
                    .delete()
                    .in("partner_localization_id", staleIds);

                if (deleteError) {
                    throw new Error(
                        `Partner saved, but deselected localization characteristics could not be removed: ${deleteError.message}`
                    );
                }
            }

            toast("Partner saved.");
            await openPartner(saved.partner_id);
        }
    });
}


$("addPartnerButton")
    ?.addEventListener(
        "click",
        () =>
            partnerForm()
    );


$("editPartnerButton")
    ?.addEventListener(
        "click",
        () =>
            partnerForm(
                state.partner
            )
    );


// ============================================================
// PARTNER CONTACTS
// ============================================================

async function loadPartnerContacts(
    partnerId
) {

    const body =
        $("partnerContactsTableBody");


    emptyRow(
        body,
        6,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partner_contacts"
            )
            .select("*")
            .eq(
                "partner_id",
                partnerId
            )
            .order(
                "is_primary",
                {
                    ascending:
                        false
                }
            )
            .order(
                "first_name"
            );


    if (error) {

        emptyRow(
            body,
            6,
            error.message
        );

        return;
    }


    if (
        !data ||
        !data.length
    ) {

        emptyRow(
            body,
            6,
            "No contacts recorded."
        );

        return;
    }


    body.innerHTML =
        data
            .map(
                contact =>
                    `
                    <tr>

                        <td>
                            ${
                                esc(
                                    [
                                        contact.first_name,
                                        contact.last_name
                                    ]
                                        .filter(Boolean)
                                        .join(" ")
                                )
                            }
                        </td>

                        <td>
                            ${esc(contact.position_title || "")}
                        </td>

                        <td>
                            ${esc(contact.email || "")}
                        </td>

                        <td>
                            ${esc(contact.phone || "")}
                        </td>

                        <td>
                            ${
                                contact.is_primary
                                    ? "Yes"
                                    : ""
                            }
                        </td>

                        <td>
                            ${
                                statusBadge(
                                    contact.is_active
                                        ? "Active"
                                        : "Inactive"
                                )
                            }
                        </td>

                    </tr>
                    `
            )
            .join("");
}


function contactForm() {

    openModal({

        title:
            "Add Contact",


        body:
        `
        <div class="form-grid">

            <div class="form-group">

                <label>
                    First Name *
                </label>

                <input
                    id="cfFirst"
                    required
                >

            </div>


            <div class="form-group">

                <label>
                    Last Name
                </label>

                <input id="cfLast">

            </div>


            <div class="form-group">

                <label>
                    Position
                </label>

                <input id="cfPosition">

            </div>


            <div class="form-group">

                <label>
                    Email
                </label>

                <input
                    id="cfEmail"
                    type="email"
                >

            </div>


            <div class="form-group">

                <label>
                    Phone
                </label>

                <input id="cfPhone">

            </div>


            <div class="form-group checkbox-group">

                <label>

                    <input
                        id="cfPrimary"
                        type="checkbox"
                    >

                    Primary contact

                </label>

            </div>

        </div>
        `,


        onSave:
            async () => {

                if (
                    $("cfPrimary").checked
                ) {

                    await supabaseClient
                        .from(
                            "partner_contacts"
                        )
                        .update({
                            is_primary:
                                false
                        })
                        .eq(
                            "partner_id",
                            state.partner.partner_id
                        );
                }


                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            "partner_contacts"
                        )
                        .insert({

                            partner_id:
                                state.partner.partner_id,

                            first_name:
                                $("cfFirst")
                                    .value
                                    .trim(),

                            last_name:
                                emptyToNull(
                                    $("cfLast").value
                                ),

                            position_title:
                                emptyToNull(
                                    $("cfPosition").value
                                ),

                            email:
                                emptyToNull(
                                    $("cfEmail").value
                                ),

                            phone:
                                emptyToNull(
                                    $("cfPhone").value
                                ),

                            is_primary:
                                $("cfPrimary").checked,

                            is_active:
                                true
                        });


                if (error) {
                    throw error;
                }


                await loadPartnerContacts(
                    state.partner.partner_id
                );
            }
    });
}


$("addContactButton")
    ?.addEventListener(
        "click",
        contactForm
    );


// ============================================================
// PARTNER PARTNERSHIP HISTORY
// ============================================================

async function loadPartnerPartnerships(
    partnerId
) {

    const body =
        $("partnerPartnershipsTableBody");


    emptyRow(
        body,
        5,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partnerships"
            )
            .select("*")
            .eq(
                "partner_id",
                partnerId
            )
            .order(
                "contract_start_date",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        emptyRow(
            body,
            5,
            error.message
        );

        return;
    }


    if (
        !data ||
        !data.length
    ) {

        emptyRow(
            body,
            5,
            "No partnerships recorded."
        );

        return;
    }


    body.innerHTML =
        data
            .map(
                partnership =>
                    `
                    <tr
                        class="clickable-row"
                        data-id="${partnership.partnership_id}"
                    >

                        <td>
                            <span class="table-link">
                                ${esc(partnership.partnership_title)}
                            </span>
                        </td>

                        <td>
                            ${
                                esc(
                                    displayPartnershipType(
                                        partnership
                                    )
                                )
                            }
                        </td>

                        <td>
                            ${fmtDate(partnership.contract_start_date)}
                        </td>

                        <td>
                            ${fmtDate(partnership.contract_end_date)}
                        </td>

                        <td>
                            ${
                                statusBadge(
                                    lookupName(
                                        "partnership_statuses",
                                        "partnership_status_id",
                                        "partnership_status_name",
                                        partnership.partnership_status_id
                                    )
                                )
                            }
                        </td>

                    </tr>
                    `
            )
            .join("");


    body
        .querySelectorAll(
            "tr[data-id]"
        )
        .forEach(
            row => {

                row.onclick =
                    () =>
                        openPartnership(
                            Number(
                                row.dataset.id
                            )
                        );
            }
        );
}


$("addPartnershipForPartnerButton")
    ?.addEventListener(
        "click",
        () =>
            partnershipForm(
                null,
                state.partner
                    ?.partner_id
            )
    );


// ============================================================
// PARTNERSHIPS
// ============================================================

function displayPartnershipType(
    partnership
) {
    return lookupName(
        "partnership_types",
        "partnership_type_id",
        "partnership_type_name",
        partnership.partnership_type_id
    );
}


async function loadPartnerships(
    search = ""
) {

    const body =
        $("partnershipTableBody");


    emptyRow(
        body,
        6,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partnerships"
            )
            .select("*")
            .order(
                "contract_start_date",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        emptyRow(
            body,
            6,
            error.message
        );

        return;
    }


    const partners =
        await safeSelect(
            "partners",
            "partner_id,partner_name,acronym"
        );


    const partnerMap =
        Object.fromEntries(
            partners.map(
                partner => [
                    partner.partner_id,
                    partner
                ]
            )
        );


    let rows =
        data || [];


    if (
        search.trim()
    ) {

        const searchText =
            search
                .trim()
                .toLowerCase();


        rows =
            rows.filter(
                partnership =>
                    [
                        partnership.partnership_title,
                        partnership.partnership_code,
                        partnerMap[
                            partnership.partner_id
                        ]?.partner_name,
                        partnerMap[
                            partnership.partner_id
                        ]?.acronym
                    ]
                        .some(
                            value =>
                                String(
                                    value || ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        searchText
                                    )
                        )
            );
    }


    state.partnershipRows =
        rows;


    if (
        !rows.length
    ) {

        emptyRow(
            body,
            6,
            "No partnerships found."
        );

        return;
    }


    body.innerHTML =
        rows
            .map(
                partnership =>
                    `
                    <tr
                        class="clickable-row"
                        data-id="${partnership.partnership_id}"
                    >

                        <td>
                            ${
                                esc(
                                    partnerMap[
                                        partnership.partner_id
                                    ]?.partner_name
                                    ||
                                    ""
                                )
                            }
                        </td>

                        <td>

                            <span class="table-link">
                                ${
                                    esc(
                                        partnership.partnership_title
                                        ||
                                        partnership.partnership_code
                                        ||
                                        "Partnership"
                                    )
                                }
                            </span>

                            <span class="table-secondary">
                                ${esc(partnership.partnership_code || "")}
                            </span>

                        </td>

                        <td>
                            ${
                                esc(
                                    displayPartnershipType(
                                        partnership
                                    )
                                )
                            }
                        </td>

                        <td>
                            ${fmtDate(partnership.contract_start_date)}
                        </td>

                        <td>
                            ${fmtDate(partnership.contract_end_date)}
                        </td>

                        <td>
                            ${
                                statusBadge(
                                    lookupName(
                                        "partnership_statuses",
                                        "partnership_status_id",
                                        "partnership_status_name",
                                        partnership.partnership_status_id
                                    )
                                )
                            }
                        </td>

                    </tr>
                    `
            )
            .join("");


    body
        .querySelectorAll(
            "tr[data-id]"
        )
        .forEach(
            row => {

                row.onclick =
                    () =>
                        openPartnership(
                            Number(
                                row.dataset.id
                            )
                        );
            }
        );
}


$("partnershipSearch")
    ?.addEventListener(
        "input",
        event =>
            loadPartnerships(
                event.target.value
            )
    );


$("addPartnershipButton")
    ?.addEventListener(
        "click",
        () =>
            partnershipForm()
    );


async function openPartnership(id) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partnerships"
            )
            .select("*")
            .eq(
                "partnership_id",
                id
            )
            .single();


    if (error) {

        toast(
            error.message
        );

        return;
    }


    state.partnership =
        data;


    showWorkspace(
        "partnershipDetail"
    );


    switchTabs(
        partnershipTabs,
        "overview"
    );


    await renderPartnership();
}


async function renderPartnership() {

    const partnership =
        state.partnership;


    const partner =
        (
            await safeSelect(
                "partners",
                "partner_id,partner_name,acronym"
            )
        )
            .find(
                row =>
                    String(
                        row.partner_id
                    )
                    ===
                    String(
                        partnership.partner_id
                    )
            );


    setText(
        "partnershipPartnerName",
        partner?.partner_name
        ||
        ""
    );


    setText(
        "partnershipTitle",
        partnership.partnership_title
        ||
        partnership.partnership_code
    );


    $("partnershipStatus")
        .innerHTML =
        statusBadge(
            lookupName(
                "partnership_statuses",
                "partnership_status_id",
                "partnership_status_name",
                partnership.partnership_status_id
            )
        );


    setText(
        "detailPartnershipCode",
        partnership.partnership_code
    );


    setText(
        "detailPartnershipType",
        displayPartnershipType(
            partnership
        )
    );


    setText(
        "detailPartnershipStatus",
        lookupName(
            "partnership_statuses",
            "partnership_status_id",
            "partnership_status_name",
            partnership.partnership_status_id
        )
    );


    setText(
        "detailContractStart",
        fmtDate(
            partnership.contract_start_date
        )
    );


    setText(
        "detailContractEnd",
        fmtDate(
            partnership.contract_end_date
        )
    );


    setText(
        "detailActualEnd",
        fmtDate(
            partnership.actual_end_date
        )
    );


    setText(
        "detailWHHFocal",
        partnership.whh_focal_person
    );


    setText(
        "detailPartnerFocal",
        partnership.partner_focal_person
    );


    setText(
        "detailCoDesigned",
        boolText(
            partnership.is_co_designed
        )
    );


    setText(
        "detailPartnershipArea",
        partnership.area_of_partnership
    );


    setText(
        "detailStrategicObjective",
        partnership.strategic_objective
    );


    setText(
        "detailGeographicScope",
        partnership.geographic_scope_notes
    );


    setText(
        "detailWHHRole",
        partnership.whh_role
    );


    setText(
        "detailPartnerRole",
        partnership.partner_role
    );


    setText(
        "detailPartnershipNotes",
        partnership.notes
    );


    show(
        $("partnershipOverviewReadMode")
    );


    hide(
        $("partnershipOverviewEditMode")
    );


    hide(
        $("savePartnershipButton")
    );


    hide(
        $("cancelPartnershipEditButton")
    );


    $("editPartnershipButton")
        ?.classList
        .toggle(
            "hidden",
            !isAdmin()
        );
}


// ============================================================
// PARTNERSHIP EDIT MODE
// ============================================================

async function enterPartnershipEdit() {

    const partnership =
        state.partnership;


    const partners =
        await safeSelect(
            "partners",
            "partner_id,partner_name,acronym"
        );


    $("editPartnershipPartner")
        .innerHTML =
        optionHtml(
            partners,
            "partner_id",
            "partner_name",
            partnership.partner_id,
            "Select partner"
        );


    $("editPartnershipType")
        .innerHTML =
        optionHtml(
            state.lookups.partnership_types
            || [],
            "partnership_type_id",
            "partnership_type_name",
            partnership.partnership_type_id,
            "Select type"
        );


    $("editPartnershipStatus")
        .innerHTML =
        optionHtml(
            state.lookups.partnership_statuses
            || [],
            "partnership_status_id",
            "partnership_status_name",
            partnership.partnership_status_id,
            "Select status"
        );


    setValue(
        "editPartnershipTitle",
        partnership.partnership_title
    );


    setValue(
        "editPartnershipCode",
        partnership.partnership_code
    );


    setValue(
        "editContractStartDate",
        partnership.contract_start_date
    );


    setValue(
        "editContractEndDate",
        partnership.contract_end_date
    );


    setValue(
        "editActualEndDate",
        partnership.actual_end_date
    );


    setValue(
        "editPartnershipArea",
        partnership.area_of_partnership
    );


    setValue(
        "editStrategicObjective",
        partnership.strategic_objective
    );


    setValue(
        "editGeographicScope",
        partnership.geographic_scope_notes
    );


    setValue(
        "editWHHFocalPerson",
        partnership.whh_focal_person
    );


    setValue(
        "editPartnerFocalPerson",
        partnership.partner_focal_person
    );


    setValue(
        "editWHHRole",
        partnership.whh_role
    );


    setValue(
        "editPartnerRole",
        partnership.partner_role
    );


    setValue(
        "editPartnershipNotes",
        partnership.notes
    );


    $("editCoDesigned")
        .checked =
        Boolean(
            partnership.is_co_designed
        );


    otherVisible(
        "editPartnershipType",
        "editPartnershipTypeOtherGroup",
        "editPartnershipTypeOther"
    );


    hide(
        $("partnershipOverviewReadMode")
    );


    show(
        $("partnershipOverviewEditMode")
    );


    hide(
        $("editPartnershipButton")
    );


    show(
        $("savePartnershipButton")
    );


    show(
        $("cancelPartnershipEditButton")
    );
}


$("editPartnershipButton")
    ?.addEventListener(
        "click",
        enterPartnershipEdit
    );


$("cancelPartnershipEditButton")
    ?.addEventListener(
        "click",
        renderPartnership
    );


$("savePartnershipButton")
    ?.addEventListener(
        "click",
        async () => {

            try {

                $("partnershipEditMessage")
                    .textContent =
                    "";


                const partnershipTypeId = await ensurePartnershipTypeFromForm(
                    "editPartnershipType",
                    "editPartnershipTypeOther"
                );


                const payload = {

                    partner_id:
                        Number(
                            $("editPartnershipPartner").value
                        ),

                    partnership_title:
                        $("editPartnershipTitle")
                            .value
                            .trim(),

                    partnership_code:
                        emptyToNull(
                            $("editPartnershipCode").value
                        ),

                    partnership_type_id:
                        partnershipTypeId,

                    partnership_status_id:
                        numOrNull(
                            $("editPartnershipStatus").value
                        ),

                    contract_start_date:
                        emptyToNull(
                            $("editContractStartDate").value
                        ),

                    contract_end_date:
                        emptyToNull(
                            $("editContractEndDate").value
                        ),

                    actual_end_date:
                        emptyToNull(
                            $("editActualEndDate").value
                        ),

                    area_of_partnership:
                        emptyToNull(
                            $("editPartnershipArea").value
                        ),

                    strategic_objective:
                        emptyToNull(
                            $("editStrategicObjective").value
                        ),

                    geographic_scope_notes:
                        emptyToNull(
                            $("editGeographicScope").value
                        ),

                    whh_focal_person:
                        emptyToNull(
                            $("editWHHFocalPerson").value
                        ),

                    partner_focal_person:
                        emptyToNull(
                            $("editPartnerFocalPerson").value
                        ),

                    whh_role:
                        emptyToNull(
                            $("editWHHRole").value
                        ),

                    partner_role:
                        emptyToNull(
                            $("editPartnerRole").value
                        ),

                    is_co_designed:
                        $("editCoDesigned").checked,

                    notes:
                        emptyToNull(
                            $("editPartnershipNotes").value
                        )
                };


                const saved =
                    await upsertRecord(
                        "partnerships",
                        payload,
                        "partnership_id",
                        state.partnership.partnership_id
                    );


                state.partnership =
                    saved;


                toast(
                    "Partnership saved."
                );


                await renderPartnership();

            } catch (error) {

                $("partnershipEditMessage")
                    .textContent =
                    error.message;
            }
        }
    );


// ============================================================
// ADD PARTNERSHIP FORM
// ============================================================

function partnershipForm(
    record = null,
    presetPartnerId = null
) {

    openModal({

        title:
            record
                ? "Edit Partnership"
                : "Add Partnership",

        large:
            true,


        body:
        `
        <div class="form-grid">

            <div class="form-group full-field">

                <label>
                    Partner *
                </label>

                <select
                    id="psPartner"
                    required
                ></select>

            </div>


            <div class="form-group full-field">

                <label>
                    Partnership Title *
                </label>

                <input
                    id="psTitle"
                    required
                    value="${esc(record?.partnership_title || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Partnership Code
                </label>

                <input
                    id="psCode"
                    value="${esc(record?.partnership_code || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Partnership Type *
                </label>

                <select
                    id="psType"
                    required
                ></select>

            </div>


            <div
                id="psTypeOtherGroup"
                class="form-group hidden"
            >

                <label>
                    Please specify *
                </label>

                <input
                    id="psTypeOther"
                    value=""
                >

            </div>


            <div class="form-group">

                <label>
                    Status *
                </label>

                <select
                    id="psStatus"
                    required
                ></select>

            </div>


            <div class="form-group">

                <label>
                    Contract Start Date *
                </label>

                <input
                    id="psStart"
                    type="date"
                    required
                    value="${esc(record?.contract_start_date || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Contract End Date
                </label>

                <input
                    id="psEnd"
                    type="date"
                    value="${esc(record?.contract_end_date || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Actual End Date
                </label>

                <input
                    id="psActual"
                    type="date"
                    value="${esc(record?.actual_end_date || "")}"
                >

            </div>


            <div class="form-group full-field">

                <label>
                    Area of Partnership
                </label>

                <textarea id="psArea">${esc(record?.area_of_partnership || "")}</textarea>

            </div>


            <div class="form-group full-field">

                <label>
                    Strategic Objective / Purpose
                </label>

                <textarea id="psObjective">${esc(record?.strategic_objective || "")}</textarea>

            </div>


            <div class="form-group full-field">

                <label>
                    Geographic Scope
                </label>

                <textarea id="psGeo">${esc(record?.geographic_scope_notes || "")}</textarea>

            </div>


            <div class="form-group">

                <label>
                    WHH Focal Person
                </label>

                <input
                    id="psWhhFocal"
                    value="${esc(record?.whh_focal_person || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Partner Focal Person
                </label>

                <input
                    id="psPartnerFocal"
                    value="${esc(record?.partner_focal_person || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    WHH Role
                </label>

                <input
                    id="psWhhRole"
                    value="${esc(record?.whh_role || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Partner Role
                </label>

                <input
                    id="psPartnerRole"
                    value="${esc(record?.partner_role || "")}"
                >

            </div>


            <div class="form-group checkbox-group">

                <label>

                    <input
                        id="psCoDesign"
                        type="checkbox"
                        ${
                            record?.is_co_designed
                                ? "checked"
                                : ""
                        }
                    >

                    Co-designed

                </label>

            </div>


            <div class="form-group full-field">

                <label>
                    Notes
                </label>

                <textarea id="psNotes">${esc(record?.notes || "")}</textarea>

            </div>

        </div>
        `,


        onOpen:
            async () => {

                const partners =
                    await safeSelect(
                        "partners",
                        "partner_id,partner_name,acronym"
                    );


                $("psPartner")
                    .innerHTML =
                    optionHtml(
                        partners,
                        "partner_id",
                        "partner_name",
                        record?.partner_id
                        ||
                        presetPartnerId,
                        "Select partner"
                    );


                $("psType")
                    .innerHTML =
                    optionHtml(
                        state.lookups.partnership_types
                        || [],
                        "partnership_type_id",
                        "partnership_type_name",
                        record?.partnership_type_id,
                        "Select type"
                    );


                $("psStatus")
                    .innerHTML =
                    optionHtml(
                        state.lookups.partnership_statuses
                        || [],
                        "partnership_status_id",
                        "partnership_status_name",
                        record?.partnership_status_id,
                        "Select status"
                    );


                otherVisible(
                    "psType",
                    "psTypeOtherGroup",
                    "psTypeOther"
                );
            },


        onSave:
            async () => {

                const partnershipTypeId = await ensurePartnershipTypeFromForm(
                    "psType",
                    "psTypeOther"
                );


                const payload = {

                    partner_id:
                        Number(
                            $("psPartner").value
                        ),

                    partnership_title:
                        $("psTitle")
                            .value
                            .trim(),

                    partnership_code:
                        emptyToNull(
                            $("psCode").value
                        ),

                    partnership_type_id:
                        partnershipTypeId,

                    partnership_status_id:
                        numOrNull(
                            $("psStatus").value
                        ),

                    contract_start_date:
                        $("psStart").value,

                    contract_end_date:
                        emptyToNull(
                            $("psEnd").value
                        ),

                    actual_end_date:
                        emptyToNull(
                            $("psActual").value
                        ),

                    area_of_partnership:
                        emptyToNull(
                            $("psArea").value
                        ),

                    strategic_objective:
                        emptyToNull(
                            $("psObjective").value
                        ),

                    geographic_scope_notes:
                        emptyToNull(
                            $("psGeo").value
                        ),

                    whh_focal_person:
                        emptyToNull(
                            $("psWhhFocal").value
                        ),

                    partner_focal_person:
                        emptyToNull(
                            $("psPartnerFocal").value
                        ),

                    whh_role:
                        emptyToNull(
                            $("psWhhRole").value
                        ),

                    partner_role:
                        emptyToNull(
                            $("psPartnerRole").value
                        ),

                    is_co_designed:
                        $("psCoDesign").checked,

                    notes:
                        emptyToNull(
                            $("psNotes").value
                        )
                };


                const saved =
                    await upsertRecord(
                        "partnerships",
                        payload,
                        "partnership_id",
                        record?.partnership_id
                    );


                toast(
                    "Partnership saved."
                );


                await openPartnership(
                    saved.partnership_id
                );
            }
    });
}


// ============================================================
// AGREEMENTS / MOUS
// ============================================================

async function loadAgreements() {
    const body = $("partnershipAgreementsTableBody");
    emptyRow(body, 8, "Loading...");

    const { data, error } = await supabaseClient
        .from("partnership_agreements")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("effective_start_date", { ascending: false });

    if (error) {
        emptyRow(body, 8, error.message);
        return;
    }

    if (!data?.length) {
        emptyRow(body, 8, "No agreements recorded.");
        return;
    }

    body.innerHTML = data.map(agreement => `
        <tr>
            <td>${esc(agreement.agreement_reference || "")}</td>
            <td>${esc(agreement.agreement_title || "")}</td>
            <td>${esc(agreement.agreement_type || "")}</td>
            <td>${fmtDate(agreement.signed_date)}</td>
            <td>${fmtDate(agreement.effective_start_date)}</td>
            <td>${fmtDate(agreement.expiry_date)}</td>
            <td>${statusBadge(
                lookupName(
                    "agreement_statuses",
                    "agreement_status_id",
                    "agreement_status_name",
                    agreement.agreement_status_id
                )
            )}</td>
            <td>
                <button type="button" class="inline-button" data-doc="${agreement.agreement_id}">
                    Files
                </button>
            </td>
        </tr>
    `).join("");

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Agreement",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addAgreementButton")?.addEventListener("click", () => agreementForm());


function agreementForm() {
    const statuses = state.lookups.agreement_statuses || [];

    openModal({
        title: "Add Agreement / MoU",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group">
                <label>Reference</label>
                <input id="agRef">
            </div>

            <div class="form-group full-field">
                <label>Agreement Title *</label>
                <input id="agTitle" required>
            </div>

            <div class="form-group">
                <label>Agreement Type</label>
                <select id="agType">
                    <option>MoU</option>
                    <option>Partnership Agreement</option>
                    <option>Grant Agreement</option>
                    <option>Framework Agreement</option>
                    <option>Contract</option>
                    <option>Other</option>
                </select>
            </div>

            <div id="agOtherGroup" class="form-group hidden">
                <label>Please specify *</label>
                <input id="agOther">
            </div>

            <div class="form-group">
                <label>Status *</label>
                <select id="agStatus" required>
                    ${optionHtml(
                        statuses,
                        "agreement_status_id",
                        "agreement_status_name",
                        null,
                        "Select status"
                    )}
                </select>
            </div>

            <div class="form-group">
                <label>Related Project</label>
                <select id="agProject"><option value="">No project context</option></select>
            </div>

            <div class="form-group">
                <label>Signed Date</label>
                <input id="agSigned" type="date">
            </div>

            <div class="form-group">
                <label>Contract Start Date</label>
                <input id="agStart" type="date">
            </div>

            <div class="form-group">
                <label>Expiry Date</label>
                <input id="agEnd" type="date">
            </div>

            <div class="form-group full-field">
                <label>Notes</label>
                <textarea id="agNotes"></textarea>
            </div>
        </div>
        `,

        onOpen: async () => {
            otherVisible("agType", "agOtherGroup", "agOther");
            const projects = await safeSelect("projects", "project_id,project_name,project_code");
            $("agProject").innerHTML = optionHtml(
                projects,
                "project_id",
                "project_name",
                null,
                "No project context"
            );
        },

        onSave: async () => {
            const agreementType = $("agType").value === "Other"
                ? $("agOther").value.trim()
                : $("agType").value;

            if (!agreementType) {
                throw new Error("Please specify the Agreement Type.");
            }

            const { error } = await supabaseClient
                .from("partnership_agreements")
                .insert({
                    partner_id: state.partnership.partner_id,
                    project_id: numOrNull($("agProject").value),
                    partnership_id: state.partnership.partnership_id,
                    agreement_reference: emptyToNull($("agRef").value),
                    agreement_title: $("agTitle").value.trim(),
                    agreement_type: agreementType,
                    agreement_status_id: Number($("agStatus").value),
                    signed_date: emptyToNull($("agSigned").value),
                    effective_start_date: emptyToNull($("agStart").value),
                    expiry_date: emptyToNull($("agEnd").value),
                    notes: emptyToNull($("agNotes").value)
                });

            if (error) throw error;
            await loadAgreements();
        }
    });
}


// ============================================================
// PARTNERSHIP PROJECTS
// ============================================================

async function loadPartnershipProjects() {

    const body =
        $("partnershipProjectsTableBody");


    emptyRow(
        body,
        4,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partnership_projects"
            )
            .select("*")
            .eq(
                "partnership_id",
                state.partnership.partnership_id
            );


    if (error) {

        emptyRow(
            body,
            4,
            error.message
        );

        return;
    }


    if (
        !data ||
        !data.length
    ) {

        emptyRow(
            body,
            4,
            "No related PROMIS projects."
        );

        return;
    }


    const projects =
        await safeSelect(
            "projects"
        );


    const projectMap =
        Object.fromEntries(
            projects.map(
                project => [
                    project.project_id,
                    project
                ]
            )
        );


    body.innerHTML =
        data
            .map(
                record => {

                    const project =
                        projectMap[
                            record.project_id
                        ]
                        ||
                        {};


                    return `
                        <tr>

                            <td>
                                ${esc(project.project_code || "")}
                            </td>

                            <td>
                                <strong>
                                    ${esc(project.project_name || "")}
                                </strong>
                            </td>

                            <td>
                                ${
                                    esc(
                                        lookupName(
                                            "project_statuses",
                                            "project_status_id",
                                            "project_status_name",
                                            project.project_status_id
                                        )
                                    )
                                }
                            </td>

                            <td>
                                ${esc(record.relationship_notes || "")}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");

}


$("linkPartnershipProjectButton")
    ?.addEventListener(
        "click",
        () =>
            linkProjectForm()
    );


function linkProjectForm() {

    openModal({

        title:
            "Link Project",


        body:
        `
        <div class="form-grid">

            <div class="form-group full-field">

                <label>
                    PROMIS Project *
                </label>

                <select
                    id="lpProject"
                    required
                ></select>

            </div>


            <div class="form-group full-field">

                <label>
                    Relationship Notes
                </label>

                <textarea id="lpNotes"></textarea>

            </div>

        </div>
        `,


        onOpen:
            async () => {

                const projects =
                    await safeSelect(
                        "projects",
                        "project_id,project_name,project_code"
                    );


                $("lpProject")
                    .innerHTML =
                    optionHtml(
                        projects,
                        "project_id",
                        "project_name",
                        null,
                        "Select PROMIS project"
                    );
            },


        onSave:
            async () => {

                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            "partnership_projects"
                        )
                        .insert({

                            partnership_id:
                                state.partnership.partnership_id,

                            project_id:
                                Number(
                                    $("lpProject").value
                                ),

                            relationship_notes:
                                emptyToNull(
                                    $("lpNotes").value
                                )
                        });


                if (error) {
                    throw error;
                }


                await loadPartnershipProjects();
            }
    });
}


// ============================================================
// CAPACITY
// ============================================================

async function loadCapacity() {
    const body = $("capacityAssessmentsTableBody");
    emptyRow(body, 7, "Loading...");

    const { data, error } = await supabaseClient
        .from("capacity_assessments")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("assessment_date", { ascending: false });

    if (error) {
        emptyRow(body, 7, error.message);
        return;
    }

    if (!data?.length) {
        emptyRow(body, 7, "No capacity assessments recorded.");
        hide($("capacityAssessmentDetailContainer"));
        return;
    }

    const gaps = await safeSelect("capacity_gaps");

    body.innerHTML = data.map(assessment => {
        const period = [
            fmtDate(assessment.assessment_period_start),
            fmtDate(assessment.assessment_period_end)
        ].filter(value => value !== "—").join(" – ") || "—";

        return `
        <tr class="clickable-row" data-id="${assessment.capacity_assessment_id}">
            <td>${fmtDate(assessment.assessment_date)}</td>
            <td>${esc(categoryLabel(assessment.assessment_type, assessment.assessment_type_other))}</td>
            <td>${esc(period)}</td>
            <td>${esc(assessment.assessment_method || "")}</td>
            <td>${esc(assessment.assessed_by || "")}</td>
            <td>${gaps.filter(gap => String(gap.capacity_assessment_id) === String(assessment.capacity_assessment_id)).length}</td>
            <td>
                <button type="button" class="inline-button" data-doc="${assessment.capacity_assessment_id}">Files</button>
            </td>
        </tr>
        `;
    }).join("");

    body.querySelectorAll("tr[data-id]").forEach(row => {
        row.onclick = event => {
            if (event.target.closest("button")) return;
            openCapacityAssessment(Number(row.dataset.id));
        };
    });

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Capacity",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addCapacityAssessmentButton")?.addEventListener("click", () => capacityAssessmentForm());


function capacityAssessmentForm() {
    openModal({
        title: "Add Capacity Assessment",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group">
                <label>Assessment Date *</label>
                <input id="caDate" type="date" required>
            </div>

            <div class="form-group">
                <label>Assessment Type</label>
                <select id="caType">
                    <option value="">Select type</option>
                    <option>Initial</option>
                    <option>Periodic</option>
                    <option>Follow-up</option>
                    <option>Endline</option>
                    <option>Other</option>
                </select>
            </div>

            <div class="form-group">
                <label>Assessment Period Start</label>
                <input id="caPeriodStart" type="date">
            </div>

            <div class="form-group">
                <label>Assessment Period End</label>
                <input id="caPeriodEnd" type="date">
            </div>

            <div class="form-group">
                <label>Method</label>
                <input id="caMethod">
            </div>

            <div class="form-group">
                <label>Assessed By</label>
                <input id="caBy">
            </div>

            <div class="form-group full-field">
                <label>Partner Participants</label>
                <textarea id="caParticipants"></textarea>
            </div>

            <div class="form-group full-field">
                <label>Notes</label>
                <textarea id="caNotes"></textarea>
            </div>
        </div>
        `,

        onSave: async () => {
            const start = emptyToNull($("caPeriodStart").value);
            const end = emptyToNull($("caPeriodEnd").value);
            if (start && end && end < start) {
                throw new Error("Assessment Period End cannot be before the start date.");
            }

            const { error } = await supabaseClient
                .from("capacity_assessments")
                .insert({
                    partnership_id: state.partnership.partnership_id,
                    assessment_date: $("caDate").value,
                    assessment_period_start: start,
                    assessment_period_end: end,
                    assessment_type: emptyToNull($("caType").value),
                    assessment_type_other: categoryOtherValue("caType", "caTypeOther"),
                    assessment_method: emptyToNull($("caMethod").value),
                    assessed_by: emptyToNull($("caBy").value),
                    partner_participants: emptyToNull($("caParticipants").value),
                    notes: emptyToNull($("caNotes").value)
                });

            if (error) throw error;
            await loadCapacity();
        }
    });
}


async function openCapacityAssessment(assessmentId) {
    const { data: assessment, error: assessmentError } = await supabaseClient
        .from("capacity_assessments")
        .select("*")
        .eq("capacity_assessment_id", assessmentId)
        .single();

    if (assessmentError) {
        toast(assessmentError.message);
        return;
    }

    const { data: gaps, error: gapsError } = await supabaseClient
        .from("capacity_gaps")
        .select("*")
        .eq("capacity_assessment_id", assessmentId)
        .order("capacity_gap_id");

    if (gapsError) {
        toast(gapsError.message);
        return;
    }

    const gapIds = (gaps || []).map(gap => gap.capacity_gap_id);
    let supports = [];
    let followups = [];

    if (gapIds.length) {
        const supportResult = await supabaseClient
            .from("capacity_support_actions")
            .select("*")
            .in("capacity_gap_id", gapIds)
            .order("start_date");
        if (supportResult.error) {
            toast(supportResult.error.message);
            return;
        }
        supports = supportResult.data || [];

        const followupResult = await supabaseClient
            .from("capacity_followups")
            .select("*")
            .in("capacity_gap_id", gapIds)
            .order("followup_date", { ascending: false });
        if (followupResult.error) {
            toast(followupResult.error.message);
            return;
        }
        followups = followupResult.data || [];
    }

    const container = $("capacityAssessmentDetailContainer");
    show(container);

    const period = [
        fmtDate(assessment.assessment_period_start),
        fmtDate(assessment.assessment_period_end)
    ].filter(value => value !== "—").join(" – ") || "—";

    container.innerHTML = `
        <div class="section-panel">
            <div class="section-title-row">
                <h3>Assessment Detail</h3>
                ${isAdmin() ? `
                    <button id="addGapBtn" class="primary-button small-button">Add Gap</button>
                ` : ""}
            </div>

            <div class="capacity-workflow" aria-label="Capacity workflow">
                <span class="workflow-step">Assessment</span>
                <span class="workflow-arrow">→</span>
                <span class="workflow-step">Gap</span>
                <span class="workflow-arrow">→</span>
                <span class="workflow-step">Support</span>
                <span class="workflow-arrow">→</span>
                <span class="workflow-step">Follow-up</span>
            </div>

            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">Date</span>${fmtDate(assessment.assessment_date)}</div>
                <div class="detail-item"><span class="detail-label">Type</span>${esc(categoryLabel(assessment.assessment_type, assessment.assessment_type_other) || "—")}</div>
                <div class="detail-item"><span class="detail-label">Period</span>${esc(period)}</div>
                <div class="detail-item"><span class="detail-label">Method</span>${esc(assessment.assessment_method || "—")}</div>
                <div class="detail-item"><span class="detail-label">Assessed By</span>${esc(assessment.assessed_by || "—")}</div>
                <div class="detail-item"><span class="detail-label">Partner Participants</span>${esc(assessment.partner_participants || "—")}</div>
                <div class="detail-item full-width-detail"><span class="detail-label">Notes</span>${esc(assessment.notes || "—")}</div>
            </div>

            <div id="capacityGapCards" class="capacity-gap-list"></div>
        </div>
    `;

    const gapContainer = $("capacityGapCards");

    if (!gaps?.length) {
        gapContainer.innerHTML = `<span class="empty-text">No gaps recorded.</span>`;
    } else {
        gapContainer.innerHTML = gaps.map(gap => {
            const standardDomain = lookupName(
                "capacity_domains",
                "capacity_domain_id",
                "capacity_domain_name",
                gap.capacity_domain_id
            );
            const domain = standardDomain.toLowerCase() === "other" && gap.capacity_domain_other
                ? gap.capacity_domain_other
                : standardDomain;

            const gapSupports = supports.filter(item => String(item.capacity_gap_id) === String(gap.capacity_gap_id));
            const gapFollowups = followups.filter(item => String(item.capacity_gap_id) === String(gap.capacity_gap_id));

            return `
                <div class="subrecord-panel" data-gap-card="${gap.capacity_gap_id}">
                    <div class="subrecord-header">
                        <div>
                            <h4>${esc(domain || "Capacity Gap")}</h4>
                            <div class="table-secondary">${statusBadge(gap.status || "Open")} · Priority: ${esc(gap.priority || "—")}</div>
                        </div>
                        ${isAdmin() ? `
                            <div class="subrecord-actions">
                                <button class="inline-button primary-inline" data-support-gap="${gap.capacity_gap_id}">Add Support</button>
                                <button class="inline-button" data-follow-gap="${gap.capacity_gap_id}">Add Follow-up</button>
                            </div>
                        ` : ""}
                    </div>

                    <div class="detail-grid">
                        <div class="detail-item full-width-detail"><span class="detail-label">Gap</span>${esc(gap.capacity_gap || "—")}</div>
                        <div class="detail-item full-width-detail"><span class="detail-label">Evidence / Observation</span>${esc(gap.evidence_observation || "—")}</div>
                        <div class="detail-item"><span class="detail-label">Partner Agrees</span>${boolText(gap.partner_agrees_with_gap)}</div>
                        <div class="detail-item"><span class="detail-label">Immediate Risk</span>${boolText(gap.immediate_risk)}</div>
                    </div>

                    <div class="subrecord-list-block">
                        <strong>Support Actions</strong>
                        ${gapSupports.length ? gapSupports.map(support => `
                            <div class="action-item">
                                <div class="action-item-header">
                                    <span class="action-description">${esc(support.planned_support || "")}</span>
                                    ${statusBadge(support.support_status || "Planned")}
                                </div>
                                <div class="action-meta">
                                    ${esc(support.support_type || "")}
                                    ${support.start_date ? ` · ${fmtDate(support.start_date)}` : ""}
                                    ${support.end_date ? ` – ${fmtDate(support.end_date)}` : ""}
                                </div>
                            </div>
                        `).join("") : `<div class="empty-text">No support actions recorded.</div>`}
                    </div>

                    <div class="subrecord-list-block">
                        <strong>Follow-up / Reassessment</strong>
                        ${gapFollowups.length ? gapFollowups.map(followup => `
                            <div class="action-item">
                                <div class="action-item-header">
                                    <span class="action-description">${fmtDate(followup.followup_date)}</span>
                                    ${statusBadge(followup.gap_status || "")}
                                </div>
                                <div class="action-meta">${esc(followup.change_observed || followup.next_action || "")}</div>
                            </div>
                        `).join("") : `<div class="empty-text">No follow-up recorded.</div>`}
                    </div>
                </div>
            `;
        }).join("");
    }

    $("addGapBtn")?.addEventListener("click", () => capacityGapForm(assessmentId));

    gapContainer?.querySelectorAll("button[data-support-gap]").forEach(button => {
        button.onclick = () => capacitySupportForm(Number(button.dataset.supportGap), assessmentId);
    });

    gapContainer?.querySelectorAll("button[data-follow-gap]").forEach(button => {
        button.onclick = () => capacityFollowupForm(Number(button.dataset.followGap), assessmentId);
    });
}


function capacityGapForm(assessmentId) {
    openModal({
        title: "Add Capacity Gap",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group">
                <label>Domain</label>
                <select id="cgDomain">
                    ${optionHtml(
                        state.lookups.capacity_domains || [],
                        "capacity_domain_id",
                        "capacity_domain_name",
                        null,
                        "Select domain"
                    )}
                </select>
            </div>

            <div id="cgOtherGroup" class="form-group hidden">
                <label>Please specify domain *</label>
                <input id="cgOther">
            </div>

            <div class="form-group full-field">
                <label>Capacity Gap *</label>
                <textarea id="cgGap" required></textarea>
            </div>

            <div class="form-group full-field">
                <label>Evidence / Observation</label>
                <textarea id="cgEvidence"></textarea>
            </div>

            <div class="form-group">
                <label>Priority</label>
                <select id="cgPriority">
                    <option>High</option>
                    <option selected>Medium</option>
                    <option>Low</option>
                </select>
            </div>

            <div class="form-group">
                <label>Status</label>
                <select id="cgStatus">
                    <option>Open</option>
                    <option>Improving</option>
                    <option>Addressed</option>
                </select>
            </div>

            <div class="form-group checkbox-group">
                <label><input id="cgAgreed" type="checkbox"> Partner agrees with gap</label>
            </div>

            <div class="form-group checkbox-group">
                <label><input id="cgRisk" type="checkbox"> Immediate risk</label>
            </div>

            <div class="form-group full-field">
                <label>Notes</label>
                <textarea id="cgNotes"></textarea>
            </div>
        </div>
        `,

        onOpen: () => otherVisible("cgDomain", "cgOtherGroup", "cgOther"),

        onSave: async () => {
            const isOther = selectedOptionText("cgDomain").toLowerCase() === "other";
            if (isOther && !$("cgOther").value.trim()) {
                throw new Error("Please specify the Capacity Domain.");
            }

            const { error } = await supabaseClient
                .from("capacity_gaps")
                .insert({
                    capacity_assessment_id: assessmentId,
                    capacity_domain_id: numOrNull($("cgDomain").value),
                    capacity_domain_other: isOther ? emptyToNull($("cgOther").value) : null,
                    capacity_gap: $("cgGap").value.trim(),
                    evidence_observation: emptyToNull($("cgEvidence").value),
                    priority: $("cgPriority").value,
                    partner_agrees_with_gap: $("cgAgreed").checked,
                    immediate_risk: $("cgRisk").checked,
                    status: $("cgStatus").value,
                    notes: emptyToNull($("cgNotes").value)
                });

            if (error) throw error;
            await openCapacityAssessment(assessmentId);
        }
    });
}


function capacitySupportForm(gapId, assessmentId) {
    openModal({
        title: "Capacity Support Action",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group full-field">
                <label>Planned Support *</label>
                <textarea id="csPlanned" required></textarea>
            </div>

            <div class="form-group">
                <label>Support Type</label>
                <select id="csType">
                    <option value="">Select type</option>
                    <option>Training</option>
                    <option>Mentorship</option>
                    <option>Technical Assistance</option>
                    <option>Coaching</option>
                    <option>Systems Support</option>
                    <option>Peer Learning</option>
                    <option>Other</option>
                </select>
            </div>

            <div id="csOtherGroup" class="form-group hidden">
                <label>Please specify *</label>
                <input id="csOther">
            </div>

            <div class="form-group"><label>WHH Responsible</label><input id="csWhh"></div>
            <div class="form-group"><label>Partner Responsible</label><input id="csPartner"></div>
            <div class="form-group"><label>Start Date</label><input id="csStart" type="date"></div>
            <div class="form-group"><label>End Date</label><input id="csEnd" type="date"></div>

            <div class="form-group">
                <label>Status</label>
                <select id="csStatus">
                    <option>Planned</option>
                    <option>Ongoing</option>
                    <option>Completed</option>
                </select>
            </div>

            <div class="form-group"><label>Completion Date</label><input id="csCompletion" type="date"></div>
            <div class="form-group full-field"><label>Resources Required</label><textarea id="csResources"></textarea></div>
            <div class="form-group full-field"><label>Support Delivered</label><textarea id="csDelivered"></textarea></div>
            <div class="form-group full-field"><label>Notes</label><textarea id="csNotes"></textarea></div>
        </div>
        `,

        onOpen: () => otherVisible("csType", "csOtherGroup", "csOther"),

        onSave: async () => {
            const supportType = $("csType").value === "Other"
                ? $("csOther").value.trim()
                : emptyToNull($("csType").value);

            if ($("csType").value === "Other" && !supportType) {
                throw new Error("Please specify the Support Type.");
            }

            const start = emptyToNull($("csStart").value);
            const end = emptyToNull($("csEnd").value);
            if (start && end && end < start) {
                throw new Error("End Date cannot be before Start Date.");
            }

            const { error } = await supabaseClient
                .from("capacity_support_actions")
                .insert({
                    capacity_gap_id: gapId,
                    planned_support: $("csPlanned").value.trim(),
                    support_type: supportType,
                    whh_responsible_person: emptyToNull($("csWhh").value),
                    partner_responsible_person: emptyToNull($("csPartner").value),
                    start_date: start,
                    end_date: end,
                    support_status: $("csStatus").value,
                    resources_required: emptyToNull($("csResources").value),
                    support_delivered: emptyToNull($("csDelivered").value),
                    completion_date: emptyToNull($("csCompletion").value),
                    notes: emptyToNull($("csNotes").value)
                });

            if (error) throw error;
            await openCapacityAssessment(assessmentId);
        }
    });
}


async function capacityFollowupForm(gapId, assessmentId) {
    const { data: supports, error: supportError } = await supabaseClient
        .from("capacity_support_actions")
        .select("capacity_support_id,planned_support")
        .eq("capacity_gap_id", gapId)
        .order("capacity_support_id");

    if (supportError) {
        toast(supportError.message);
        return;
    }

    openModal({
        title: "Capacity Follow-up / Reassessment",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group">
                <label>Follow-up Date *</label>
                <input id="cfuDate" type="date" required>
            </div>

            <div class="form-group">
                <label>Related Support Action</label>
                <select id="cfuSupport">
                    ${optionHtml(
                        supports || [],
                        "capacity_support_id",
                        "planned_support",
                        null,
                        "No specific support action"
                    )}
                </select>
            </div>

            <div class="form-group">
                <label>Gap Status</label>
                <select id="cfuStatus">
                    <option>Open</option>
                    <option>Improving</option>
                    <option>Addressed</option>
                </select>
            </div>

            <div class="form-group checkbox-group">
                <label><input id="cfuFurther" type="checkbox"> Further support needed</label>
            </div>

            <div class="form-group full-field"><label>Change Observed</label><textarea id="cfuChange"></textarea></div>
            <div class="form-group full-field"><label>Evidence of Change</label><textarea id="cfuEvidence"></textarea></div>
            <div class="form-group full-field"><label>Remaining Gap</label><textarea id="cfuRemaining"></textarea></div>
            <div class="form-group full-field"><label>Next Action</label><textarea id="cfuNext"></textarea></div>
            <div class="form-group full-field"><label>Notes</label><textarea id="cfuNotes"></textarea></div>
        </div>
        `,

        onSave: async () => {
            const { error } = await supabaseClient
                .from("capacity_followups")
                .insert({
                    capacity_gap_id: gapId,
                    capacity_support_id: numOrNull($("cfuSupport").value),
                    followup_date: $("cfuDate").value,
                    gap_status: emptyToNull($("cfuStatus").value),
                    change_observed: emptyToNull($("cfuChange").value),
                    evidence_of_change: emptyToNull($("cfuEvidence").value),
                    remaining_gap: emptyToNull($("cfuRemaining").value),
                    further_support_needed: $("cfuFurther").checked,
                    next_action: emptyToNull($("cfuNext").value),
                    notes: emptyToNull($("cfuNotes").value)
                });

            if (error) throw error;
            await openCapacityAssessment(assessmentId);
        }
    });
}


// ============================================================
// EQUITY
// ============================================================

async function loadEquity() {
    const body = $("equityReviewsTableBody");
    emptyRow(body, 8, "Loading...");

    const { data, error } = await supabaseClient
        .from("partnership_equity_reviews")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("assessment_date", { ascending: false });

    if (error) {
        emptyRow(body, 8, error.message);
        return;
    }

    if (!data?.length) {
        emptyRow(body, 8, "No equity reviews recorded.");
        return;
    }

    body.innerHTML = data.map(review => `
        <tr>
            <td>${fmtDate(review.assessment_date)}</td>
            <td>${esc(review.equity_area_dimension || "")}</td>
            <td>${esc(review.conducted_by || "")}</td>
            <td>${review.improvement_needed === null || review.improvement_needed === undefined ? "—" : boolText(review.improvement_needed)}</td>
            <td>${esc(review.responsible_party || "")}</td>
            <td>${fmtDate(review.target_date)}</td>
            <td>${statusBadge(review.review_status || "Open")}</td>
            <td><button class="inline-button" data-doc="${review.equity_review_id}">Files</button></td>
        </tr>
    `).join("");

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Equity",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addEquityReviewButton")?.addEventListener("click", () => {
    openModal({
        title: "Add Equity Review",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group"><label>Assessment Date *</label><input id="eqDate" type="date" required></div>
            <div class="form-group"><label>Conducted By</label><input id="eqBy"></div>
            <div class="form-group"><label>Assessment Period Start</label><input id="eqStart" type="date"></div>
            <div class="form-group"><label>Assessment Period End</label><input id="eqEnd" type="date"></div>
            <div class="form-group full-field"><label>Equity Area / Dimension</label><input id="eqDimension"></div>
            <div class="form-group full-field"><label>WHH Reflection</label><textarea id="eqWhh"></textarea></div>
            <div class="form-group full-field"><label>Partner Reflection</label><textarea id="eqPartner"></textarea></div>
            <div class="form-group full-field"><label>Joint Observation</label><textarea id="eqJoint"></textarea></div>
            <div class="form-group checkbox-group"><label><input id="eqImproveNeeded" type="checkbox"> Improvement needed</label></div>
            <div class="form-group full-field"><label>Improvement Action</label><textarea id="eqAction"></textarea></div>
            <div class="form-group"><label>Responsible Party</label><input id="eqResp"></div>
            <div class="form-group"><label>Target Date</label><input id="eqTarget" type="date"></div>
            <div class="form-group">
                <label>Review Status</label>
                <select id="eqStatus"><option>Open</option><option>In Progress</option><option>Completed</option></select>
            </div>
            <div class="form-group full-field"><label>Notes</label><textarea id="eqNotes"></textarea></div>
        </div>
        `,

        onSave: async () => {
            const start = emptyToNull($("eqStart").value);
            const end = emptyToNull($("eqEnd").value);
            if (start && end && end < start) {
                throw new Error("Assessment Period End cannot be before the start date.");
            }

            const { error } = await supabaseClient
                .from("partnership_equity_reviews")
                .insert({
                    partnership_id: state.partnership.partnership_id,
                    assessment_date: $("eqDate").value,
                    assessment_period_start: start,
                    assessment_period_end: end,
                    conducted_by: emptyToNull($("eqBy").value),
                    equity_area_dimension: emptyToNull($("eqDimension").value),
                    whh_reflection: emptyToNull($("eqWhh").value),
                    partner_reflection: emptyToNull($("eqPartner").value),
                    joint_observation: emptyToNull($("eqJoint").value),
                    improvement_needed: $("eqImproveNeeded").checked,
                    improvement_action: emptyToNull($("eqAction").value),
                    responsible_party: emptyToNull($("eqResp").value),
                    target_date: emptyToNull($("eqTarget").value),
                    review_status: $("eqStatus").value,
                    notes: emptyToNull($("eqNotes").value)
                });

            if (error) throw error;
            await loadEquity();
        }
    });
});


// ============================================================
// FEEDBACK
// ============================================================

async function loadFeedback() {
    const body = $("feedbackTableBody");
    emptyRow(body, 8, "Loading...");

    const { data, error } = await supabaseClient
        .from("feedback_records")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("date_received", { ascending: false });

    if (error) {
        emptyRow(body, 8, error.message);
        return;
    }

    if (!data?.length) {
        emptyRow(body, 8, "No feedback recorded.");
        return;
    }

    body.innerHTML = data.map(feedback => `
        <tr>
            <td>${fmtDate(feedback.date_received)}</td>
            <td>${esc(categoryLabel(feedback.feedback_from, feedback.feedback_from_other))}</td>
            <td>${esc(categoryLabel(feedback.feedback_to, feedback.feedback_to_other))}</td>
            <td>${esc(feedback.feedback_type || "")}</td>
            <td>${esc(feedback.subject || feedback.issue_category || "")}</td>
            <td>${statusBadge(
                lookupName(
                    "feedback_resolution_statuses",
                    "feedback_resolution_status_id",
                    "feedback_resolution_status_name",
                    feedback.resolution_status_id
                )
            )}</td>
            <td>${feedback.follow_up_required ? "Yes" : "No"}</td>
            <td><button class="inline-button" data-doc="${feedback.feedback_id}">Files</button></td>
        </tr>
    `).join("");

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Feedback",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addFeedbackButton")?.addEventListener("click", () => feedbackForm());


function feedbackForm() {
    openModal({
        title: "Add Partnership Feedback",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group"><label>Date Received *</label><input id="fbDate" type="date" required></div>

            <div class="form-group"><label>From</label><select id="fbFrom"><option>Partner</option><option>WHH</option><option>Joint</option><option>Other</option></select></div>
            <div class="form-group"><label>To</label><select id="fbTo"><option>WHH</option><option>Partner</option><option>Joint</option><option>Other</option></select></div>

            <div class="form-group">
                <label>Feedback Type</label>
                <select id="fbType">
                    <option>Concern</option><option>Suggestion</option><option>Appreciation</option><option>Complaint</option><option>Learning</option><option>Other</option>
                </select>
            </div>
            <div id="fbTypeOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="fbTypeOther"></div>

            <div class="form-group"><label>Related Project</label><select id="fbProject"><option value="">No project context</option></select></div>

            <div class="form-group full-field"><label>Subject</label><input id="fbSubject"></div>
            <div class="form-group full-field"><label>Issue Category</label><input id="fbCategory"></div>
            <div class="form-group full-field"><label>Feedback Details *</label><textarea id="fbDetails" required></textarea></div>

            <div class="form-group">
                <label>Mechanism</label>
                <select id="fbMechanism">
                    ${optionHtml(
                        state.lookups.feedback_mechanisms || [],
                        "feedback_mechanism_id",
                        "feedback_mechanism_name",
                        null,
                        "Select mechanism"
                    )}
                </select>
            </div>
            <div id="fbMechOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="fbMechOther"></div>

            <div class="form-group">
                <label>Resolution Status</label>
                <select id="fbResolution">
                    ${optionHtml(
                        state.lookups.feedback_resolution_statuses || [],
                        "feedback_resolution_status_id",
                        "feedback_resolution_status_name",
                        null,
                        "Select status"
                    )}
                </select>
            </div>

            <div class="form-group"><label>Resolution Date</label><input id="fbResolutionDate" type="date"></div>
            <div class="form-group"><label>Responsible Party</label><input id="fbResp"></div>
            <div class="form-group full-field"><label>Resolution / Response</label><textarea id="fbAction"></textarea></div>
            <div class="form-group full-field"><label>Follow-up Notes</label><textarea id="fbFollowNotes"></textarea></div>

            <div class="form-group checkbox-group"><label><input id="fbConf" type="checkbox"> Confidential</label></div>
            <div class="form-group checkbox-group"><label><input id="fbActionRequired" type="checkbox"> Action required</label></div>
            <div class="form-group checkbox-group"><label><input id="fbJoint" type="checkbox"> Jointly resolved</label></div>
            <div class="form-group checkbox-group"><label><input id="fbFollow" type="checkbox"> Follow-up required</label></div>

            <div class="form-group full-field"><label>Notes</label><textarea id="fbNotes"></textarea></div>
        </div>
        `,

        onOpen: async () => {
            otherVisible("fbType", "fbTypeOtherGroup", "fbTypeOther");
            otherVisible("fbMechanism", "fbMechOtherGroup", "fbMechOther");
            const projects = await safeSelect("projects", "project_id,project_name,project_code");
            $("fbProject").innerHTML = optionHtml(projects, "project_id", "project_name", null, "No project context");
        },

        onSave: async () => {
            const feedbackType = $("fbType").value === "Other"
                ? $("fbTypeOther").value.trim()
                : $("fbType").value;
            if (!feedbackType) throw new Error("Please specify the Feedback Type.");

            const mechanismIsOther = selectedOptionText("fbMechanism").toLowerCase() === "other";
            if (mechanismIsOther && !$("fbMechOther").value.trim()) {
                throw new Error("Please specify the Feedback Mechanism.");
            }

            const dateReceived = $("fbDate").value;
            const resolutionDate = emptyToNull($("fbResolutionDate").value);
            if (resolutionDate && resolutionDate < dateReceived) {
                throw new Error("Resolution Date cannot be before Date Received.");
            }

            const { error } = await supabaseClient
                .from("feedback_records")
                .insert({
                    partner_id: state.partnership.partner_id,
                    project_id: numOrNull($("fbProject").value),
                    partnership_id: state.partnership.partnership_id,
                    feedback_mechanism_id: numOrNull($("fbMechanism").value),
                    feedback_mechanism_other: mechanismIsOther ? emptyToNull($("fbMechOther").value) : null,
                    date_received: dateReceived,
                    issue_category: emptyToNull($("fbCategory").value),
                    feedback_summary: $("fbDetails").value.trim(),
                    resolution_status_id: numOrNull($("fbResolution").value),
                    resolution_date: resolutionDate,
                    is_jointly_resolved: $("fbJoint").checked,
                    notes: emptyToNull($("fbNotes").value),
                    feedback_from: emptyToNull($("fbFrom").value),
                    feedback_from_other: categoryOtherValue("fbFrom", "fbFromOther"),
                    feedback_to: emptyToNull($("fbTo").value),
                    feedback_to_other: categoryOtherValue("fbTo", "fbToOther"),
                    feedback_type: feedbackType,
                    subject: emptyToNull($("fbSubject").value),
                    is_confidential: $("fbConf").checked,
                    action_required: $("fbActionRequired").checked,
                    responsible_party: emptyToNull($("fbResp").value),
                    resolution_response: emptyToNull($("fbAction").value),
                    follow_up_required: $("fbFollow").checked,
                    follow_up_notes: emptyToNull($("fbFollowNotes").value)
                });

            if (error) throw error;
            await loadFeedback();
        }
    });
}


// ============================================================
// PARTNERSHIP MEETINGS
// ============================================================

async function loadPartnershipMeetings() {
    const body = $("partnershipMeetingsTableBody");
    emptyRow(body, 6, "Loading...");

    const { data, error } = await supabaseClient
        .from("coordination_meetings")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("meeting_date", { ascending: false });

    if (error) {
        emptyRow(body, 6, error.message);
        return;
    }

    const actions = await safeSelect("action_points");

    if (!data?.length) {
        emptyRow(body, 6, "No meetings recorded.");
        hide($("meetingDetailContainer"));
        return;
    }

    body.innerHTML = data.map(meeting => {
        const standardType = lookupName(
            "meeting_types",
            "meeting_type_id",
            "meeting_type_name",
            meeting.meeting_type_id
        );
        const type = standardType.toLowerCase() === "other" && meeting.meeting_type
            ? meeting.meeting_type
            : (standardType || meeting.meeting_type || "");

        const openActionCount = actions.filter(action => {
            if (String(action.meeting_id) !== String(meeting.meeting_id)) return false;
            const status = lookupName(
                "action_statuses",
                "action_status_id",
                "action_status_name",
                action.action_status_id
            ) || action.action_status || "";
            return !["Completed", "Closed"].includes(status);
        }).length;

        return `
            <tr class="clickable-row" data-id="${meeting.meeting_id}">
                <td>${fmtDate(meeting.meeting_date)}</td>
                <td><span class="table-link">${esc(meeting.meeting_title || "")}</span></td>
                <td>${esc(type)}</td>
                <td>${meeting.follow_up_required ? "Yes" : "No"}</td>
                <td>${openActionCount}</td>
                <td><button class="inline-button" data-doc="${meeting.meeting_id}">Files</button></td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll("tr[data-id]").forEach(row => {
        row.onclick = event => {
            if (event.target.closest("button")) return;
            openMeetingDetail(Number(row.dataset.id));
        };
    });

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Meeting",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addMeetingButton")?.addEventListener("click", () => meetingForm(state.partnership?.partnership_id));
$("addStandaloneMeetingButton")?.addEventListener("click", () => meetingForm());


function meetingForm(presetPartnershipId = null) {
    openModal({
        title: "Add Meeting",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group full-field"><label>Partnership</label><select id="mtPartnership"></select></div>
            <div class="form-group"><label>Meeting Date *</label><input id="mtDate" type="date" required></div>
            <div class="form-group">
                <label>Meeting Type</label>
                <select id="mtType">
                    ${optionHtml(
                        state.lookups.meeting_types || [],
                        "meeting_type_id",
                        "meeting_type_name",
                        null,
                        "Select type"
                    )}
                </select>
            </div>
            <div id="mtOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="mtOther"></div>
            <div class="form-group full-field"><label>Meeting Title *</label><input id="mtTitle" required></div>
            <div class="form-group full-field"><label>WHH Participants</label><textarea id="mtWhhParticipants"></textarea></div>
            <div class="form-group full-field"><label>Partner Participants</label><textarea id="mtPartnerParticipants"></textarea></div>
            <div class="form-group full-field"><label>Discussion Outcomes</label><textarea id="mtOutcomes"></textarea></div>
            <div class="form-group full-field"><label>Issues Raised</label><textarea id="mtIssues"></textarea></div>
            <div class="form-group checkbox-group"><label><input id="mtFollow" type="checkbox"> Follow-up required</label></div>
            <div class="form-group full-field"><label>Notes</label><textarea id="mtNotes"></textarea></div>
        </div>
        `,

        onOpen: async () => {
            const partnerships = await safeSelect("partnerships", "partnership_id,partnership_title");
            $("mtPartnership").innerHTML = optionHtml(
                partnerships,
                "partnership_id",
                "partnership_title",
                presetPartnershipId,
                "Select partnership"
            );
            otherVisible("mtType", "mtOtherGroup", "mtOther");
        },

        onSave: async () => {
            const customType = selectedOptionText("mtType").toLowerCase() === "other"
                ? $("mtOther").value.trim()
                : null;
            if (selectedOptionText("mtType").toLowerCase() === "other" && !customType) {
                throw new Error("Please specify the Meeting Type.");
            }

            const partnershipId = numOrNull($("mtPartnership").value);

            const { error } = await supabaseClient
                .from("coordination_meetings")
                .insert({
                    partnership_id: partnershipId,
                    meeting_date: $("mtDate").value,
                    meeting_type_id: numOrNull($("mtType").value),
                    meeting_type: customType,
                    meeting_title: $("mtTitle").value.trim(),
                    whh_participants: emptyToNull($("mtWhhParticipants").value),
                    partner_participants: emptyToNull($("mtPartnerParticipants").value),
                    discussion_outcomes: emptyToNull($("mtOutcomes").value),
                    issues_raised: emptyToNull($("mtIssues").value),
                    follow_up_required: $("mtFollow").checked,
                    notes: emptyToNull($("mtNotes").value)
                });

            if (error) throw error;

            if (state.partnership && String(state.partnership.partnership_id) === String(partnershipId)) {
                await loadPartnershipMeetings();
            } else {
                await loadMeetingsWorkspace();
            }
        }
    });
}


async function openMeetingDetail(meetingId) {
    const { data: meeting, error: meetingError } = await supabaseClient
        .from("coordination_meetings")
        .select("*")
        .eq("meeting_id", meetingId)
        .single();

    if (meetingError) {
        toast(meetingError.message);
        return;
    }

    const { data: actions, error } = await supabaseClient
        .from("action_points")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("target_date");

    if (error) {
        toast(error.message);
        return;
    }

    const container = $("meetingDetailContainer");
    show(container);

    container.innerHTML = `
        <div class="section-panel">
            <div class="section-title-row">
                <h3>${esc(meeting.meeting_title || "Meeting")}</h3>
                ${isAdmin() ? `<button id="addActionBtn" class="primary-button small-button">Add Action</button>` : ""}
            </div>

            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">Date</span>${fmtDate(meeting.meeting_date)}</div>
                <div class="detail-item"><span class="detail-label">WHH Participants</span>${esc(meeting.whh_participants || "—")}</div>
                <div class="detail-item"><span class="detail-label">Partner Participants</span>${esc(meeting.partner_participants || "—")}</div>
                <div class="detail-item full-width-detail"><span class="detail-label">Discussion Outcomes</span>${esc(meeting.discussion_outcomes || "—")}</div>
                <div class="detail-item full-width-detail"><span class="detail-label">Issues Raised</span>${esc(meeting.issues_raised || "—")}</div>
            </div>

            <h4>Action Points</h4>
            <div class="action-list">
                ${actions?.length ? actions.map(action => `
                    <div class="action-item">
                        <div class="action-item-header">
                            <span class="action-description">${esc(action.action_description)}</span>
                            ${statusBadge(
                                lookupName(
                                    "action_statuses",
                                    "action_status_id",
                                    "action_status_name",
                                    action.action_status_id
                                ) || action.action_status || ""
                            )}
                        </div>
                        <div class="action-meta">
                            Responsible: ${esc(action.responsible_person || action.assigned_to || "—")}
                            · Due: ${fmtDate(action.target_date)}
                            · Priority: ${esc(action.priority || "—")}
                        </div>
                    </div>
                `).join("") : `<span class="empty-text">No action points.</span>`}
            </div>
        </div>
    `;

    $("addActionBtn")?.addEventListener("click", () => actionForm(meetingId, meeting.partnership_id));
}


function actionForm(meetingId, partnershipId) {
    openModal({
        title: "Add Action Point",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group full-field"><label>Action *</label><textarea id="acDesc" required></textarea></div>
            <div class="form-group"><label>Responsible Person</label><input id="acResp"></div>
            <div class="form-group"><label>Assigned To</label><input id="acAssigned"></div>
            <div class="form-group"><label>Target Date</label><input id="acTarget" type="date"></div>
            <div class="form-group"><label>Completion Date</label><input id="acCompletion" type="date"></div>
            <div class="form-group"><label>Priority</label><select id="acPriority"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
            <div class="form-group">
                <label>Status</label>
                <select id="acStatus">
                    ${optionHtml(
                        state.lookups.action_statuses || [],
                        "action_status_id",
                        "action_status_name",
                        null,
                        "Select status"
                    )}
                </select>
            </div>
            <div class="form-group">
                <label>Related Module</label>
                <select id="acModule">
                    <option>General partnership</option><option>Capacity</option><option>Feedback</option><option>Equity</option><option>Agreement</option><option>Project</option><option>Other</option>
                </select>
            </div>
            <div id="acOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="acOther"></div>
            <div class="form-group full-field"><label>Completion Notes</label><textarea id="acCompletionNotes"></textarea></div>
            <div class="form-group full-field"><label>Evidence Notes</label><textarea id="acEvidence"></textarea></div>
            <div class="form-group full-field"><label>Notes</label><textarea id="acNotes"></textarea></div>
        </div>
        `,

        onOpen: () => otherVisible("acModule", "acOtherGroup", "acOther"),

        onSave: async () => {
            const relatedModule = $("acModule").value === "Other"
                ? $("acOther").value.trim()
                : $("acModule").value;
            if (!relatedModule) throw new Error("Please specify the Related Module.");

            const { error } = await supabaseClient
                .from("action_points")
                .insert({
                    meeting_id: meetingId,
                    partnership_id: partnershipId,
                    action_description: $("acDesc").value.trim(),
                    responsible_person: emptyToNull($("acResp").value),
                    assigned_to: emptyToNull($("acAssigned").value),
                    target_date: emptyToNull($("acTarget").value),
                    completion_date: emptyToNull($("acCompletion").value),
                    priority: $("acPriority").value,
                    action_status_id: numOrNull($("acStatus").value),
                    related_module: relatedModule,
                    completion_notes: emptyToNull($("acCompletionNotes").value),
                    evidence_notes: emptyToNull($("acEvidence").value),
                    notes: emptyToNull($("acNotes").value)
                });

            if (error) throw error;
            await openMeetingDetail(meetingId);
        }
    });
}


// ============================================================
// GLOBAL MEETINGS WORKSPACE
// ============================================================

async function loadMeetingsWorkspace(
    search = ""
) {

    const body =
        $("meetingTableBody");


    emptyRow(
        body,
        6,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "coordination_meetings"
            )
            .select("*")
            .order(
                "meeting_date",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        emptyRow(
            body,
            6,
            error.message
        );

        return;
    }


    const partnerships =
        await safeSelect(
            "partnerships"
        );


    const partners =
        await safeSelect(
            "partners",
            "partner_id,partner_name"
        );


    const partnershipMap =
        Object.fromEntries(
            partnerships.map(
                partnership => [
                    partnership.partnership_id,
                    partnership
                ]
            )
        );


    const partnerMap =
        Object.fromEntries(
            partners.map(
                partner => [
                    partner.partner_id,
                    partner
                ]
            )
        );


    const actions =
        await safeSelect(
            "action_points"
        );


    let rows =
        data || [];


    if (
        search.trim()
    ) {

        const searchText =
            search
                .trim()
                .toLowerCase();


        rows =
            rows.filter(
                meeting =>
                    String(
                        meeting.meeting_title
                        ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            searchText
                        )
            );
    }


    if (
        !rows.length
    ) {

        emptyRow(
            body,
            6,
            "No meetings found."
        );

        return;
    }


    body.innerHTML =
        rows
            .map(
                meeting => {

                    const partnership =
                        partnershipMap[
                            meeting.partnership_id
                        ]
                        ||
                        {};


                    return `
                        <tr>

                            <td>
                                ${fmtDate(meeting.meeting_date)}
                            </td>

                            <td>
                                ${
                                    esc(
                                        partnerMap[
                                            partnership.partner_id
                                        ]?.partner_name
                                        ||
                                        ""
                                    )
                                }
                            </td>

                            <td>
                                ${esc(partnership.partnership_title || "")}
                            </td>

                            <td>
                                ${esc(meeting.meeting_title || "")}
                            </td>

                            <td>
                                ${
                                    esc(
                                        lookupName(
                                            "meeting_types",
                                            "meeting_type_id",
                                            "meeting_type_name",
                                            meeting.meeting_type_id
                                        )
                                        ||
                                        meeting.meeting_type
                                        ||
                                        ""
                                    )
                                }
                            </td>

                            <td>
                                ${
                                    actions.filter(
                                        action =>
                                            String(
                                                action.meeting_id
                                            )
                                            ===
                                            String(
                                                meeting.meeting_id
                                            )
                                    ).length
                                }
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


$("meetingSearch")
    ?.addEventListener(
        "input",
        event =>
            loadMeetingsWorkspace(
                event.target.value
            )
    );


// ============================================================
// SUCCESS STORIES
// ============================================================

async function loadStories() {
    const body = $("successStoriesTableBody");
    emptyRow(body, 7, "Loading...");

    const { data, error } = await supabaseClient
        .from("success_stories")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("date_submitted", { ascending: false });

    if (error) {
        emptyRow(body, 7, error.message);
        return;
    }

    const projects = await safeSelect("projects", "project_id,project_code,project_name");
    const projectMap = Object.fromEntries(projects.map(project => [project.project_id, project]));

    if (!data?.length) {
        emptyRow(body, 7, "No success stories recorded.");
        return;
    }

    body.innerHTML = data.map(story => `
        <tr>
            <td>${fmtDate(story.date_submitted)}</td>
            <td>${esc(story.title || "")}</td>
            <td>${esc(story.success_type || "")}</td>
            <td>${esc(projectMap[story.project_id]?.project_code || "")}</td>
            <td>${statusBadge(story.story_status || "")}</td>
            <td>${story.permission_external_use ? "Yes" : "No"}</td>
            <td><button class="inline-button" data-doc="${story.success_story_id}">Files</button></td>
        </tr>
    `).join("");

    body.querySelectorAll("button[data-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Success Story",
            context_record_id: Number(button.dataset.doc)
        });
    });
}


$("addSuccessStoryButton")?.addEventListener("click", () => storyForm());


function storyForm() {
    openModal({
        title: "Add Success Story",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group"><label>Date</label><input id="stDate" type="date"></div>
            <div class="form-group"><label>Related Project</label><select id="stProject"><option value="">No project context</option></select></div>
            <div class="form-group">
                <label>Success Type</label>
                <select id="stType">
                    <option>Localization</option><option>Policy influence</option><option>Institutional Strengthening</option><option>Advocacy</option><option>Innovation</option><option>Sustainability</option><option>Resource mobilization</option><option>Relationship strengthening</option><option>Other</option>
                </select>
            </div>
            <div id="stOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="stOther"></div>
            <div class="form-group full-field"><label>Title *</label><input id="stTitle" required></div>
            <div class="form-group full-field"><label>Situation Before</label><textarea id="stBefore"></textarea></div>
            <div class="form-group full-field"><label>Partnership Contribution</label><textarea id="stContribution"></textarea></div>
            <div class="form-group full-field"><label>Result / Change *</label><textarea id="stResult" required></textarea></div>
            <div class="form-group full-field"><label>Why It Matters</label><textarea id="stWhy"></textarea></div>
            <div class="form-group full-field"><label>Evidence</label><textarea id="stEvidence"></textarea></div>
            <div class="form-group full-field"><label>Partner Testimonial</label><textarea id="stTestimonial"></textarea></div>
            <div class="form-group full-field"><label>WHH Reflection / Lessons</label><textarea id="stReflection"></textarea></div>
            <div class="form-group checkbox-group"><label><input id="stReplicate" type="checkbox"> Replicable / scalable</label></div>
            <div class="form-group checkbox-group"><label><input id="stPermission" type="checkbox"> Permission for external use</label></div>
            <div class="form-group"><label>Status</label><select id="stStatus"><option>Draft</option><option>Reviewed</option><option>Approved</option></select></div>
        </div>
        `,

        onOpen: async () => {
            otherVisible("stType", "stOtherGroup", "stOther");
            const projects = await safeSelect("projects", "project_id,project_name,project_code");
            $("stProject").innerHTML = optionHtml(projects, "project_id", "project_name", null, "No project context");
        },

        onSave: async () => {
            const successType = $("stType").value === "Other"
                ? $("stOther").value.trim()
                : $("stType").value;
            if (!successType) throw new Error("Please specify the Success Type.");

            const resultChange = $("stResult").value.trim();
            const { error } = await supabaseClient
                .from("success_stories")
                .insert({
                    project_id: numOrNull($("stProject").value),
                    partnership_id: state.partnership.partnership_id,
                    partner_id: state.partnership.partner_id,
                    title: $("stTitle").value.trim(),
                    story_text: resultChange,
                    date_submitted: emptyToNull($("stDate").value),
                    success_type: successType,
                    situation_before: emptyToNull($("stBefore").value),
                    partnership_contribution: emptyToNull($("stContribution").value),
                    result_change: resultChange,
                    why_it_matters: emptyToNull($("stWhy").value),
                    evidence_text: emptyToNull($("stEvidence").value),
                    partner_testimonial: emptyToNull($("stTestimonial").value),
                    whh_reflection: emptyToNull($("stReflection").value),
                    key_lessons_learned: emptyToNull($("stReflection").value),
                    is_replicable_scalable: $("stReplicate").checked,
                    permission_external_use: $("stPermission").checked,
                    story_status: $("stStatus").value
                });

            if (error) throw error;
            await loadStories();
        }
    });
}


// ============================================================
// EXIT / CLOSURE
// ============================================================

async function loadExit() {
    const container = $("exitStrategyContainer");
    container.textContent = "Loading...";

    const { data, error } = await supabaseClient
        .from("exit_strategies")
        .select("*")
        .eq("partnership_id", state.partnership.partnership_id)
        .order("planned_transition_date", { ascending: false });

    if (error) {
        container.textContent = error.message;
        return;
    }

    if (!data?.length) {
        container.innerHTML = `<span class="empty-text">No exit / closure record.</span>`;
        return;
    }

    container.innerHTML = data.map(record => `
        <div class="exit-summary">
            <div class="exit-block"><div class="exit-block-title">Closure Status</div>${esc(record.closure_status || "—")}</div>
            <div class="exit-block"><div class="exit-block-title">Planned Transition</div>${fmtDate(record.planned_transition_date)}</div>
            <div class="exit-block"><div class="exit-block-title">Actual Transition</div>${fmtDate(record.actual_transition_date)}</div>
            <div class="exit-block full"><div class="exit-block-title">Reason for Ending</div>${esc(record.reason_for_ending || "—")}${record.reason_details ? ` — ${esc(record.reason_details)}` : ""}</div>
            <div class="exit-block full"><div class="exit-block-title">Handover Arrangements</div>${esc(record.handover_arrangements || "—")}</div>
            <div class="exit-block full"><div class="exit-block-title">Outstanding Commitments</div>${esc(record.outstanding_commitments || "—")}</div>
            <div class="exit-block full"><div class="exit-block-title">Sustainability / Continuity</div>${esc(record.sustainability_continuity || "—")}</div>
            <div class="exit-block full"><div class="exit-block-title">Future Relationship</div>${esc(record.future_relationship || "—")}</div>
            <div class="exit-block full"><div class="exit-block-title">Future Relationship Notes</div>${esc(record.future_relationship_notes || "—")}</div>
            <div class="exit-block full">
                <button class="inline-button" data-exit-doc="${record.exit_strategy_id}">Files</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("button[data-exit-doc]").forEach(button => {
        button.onclick = () => openDocumentModal({
            partnership_id: state.partnership.partnership_id,
            context_module: "Exit",
            context_record_id: Number(button.dataset.exitDoc)
        });
    });
}


$("addExitStrategyButton")?.addEventListener("click", () => exitForm());


function exitForm() {
    openModal({
        title: "Add Exit / Closure Record",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group"><label>Planned Transition</label><input id="exPlanned" type="date"></div>
            <div class="form-group"><label>Actual Transition</label><input id="exActual" type="date"></div>
            <div class="form-group"><label>Closure Status</label><select id="exStatus"><option>Planned</option><option>In Progress</option><option>Completed</option></select></div>
            <div class="form-group">
                <label>Reason for Ending</label>
                <select id="exReason">
                    <option>Contract completed</option><option>Funding ended</option><option>Planned end of partnership period</option><option>Strategic transition</option><option>Performance / compliance</option><option>Mutual decision</option><option>Partner decision</option><option>WHH decision</option><option>Other</option>
                </select>
            </div>
            <div id="exOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="exOther"></div>
            <div class="form-group full-field"><label>Reason Details</label><textarea id="exDetails"></textarea></div>
            <div class="form-group checkbox-group"><label><input id="exConsulted" type="checkbox"> Partner consulted</label></div>
            <div class="form-group checkbox-group"><label><input id="exHandover" type="checkbox"> Handover required</label></div>
            <div class="form-group full-field"><label>Handover Arrangements</label><textarea id="exHandoverText"></textarea></div>
            <div class="form-group full-field"><label>Outstanding Commitments</label><textarea id="exCommitments"></textarea></div>
            <div class="form-group full-field"><label>Sustainability / Continuity</label><textarea id="exSustain"></textarea></div>
            <div class="form-group">
                <label>Future Relationship</label>
                <select id="exFuture">
                    <option>Maintain contact</option><option>Potential future partner</option><option>Learning network</option><option>Re-engagement possible</option><option>No planned relationship</option><option>Other</option>
                </select>
            </div>
            <div id="exFutureOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="exFutureOther"></div>
            <div class="form-group full-field"><label>Future Relationship Notes</label><textarea id="exFutureNotes"></textarea></div>
            <div class="form-group full-field"><label>Partner Perspective</label><textarea id="exPartner"></textarea></div>
            <div class="form-group full-field"><label>WHH Reflection / Lessons</label><textarea id="exWhh"></textarea></div>
            <div class="form-group"><label>Approved By</label><input id="exApproved"></div>
        </div>
        `,

        onOpen: () => {
            otherVisible("exReason", "exOtherGroup", "exOther");
            otherVisible("exFuture", "exFutureOtherGroup", "exFutureOther");
        },

        onSave: async () => {
            const reason = $("exReason").value === "Other" ? $("exOther").value.trim() : $("exReason").value;
            const future = $("exFuture").value === "Other" ? $("exFutureOther").value.trim() : $("exFuture").value;
            if (!reason) throw new Error("Please specify the Reason for Ending.");
            if (!future) throw new Error("Please specify the Future Relationship.");

            const { error } = await supabaseClient
                .from("exit_strategies")
                .insert({
                    partnership_id: state.partnership.partnership_id,
                    partner_id: state.partnership.partner_id,
                    planned_transition_date: emptyToNull($("exPlanned").value),
                    actual_transition_date: emptyToNull($("exActual").value),
                    closure_status: $("exStatus").value,
                    reason_for_ending: reason,
                    reason_details: emptyToNull($("exDetails").value),
                    partner_consulted: $("exConsulted").checked,
                    handover_required: $("exHandover").checked,
                    handover_arrangements: emptyToNull($("exHandoverText").value),
                    outstanding_commitments: emptyToNull($("exCommitments").value),
                    sustainability_continuity: emptyToNull($("exSustain").value),
                    future_relationship: future,
                    future_relationship_notes: emptyToNull($("exFutureNotes").value),
                    partner_perspective: emptyToNull($("exPartner").value),
                    whh_reflection: emptyToNull($("exWhh").value),
                    lessons_learned: emptyToNull($("exWhh").value),
                    closure_approved_by: emptyToNull($("exApproved").value)
                });

            if (error) throw error;
            await loadExit();
        }
    });
}


// ============================================================
// DOCUMENTS
// ============================================================

async function loadDocuments(context, container, useFilters = false) {
    if (!container) return;
    container.textContent = "Loading...";

    let query = supabaseClient
        .from("partnership_documents")
        .select("*");

    Object.entries(context).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            query = query.eq(key, value);
        }
    });

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
        container.textContent = error.message;
        return;
    }

    let rows = data || [];

    if (useFilters) {
        const module = $("documentModuleFilter")?.value || "";
        const search = $("documentSearch")?.value.trim().toLowerCase() || "";

        if (module) {
            rows = rows.filter(row => String(row.context_module || "") === module);
        }

        if (search) {
            rows = rows.filter(row => [
                row.document_title,
                row.document_type,
                row.original_file_name,
                row.notes
            ].some(value => String(value || "").toLowerCase().includes(search)));
        }
    }

    if (!rows.length) {
        container.innerHTML = `<span class="empty-text">No documents uploaded.</span>`;
        return;
    }

    container.innerHTML = `
        <div class="document-list">
            ${rows.map(document => `
                <div class="document-row">
                    <div>
                        <div class="document-title">${esc(document.document_title)}</div>
                        <div class="document-meta">${esc(document.original_file_name || "")}</div>
                    </div>
                    <div>${esc(document.document_type || "")}</div>
                    <div>${esc(document.context_module || "")}</div>
                    <div>${fmtDate(document.created_at?.slice(0, 10))}</div>
                    <div class="document-action">
                        <button class="inline-button" data-open="${esc(document.storage_path)}">Open</button>
                    </div>
                </div>
            `).join("")}
        </div>
    `;

    container.querySelectorAll("button[data-open]").forEach(button => {
        button.onclick = () => openStoredDocument(button.dataset.open);
    });
}


async function openStoredDocument(path) {
    const { data, error } = await supabaseClient
        .storage
        .from("partnership-documents")
        .createSignedUrl(path, 60);

    if (error) {
        toast(error.message);
        return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}


function openDocumentModal(context) {
    openModal({
        title: "Upload Document",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group full-field"><label>Document Title *</label><input id="dcTitle" required></div>
            <div class="form-group">
                <label>Document Type</label>
                <select id="dcType">
                    <option>Agreement / MoU</option><option>Contract</option><option>Capacity Assessment</option><option>Capacity Support Evidence</option><option>Equity Review</option><option>Feedback Evidence</option><option>Meeting Minutes</option><option>Attendance Sheet</option><option>Action Evidence</option><option>Success Story Evidence</option><option>Photo / Media</option><option>Exit / Handover</option><option>Project Document</option><option>Registration / Legal</option><option>Other</option>
                </select>
            </div>
            <div id="dcOtherGroup" class="form-group hidden"><label>Please specify *</label><input id="dcOther"></div>
            <div class="form-group full-field">
                <label>File *</label>
                <div class="file-input-wrapper"><input id="dcFile" type="file" required></div>
            </div>
            <div class="form-group full-field"><label>Notes</label><textarea id="dcNotes"></textarea></div>
        </div>
        `,

        onOpen: () => otherVisible("dcType", "dcOtherGroup", "dcOther"),

        onSave: async () => {
            const file = $("dcFile").files[0];
            if (!file) throw new Error("Choose a file.");
            if (file.size > 20 * 1024 * 1024) throw new Error("File exceeds 20 MB.");

            const documentType = $("dcType").value === "Other"
                ? $("dcOther").value.trim()
                : $("dcType").value;
            if (!documentType) throw new Error("Please specify the Document Type.");

            const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const contextId = context.partnership_id || context.partner_id || context.project_id || "general";
            const storagePath = `${contextId}/${Date.now()}_${safeFileName}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from("partnership-documents")
                .upload(storagePath, file, { upsert: false });

            if (uploadError) throw uploadError;

            const payload = {
                partner_id: context.partner_id ?? null,
                project_id: context.project_id ?? null,
                partnership_id: context.partnership_id ?? null,
                context_module: context.context_module ?? null,
                context_record_id: context.context_record_id ?? null,
                document_title: $("dcTitle").value.trim(),
                document_type: documentType,
                storage_path: storagePath,
                original_file_name: file.name,
                mime_type: file.type || null,
                file_size_bytes: file.size,
                notes: emptyToNull($("dcNotes").value)
            };

            const { error } = await supabaseClient
                .from("partnership_documents")
                .insert(payload);

            if (error) {
                await supabaseClient.storage.from("partnership-documents").remove([storagePath]);
                throw error;
            }

            toast("Document uploaded.");

            if (context.partnership_id && $("partnershipDocumentsContainer")) {
                await loadDocuments(
                    { partnership_id: context.partnership_id },
                    $("partnershipDocumentsContainer"),
                    true
                );
            } else if (context.partner_id && $("partnerDocumentsContainer")) {
                await loadDocuments(
                    { partner_id: context.partner_id },
                    $("partnerDocumentsContainer")
                );
            } else if (context.project_id && $("projectDocumentsContainer")) {
                await loadDocuments(
                    { project_id: context.project_id },
                    $("projectDocumentsContainer")
                );
            }
        }
    });
}


$("uploadPartnerDocumentButton")?.addEventListener("click", () => openDocumentModal({
    partner_id: state.partner.partner_id,
    context_module: "Partner"
}));


$("uploadPartnershipDocumentButton")?.addEventListener("click", () => openDocumentModal({
    partnership_id: state.partnership.partnership_id,
    context_module: "Partnership"
}));


$("uploadProjectDocumentButton")?.addEventListener("click", () => openDocumentModal({
    project_id: state.project.project_id,
    context_module: "Project"
}));


$("documentModuleFilter")?.addEventListener("change", () => {
    if (!state.partnership) return;
    loadDocuments(
        { partnership_id: state.partnership.partnership_id },
        $("partnershipDocumentsContainer"),
        true
    );
});


$("documentSearch")?.addEventListener("input", () => {
    if (!state.partnership) return;
    loadDocuments(
        { partnership_id: state.partnership.partnership_id },
        $("partnershipDocumentsContainer"),
        true
    );
});


// ============================================================
// PROJECT LIST
// ============================================================

async function loadProjects(
    search = ""
) {

    const body =
        $("projectTableBody");


    emptyRow(
        body,
        6,
        "Loading..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "projects"
            )
            .select("*")
            .order(
                "project_code"
            );


    if (error) {

        emptyRow(
            body,
            6,
            error.message
        );

        return;
    }


    let rows =
        data || [];


    if (
        search.trim()
    ) {

        const searchText =
            search
                .trim()
                .toLowerCase();


        rows =
            rows.filter(
                project =>
                    String(
                        project.project_code
                        ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            searchText
                        )
                    ||
                    String(
                        project.project_name
                        ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            searchText
                        )
            );
    }


    state.projectRows =
        rows;


    if (
        !rows.length
    ) {

        emptyRow(
            body,
            6,
            "No projects found."
        );

        return;
    }


    body.innerHTML =
        rows
            .map(
                project =>
                    `
                    <tr
                        class="clickable-row"
                        data-id="${project.project_id}"
                    >

                        <td>
                            ${esc(project.project_code || "")}
                        </td>

                        <td>
                            <span class="table-link">
                                ${esc(project.project_name || "")}
                            </span>
                        </td>

                        <td>
                            ${
                                statusBadge(
                                    lookupName(
                                        "project_statuses",
                                        "project_status_id",
                                        "project_status_name",
                                        project.project_status_id
                                    )
                                )
                            }
                        </td>

                        <td>
                            ${
                                esc(
                                    categoryLabel(lookupName(
                                        "intervention_types",
                                        "intervention_type_id",
                                        "intervention_type_name",
                                        project.intervention_type_id
                                    ), project.intervention_type_other)
                                )
                            }
                        </td>

                        <td>
                            ${fmtDate(project.start_date)}
                        </td>

                        <td>
                            ${fmtDate(project.end_date)}
                        </td>

                    </tr>
                    `
            )
            .join("");


    body
        .querySelectorAll(
            "tr[data-id]"
        )
        .forEach(
            row => {

                row.onclick =
                    () =>
                        openProject(
                            Number(
                                row.dataset.id
                            )
                        );
            }
        );
}


$("projectSearch")
    ?.addEventListener(
        "input",
        event =>
            loadProjects(
                event.target.value
            )
    );


async function openProject(id) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "projects"
            )
            .select("*")
            .eq(
                "project_id",
                id
            )
            .single();


    if (error) {

        toast(
            error.message
        );

        return;
    }


    state.project =
        data;


    showWorkspace(
        "projectProfile"
    );


    setText(
        "projectProfileName",
        data.project_name
    );


    setText(
        "projectProfileCode",
        data.project_code
    );


    switchTabs(
        projectTabs,
        "overview"
    );


    await renderProjectOverview();
}


async function renderProjectOverview() {

    const project =
        state.project;


    const container =
        $("projectOverviewTabContent");


    if (!container) {
        return;
    }


    container.innerHTML =
        `
        <div class="section-panel">

            <div class="section-title-row">

                <h3>
                    Project Overview
                </h3>


                ${
                    isAdmin()
                        ?
                        `
                        <button
                            id="editProjectInline"
                            class="primary-button small-button"
                        >
                            Edit Project
                        </button>
                        `
                        :
                        ""
                }

            </div>


            <div class="detail-grid">

                <div class="detail-item">

                    <span class="detail-label">
                        Code
                    </span>

                    ${esc(project.project_code || "—")}

                </div>


                <div class="detail-item">

                    <span class="detail-label">
                        Status
                    </span>

                    ${
                        esc(
                            lookupName(
                                "project_statuses",
                                "project_status_id",
                                "project_status_name",
                                project.project_status_id
                            )
                            ||
                            "—"
                        )
                    }

                </div>


                <div class="detail-item">

                    <span class="detail-label">
                        Intervention
                    </span>

                    ${
                        esc(
                            categoryLabel(lookupName(
                                "intervention_types",
                                "intervention_type_id",
                                "intervention_type_name",
                                project.intervention_type_id
                            ), project.intervention_type_other)
                            ||
                            "—"
                        )
                    }

                </div>


                <div class="detail-item">

                    <span class="detail-label">
                        Start
                    </span>

                    ${fmtDate(project.start_date)}

                </div>


                <div class="detail-item">

                    <span class="detail-label">
                        End
                    </span>

                    ${fmtDate(project.end_date)}

                </div>


                <div class="detail-item">

                    <span class="detail-label">
                        Co-designed
                    </span>

                    ${boolText(project.is_co_designed)}

                </div>


                <div class="detail-item full-width-detail">

                    <span class="detail-label">
                        Description
                    </span>

                    ${esc(project.project_description || "—")}

                </div>

            </div>

        </div>
        `;


    $("editProjectInline")
        ?.addEventListener(
            "click",
            () =>
                projectForm(
                    project
                )
        );
}


$("addProjectButton")
    ?.addEventListener(
        "click",
        () =>
            projectForm()
    );


function projectForm(
    record = null
) {

    openModal({

        title:
            record
                ? "Edit Project"
                : "Add Project",

        large:
            true,


        body:
        `
        <div class="form-grid">

            <div class="form-group">

                <label>
                    Project Code *
                </label>

                <input
                    id="prCode"
                    required
                    value="${esc(record?.project_code || "")}"
                >

            </div>


            <div class="form-group full-field">

                <label>
                    Project Name *
                </label>

                <input
                    id="prName"
                    required
                    value="${esc(record?.project_name || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    Status
                </label>

                <select id="prStatus">

                    ${
                        optionHtml(
                            state.lookups.project_statuses
                            || [],
                            "project_status_id",
                            "project_status_name",
                            record?.project_status_id,
                            "Select status"
                        )
                    }

                </select>

            </div>


            <div class="form-group">

                <label>
                    Intervention Type
                </label>

                <select id="prIntervention">

                    ${
                        optionHtml(
                            state.lookups.intervention_types
                            || [],
                            "intervention_type_id",
                            "intervention_type_name",
                            record?.intervention_type_id,
                            "Select type"
                        )
                    }

                </select>

            </div>


            <div class="form-group">

                <label>
                    Start Date
                </label>

                <input
                    id="prStart"
                    type="date"
                    value="${esc(record?.start_date || "")}"
                >

            </div>


            <div class="form-group">

                <label>
                    End Date
                </label>

                <input
                    id="prEnd"
                    type="date"
                    value="${esc(record?.end_date || "")}"
                >

            </div>


            <div class="form-group checkbox-group">

                <label>

                    <input
                        id="prCo"
                        type="checkbox"
                        ${
                            record?.is_co_designed
                                ? "checked"
                                : ""
                        }
                    >

                    Co-designed

                </label>

            </div>


            <div class="form-group full-field">

                <label>
                    Description
                </label>

                <textarea id="prDesc">${esc(record?.project_description || "")}</textarea>

            </div>

        </div>
        `,


        onSave:
            async () => {

                const saved =
                    await upsertRecord(
                        "projects",
                        {

                            project_code:
                                $("prCode")
                                    .value
                                    .trim(),

                            project_name:
                                $("prName")
                                    .value
                                    .trim(),

                            project_status_id:
                                numOrNull(
                                    $("prStatus").value
                                ),

                            intervention_type_id:
                                numOrNull(
                                    $("prIntervention").value
                                ),
                intervention_type_other: categoryOtherValue("prIntervention", "prInterventionOther"),

                            start_date:
                                emptyToNull(
                                    $("prStart").value
                                ),

                            end_date:
                                emptyToNull(
                                    $("prEnd").value
                                ),

                            is_co_designed:
                                $("prCo").checked,

                            project_description:
                                emptyToNull(
                                    $("prDesc").value
                                )
                        },
                        "project_id",
                        record?.project_id
                    );


                toast(
                    "Project saved."
                );


                await openProject(
                    saved.project_id
                );
            }
    });
}


// ============================================================
// PROJECT PARTNERSHIPS
// ============================================================

async function loadProjectPartners() {

    const container =
        $("projectPartnersTabContent");


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "partnership_projects"
            )
            .select("*")
            .eq(
                "project_id",
                state.project.project_id
            );


    if (error) {

        container.textContent =
            error.message;

        return;
    }


    const partnerships =
        await safeSelect(
            "partnerships"
        );


    const partners =
        await safeSelect(
            "partners",
            "partner_id,partner_name"
        );


    const partnershipMap =
        Object.fromEntries(
            partnerships.map(
                partnership => [
                    partnership.partnership_id,
                    partnership
                ]
            )
        );


    const partnerMap =
        Object.fromEntries(
            partners.map(
                partner => [
                    partner.partner_id,
                    partner
                ]
            )
        );


    container.innerHTML =
        `
        <div class="section-panel">

            <div class="section-title-row">
                <h3>
                    Partnership Context
                </h3>
            </div>


            <div class="table-panel flat">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>
                                Partner
                            </th>

                            <th>
                                Partnership
                            </th>

                            <th>
                                Notes
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            data?.length
                                ?
                                data
                                    .map(
                                        record => {

                                            const partnership =
                                                partnershipMap[
                                                    record.partnership_id
                                                ]
                                                ||
                                                {};


                                            return `
                                                <tr>

                                                    <td>
                                                        ${
                                                            esc(
                                                                partnerMap[
                                                                    partnership.partner_id
                                                                ]?.partner_name
                                                                ||
                                                                ""
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        ${esc(partnership.partnership_title || "")}
                                                    </td>

                                                    <td>
                                                        ${esc(record.relationship_notes || "")}
                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    )
                                    .join("")
                                :
                                `
                                <tr>
                                    <td colspan="3">
                                        No linked partnerships.
                                    </td>
                                </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        </div>
        `;
}


// ============================================================
// PROJECT SECTORS
// ============================================================

async function loadProjectSectors() {

    const container =
        $("projectSectorsTabContent");


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "project_sectors"
            )
            .select("*")
            .eq(
                "project_id",
                state.project.project_id
            );


    if (error) {

        container.textContent =
            error.message;

        return;
    }


    container.innerHTML =
        `
        <div class="section-panel">

            <div class="section-title-row">

                <h3>
                    Sectors
                </h3>


                ${
                    isAdmin()
                        ?
                        `
                        <button
                            id="addSectorBtn"
                            class="primary-button small-button"
                        >
                            Add Sector
                        </button>
                        `
                        :
                        ""
                }

            </div>


            <div class="table-panel flat">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>
                                Sector
                            </th>

                            <th>
                                Weight %
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            data?.length
                                ?
                                data
                                    .map(
                                        record => {

                                            const standard =
                                                lookupName(
                                                    "sectors",
                                                    "sector_id",
                                                    "sector_name",
                                                    record.sector_id
                                                );


                                            const sector =
                                                (
                                                    standard
                                                        .toLowerCase()
                                                    ===
                                                    "other"
                                                    &&
                                                    record.sector_other
                                                )
                                                    ?
                                                    record.sector_other
                                                    :
                                                    standard;


                                            return `
                                                <tr>

                                                    <td>
                                                        ${esc(sector)}
                                                    </td>

                                                    <td>
                                                        ${esc(record.weight_percentage ?? "")}
                                                    </td>

                                                </tr>
                                            `;
                                        }
                                    )
                                    .join("")
                                :
                                `
                                <tr>
                                    <td colspan="2">
                                        No sectors.
                                    </td>
                                </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        </div>
        `;


    $("addSectorBtn")
        ?.addEventListener(
            "click",
            () => {

                openModal({

                    title:
                        "Add Project Sector",


                    body:
                    `
                    <div class="form-grid">

                        <div class="form-group">

                            <label>
                                Sector *
                            </label>

                            <select
                                id="secId"
                                required
                            >

                                ${
                                    optionHtml(
                                        state.lookups.sectors
                                        || [],
                                        "sector_id",
                                        "sector_name",
                                        null,
                                        "Select sector"
                                    )
                                }

                            </select>

                        </div>


                        <div
                            id="secOtherGroup"
                            class="form-group hidden"
                        >

                            <label>
                                Please specify *
                            </label>

                            <input id="secOther">

                        </div>


                        <div class="form-group">

                            <label>
                                Weight %
                            </label>

                            <input
                                id="secWeight"
                                type="number"
                                min="0"
                                max="100"
                            >

                        </div>

                    </div>
                    `,


                    onOpen:
                        () =>
                            otherVisible(
                                "secId",
                                "secOtherGroup",
                                "secOther"
                            ),


                    onSave:
                        async () => {

                            const isOther =
                                $("secId")
                                    .options[
                                        $("secId")
                                            .selectedIndex
                                    ]
                                    ?.textContent
                                    ?.trim()
                                    .toLowerCase()
                                ===
                                "other";


                            const {
                                error
                            } =
                                await supabaseClient
                                    .from(
                                        "project_sectors"
                                    )
                                    .insert({

                                        project_id:
                                            state.project.project_id,

                                        sector_id:
                                            Number(
                                                $("secId").value
                                            ),

                                        sector_other:
                                            isOther
                                                ?
                                                emptyToNull(
                                                    $("secOther").value
                                                )
                                                :
                                                null,

                                        weight_percentage:
                                            numOrNull(
                                                $("secWeight").value
                                            )
                                    });


                            if (error) {
                                throw error;
                            }


                            await loadProjectSectors();
                        }
                });
            }
        );
}


// ============================================================
// PROJECT LOCATIONS
// ============================================================

async function loadProjectLocations() {
    const container = $("projectLocationsTabContent");

    const { data, error } = await supabaseClient
        .from("project_locations")
        .select("project_location_id,project_id,location_id")
        .eq("project_id", state.project.project_id);

    if (error) {
        container.textContent = error.message;
        return;
    }

    const locations = await safeSelect(
        "locations",
        "location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom"
    );
    const locationMap = Object.fromEntries(locations.map(location => [location.location_id, location]));

    container.innerHTML = `
        <div class="section-panel">
            <div class="section-title-row">
                <h3>Locations</h3>
                ${isAdmin() ? `<button id="addLocationBtn" class="primary-button small-button">Add Location</button>` : ""}
            </div>

            <div class="table-panel flat">
                <table class="data-table">
                    <thead><tr><th>Administrative Path</th><th>Level</th></tr></thead>
                    <tbody>
                        ${data?.length ? data.map(record => {
                            const location = locationMap[record.location_id];
                            return `
                                <tr>
                                    <td>${esc(buildLocationPath(record.location_id, locationMap) || location?.location_name || "")}</td>
                                    <td>${esc(locationTypeNameById(location?.location_type_id) || "")}</td>
                                </tr>
                            `;
                        }).join("") : `<tr><td colspan="2">No locations.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    $("addLocationBtn")?.addEventListener("click", () => locationForm(locations));
}


function locationForm(locations) {
    const REGION_OTHER = "__OTHER_REGION__";
    const ZONE_OTHER = "__OTHER_ZONE__";
    const WOREDA_OTHER = "__OTHER_WOREDA__";

    const regionTypeId = locationTypeId("Region");
    const zoneTypeId = locationTypeId("Zone");
    const woredaTypeId = locationTypeId("Woreda");

    // Use the official v04 Admin-1 rows from the uploaded Ethiopia boundary workbook.
    // This deliberately excludes legacy rows such as Ethiopia from lower-level dropdowns.
    const regions = locations
        .filter(location =>
            Number(location.location_type_id) === Number(regionTypeId) &&
            isOfficialAdminLocation(location) &&
            /^ET\d{2}$/.test(String(location.admin_pcode || ""))
        )
        .sort((a, b) => String(a.location_name).localeCompare(String(b.location_name)));

    openModal({
        title: "Add Project Location",
        large: true,
        body: `
        <div class="form-grid">
            <div class="form-group"><label>Country</label><input value="Ethiopia" disabled></div>

            <div class="form-group">
                <label>Region *</label>
                <select id="locRegion" required>
                    ${optionHtml(regions, "location_id", "location_name", null, "Select region")}
                    <option value="${REGION_OTHER}">Other</option>
                </select>
            </div>
            <div id="locRegionOtherGroup" class="form-group hidden"><label>Specify Region *</label><input id="locRegionOther"></div>

            <div class="form-group">
                <label>Zone</label>
                <select id="locZone" disabled><option value="">Select zone</option></select>
            </div>
            <div id="locZoneOtherGroup" class="form-group hidden"><label>Specify Zone *</label><input id="locZoneOther"></div>

            <div class="form-group">
                <label>Woreda</label>
                <select id="locWoreda" disabled><option value="">Select woreda</option></select>
            </div>
            <div id="locWoredaOtherGroup" class="form-group hidden"><label>Specify Woreda *</label><input id="locWoredaOther"></div>

            <div class="form-group full-field">
                <label>Kebele / Specific Place</label>
                <input id="locKebele" disabled placeholder="Enter kebele after selecting/specifying a woreda">
            </div>

        </div>
        `,

        onOpen: () => {
            const region = $("locRegion");
            const zone = $("locZone");
            const woreda = $("locWoreda");
            const kebele = $("locKebele");

            const setOtherGroup = (groupId, inputId, visible, required = visible) => {
                $(groupId)?.classList.toggle("hidden", !visible);
                if ($(inputId)) $(inputId).required = required;
                if (!visible && $(inputId)) $(inputId).value = "";
            };

            const updatePreview = () => {};

            const fillWoredas = () => {
                const zoneValue = zone.value;

                if (!zoneValue) {
                    woreda.innerHTML = `<option value="">Select woreda</option>`;
                    woreda.disabled = true;
                    setOtherGroup("locWoredaOtherGroup", "locWoredaOther", false);
                    kebele.disabled = true;
                    kebele.value = "";
                    updatePreview();
                    return;
                }

                if (zoneValue === ZONE_OTHER) {
                    woreda.innerHTML = `
                        <option value="">No woreda / zone-level only</option>
                        <option value="${WOREDA_OTHER}">Other</option>
                    `;
                    woreda.disabled = false;
                    woreda.value = WOREDA_OTHER;
                    setOtherGroup("locWoredaOtherGroup", "locWoredaOther", true);
                    kebele.disabled = false;
                    updatePreview();
                    return;
                }

                const zoneId = Number(zoneValue);
                const rows = locations
                    .filter(location =>
                        Number(location.parent_location_id) === zoneId &&
                        Number(location.location_type_id) === Number(woredaTypeId) &&
                        (location.is_custom || isOfficialAdminLocation(location))
                    )
                    .sort((a, b) => String(a.location_name).localeCompare(String(b.location_name)));

                woreda.innerHTML = optionHtml(rows, "location_id", "location_name", null, "Select woreda") +
                    `<option value="${WOREDA_OTHER}">Other</option>`;
                woreda.disabled = false;
                setOtherGroup("locWoredaOtherGroup", "locWoredaOther", false);
                kebele.disabled = true;
                kebele.value = "";
                updatePreview();
            };

            const fillZones = () => {
                const regionValue = region.value;

                if (!regionValue) {
                    zone.innerHTML = `<option value="">Select zone</option>`;
                    zone.disabled = true;
                    woreda.innerHTML = `<option value="">Select woreda</option>`;
                    woreda.disabled = true;
                    setOtherGroup("locRegionOtherGroup", "locRegionOther", false);
                    setOtherGroup("locZoneOtherGroup", "locZoneOther", false);
                    setOtherGroup("locWoredaOtherGroup", "locWoredaOther", false);
                    kebele.disabled = true;
                    kebele.value = "";
                    updatePreview();
                    return;
                }

                if (regionValue === REGION_OTHER) {
                    setOtherGroup("locRegionOtherGroup", "locRegionOther", true);
                    zone.innerHTML = `
                        <option value="">No zone / region-level only</option>
                        <option value="${ZONE_OTHER}">Other</option>
                    `;
                    zone.disabled = false;
                    zone.value = ZONE_OTHER;
                    setOtherGroup("locZoneOtherGroup", "locZoneOther", true);
                    fillWoredas();
                    updatePreview();
                    return;
                }

                setOtherGroup("locRegionOtherGroup", "locRegionOther", false);
                const regionId = Number(regionValue);
                const rows = locations
                    .filter(location =>
                        Number(location.parent_location_id) === regionId &&
                        Number(location.location_type_id) === Number(zoneTypeId) &&
                        (location.is_custom || isOfficialAdminLocation(location))
                    )
                    .sort((a, b) => String(a.location_name).localeCompare(String(b.location_name)));

                zone.innerHTML = optionHtml(rows, "location_id", "location_name", null, "Select zone") +
                    `<option value="${ZONE_OTHER}">Other</option>`;
                zone.disabled = false;
                setOtherGroup("locZoneOtherGroup", "locZoneOther", false);
                woreda.innerHTML = `<option value="">Select woreda</option>`;
                woreda.disabled = true;
                setOtherGroup("locWoredaOtherGroup", "locWoredaOther", false);
                kebele.disabled = true;
                kebele.value = "";
                updatePreview();
            };

            const zoneChanged = () => {
                setOtherGroup("locZoneOtherGroup", "locZoneOther", zone.value === ZONE_OTHER);
                fillWoredas();
                updatePreview();
            };

            const woredaChanged = () => {
                setOtherGroup("locWoredaOtherGroup", "locWoredaOther", woreda.value === WOREDA_OTHER);
                kebele.disabled = !woreda.value;
                if (kebele.disabled) kebele.value = "";
                updatePreview();
            };

            region.onchange = fillZones;
            zone.onchange = zoneChanged;
            woreda.onchange = woredaChanged;

            ["locRegionOther", "locZoneOther", "locWoredaOther", "locKebele"].forEach(id => {
                $(id)?.addEventListener("input", updatePreview);
            });

            fillZones();
        },

        onSave: async () => {
            const regionValue = $("locRegion").value;
            if (!regionValue) throw new Error("Select a Region.");

            let regionId;
            if (regionValue === REGION_OTHER) {
                const customRegion = $("locRegionOther").value.trim();
                if (!customRegion) throw new Error("Please specify the Region.");

                const country = locations.find(location =>
                    locationTypeNameById(location.location_type_id) === "Country" &&
                    String(location.admin_pcode || "") === "ET"
                );

                const row = await createOrReuseCustomLocation(customRegion, "Region", country?.location_id ?? null);
                regionId = row.location_id;
            } else {
                regionId = Number(regionValue);
            }

            let zoneId = null;
            const zoneValue = $("locZone").value;
            if (zoneValue === ZONE_OTHER) {
                const customZone = $("locZoneOther").value.trim();
                if (!customZone) throw new Error("Please specify the Zone.");
                const row = await createOrReuseCustomLocation(customZone, "Zone", regionId);
                zoneId = row.location_id;
            } else if (zoneValue) {
                zoneId = Number(zoneValue);
            }

            let woredaId = null;
            const woredaValue = $("locWoreda").value;
            if (woredaValue === WOREDA_OTHER) {
                const customWoreda = $("locWoredaOther").value.trim();
                if (!customWoreda) throw new Error("Please specify the Woreda.");
                if (!zoneId) throw new Error("A Woreda must belong to a Zone.");
                const row = await createOrReuseCustomLocation(customWoreda, "Woreda", zoneId);
                woredaId = row.location_id;
            } else if (woredaValue) {
                woredaId = Number(woredaValue);
            }

            let finalLocationId = woredaId || zoneId || regionId;

            const kebeleName = $("locKebele").value.trim();
            if (kebeleName) {
                if (!woredaId) {
                    throw new Error("Select or specify a Woreda before entering a Kebele / Specific Place.");
                }
                const kebele = await createOrReuseCustomLocation(kebeleName, "Kebele", woredaId);
                finalLocationId = kebele.location_id;
            }

            const { error } = await supabaseClient
                .from("project_locations")
                .insert({
                    project_id: state.project.project_id,
                    location_id: finalLocationId
                });

            if (error) {
                if (String(error.code) === "23505") {
                    throw new Error("This location is already linked to the project.");
                }
                throw error;
            }

            await loadProjectLocations();
        }
    });
}


// ============================================================
// PROJECT BUDGETS
// ============================================================

async function loadProjectBudgets() {

    const container =
        $("projectBudgetsTabContent");


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "project_budgets"
            )
            .select("*")
            .eq(
                "project_id",
                state.project.project_id
            );


    if (error) {

        container.textContent =
            error.message;

        return;
    }


    container.innerHTML =
        `
        <div class="section-panel">

            <div class="section-title-row">

                <h3>
                    Budgets
                </h3>


                ${
                    isAdmin()
                        ?
                        `
                        <button
                            id="addBudgetBtn"
                            class="primary-button small-button"
                        >
                            Add Budget
                        </button>
                        `
                        :
                        ""
                }

            </div>


            <div class="table-panel flat">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>
                                Year
                            </th>

                            <th>
                                Type
                            </th>

                            <th>
                                Amount
                            </th>

                            <th>
                                Currency
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            data?.length
                                ?
                                data
                                    .map(
                                        budget =>
                                            `
                                            <tr>

                                                <td>
                                                    ${esc(budget.budget_year || "")}
                                                </td>

                                                <td>
                                                    ${
                                                        esc(
                                                            categoryLabel(lookupName(
                                                                "budget_types",
                                                                "budget_type_id",
                                                                "budget_type_name",
                                                                budget.budget_type_id
                                                            ), budget.budget_type_other)
                                                            ||
                                                            budget.budget_type
                                                            ||
                                                            ""
                                                        )
                                                    }
                                                </td>

                                                <td>
                                                    ${
                                                        fmtNumber(
                                                            budget.amount
                                                            ||
                                                            budget.budget_amount
                                                        )
                                                    }
                                                </td>

                                                <td>
                                                    ${esc(budget.currency || "")}
                                                </td>

                                            </tr>
                                            `
                                    )
                                    .join("")
                                :
                                `
                                <tr>
                                    <td colspan="4">
                                        No budgets.
                                    </td>
                                </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        </div>
        `;


    $("addBudgetBtn")
        ?.addEventListener(
            "click",
            () => {

                openModal({

                    title:
                        "Add Project Budget",


                    body:
                    `
                    <div class="form-grid">

                        <div class="form-group">

                            <label>
                                Year
                            </label>

                            <input
                                id="buYear"
                                type="number"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Budget Type
                            </label>

                            <select id="buType">

                                ${
                                    optionHtml(
                                        state.lookups.budget_types
                                        || [],
                                        "budget_type_id",
                                        "budget_type_name",
                                        null,
                                        "Select type"
                                    )
                                }

                            </select>

                        </div>


                        <div class="form-group">

                            <label>
                                Amount *
                            </label>

                            <input
                                id="buAmount"
                                type="number"
                                step="0.01"
                                required
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Currency
                            </label>

                            <input
                                id="buCurrency"
                                value="EUR"
                            >

                        </div>

                    </div>
                    `,


                    onSave:
                        async () => {

                            const {
                                error
                            } =
                                await supabaseClient
                                    .from(
                                        "project_budgets"
                                    )
                                    .insert({

                                        project_id:
                                            state.project.project_id,

                                        budget_year:
                                            numOrNull(
                                                $("buYear").value
                                            ),

                                        budget_type_id:
                                            numOrNull(
                                                $("buType").value
                                            ),
                budget_type_other: categoryOtherValue("buType", "buTypeOther"),

                                        amount:
                                            Number(
                                                $("buAmount").value
                                            ),

                                        currency:
                                            emptyToNull(
                                                $("buCurrency").value
                                            )
                                            ||
                                            "EUR"
                                    });


                            if (error) {
                                throw error;
                            }


                            await loadProjectBudgets();
                        }
                });
            }
        );
}


// ============================================================
// PROJECT PARTICIPANTS
// ============================================================

async function loadProjectParticipants() {

    const container =
        $("projectParticipantsTabContent");


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "project_participants"
            )
            .select("*")
            .eq(
                "project_id",
                state.project.project_id
            )
            .order(
                "reporting_year"
            );


    if (error) {

        container.textContent =
            error.message;

        return;
    }


    function total(
        record
    ) {

        return [
            record.female_u18,
            record.female_over18,
            record.male_u18,
            record.male_over18
        ]
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum
                    +
                    (
                        Number(value)
                        ||
                        0
                    ),
                0
            );
    }


    function pwdTotal(
        record
    ) {

        return [
            record.pwd_female_u18,
            record.pwd_female_over18,
            record.pwd_male_u18,
            record.pwd_male_over18
        ]
            .reduce(
                (
                    sum,
                    value
                ) =>
                    sum
                    +
                    (
                        Number(value)
                        ||
                        0
                    ),
                0
            );
    }


    container.innerHTML =
        `
        <div class="section-panel">

            <div class="section-title-row">

                <h3>
                    Participants
                </h3>


                ${
                    isAdmin()
                        ?
                        `
                        <button
                            id="addParticipantBtn"
                            class="primary-button small-button"
                        >
                            Add Participants
                        </button>
                        `
                        :
                        ""
                }

            </div>


            <div class="table-panel flat">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>
                                Year
                            </th>

                            <th>
                                Female &lt;18
                            </th>

                            <th>
                                Female 18+
                            </th>

                            <th>
                                Male &lt;18
                            </th>

                            <th>
                                Male 18+
                            </th>

                            <th>
                                Total
                            </th>

                            <th>
                                PWD subset
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${
                            data?.length
                                ?
                                data
                                    .map(
                                        record =>
                                            `
                                            <tr>

                                                <td>
                                                    ${esc(record.reporting_year || "")}
                                                </td>

                                                <td>
                                                    ${record.female_u18 || 0}
                                                </td>

                                                <td>
                                                    ${record.female_over18 || 0}
                                                </td>

                                                <td>
                                                    ${record.male_u18 || 0}
                                                </td>

                                                <td>
                                                    ${record.male_over18 || 0}
                                                </td>

                                                <td>
                                                    ${total(record)}
                                                </td>

                                                <td>
                                                    ${pwdTotal(record)}
                                                </td>

                                            </tr>
                                            `
                                    )
                                    .join("")
                                :
                                `
                                <tr>
                                    <td colspan="7">
                                        No participant records.
                                    </td>
                                </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        </div>
        `;


    $("addParticipantBtn")
        ?.addEventListener(
            "click",
            () =>
                participantForm()
        );
}


function participantForm() {

    const fields = [

        [
            "Female <18",
            "paFU18"
        ],

        [
            "Female 18+",
            "paFO18"
        ],

        [
            "Male <18",
            "paMU18"
        ],

        [
            "Male 18+",
            "paMO18"
        ],

        [
            "PWD Female <18",
            "paPFU18"
        ],

        [
            "PWD Female 18+",
            "paPFO18"
        ],

        [
            "PWD Male <18",
            "paPMU18"
        ],

        [
            "PWD Male 18+",
            "paPMO18"
        ]
    ];


    openModal({

        title:
            "Add Participant Record",

        large:
            true,


        body:
        `
        <div class="form-grid">

            <div class="form-group">

                <label>
                    Reporting Year *
                </label>

                <input
                    id="paYear"
                    type="number"
                    required
                >

            </div>


            ${
                fields
                    .map(
                        ([
                            label,
                            id
                        ]) =>
                            `
                            <div class="form-group">

                                <label>
                                    ${label}
                                </label>

                                <input
                                    id="${id}"
                                    type="number"
                                    min="0"
                                    value="0"
                                >

                            </div>
                            `
                    )
                    .join("")
            }

        </div>
        `,


        onSave:
            async () => {

                const payload = {

                    project_id:
                        state.project.project_id,

                    reporting_year:
                        Number(
                            $("paYear").value
                        ),

                    female_u18:
                        Number(
                            $("paFU18").value
                            ||
                            0
                        ),

                    female_over18:
                        Number(
                            $("paFO18").value
                            ||
                            0
                        ),

                    male_u18:
                        Number(
                            $("paMU18").value
                            ||
                            0
                        ),

                    male_over18:
                        Number(
                            $("paMO18").value
                            ||
                            0
                        ),

                    pwd_female_u18:
                        Number(
                            $("paPFU18").value
                            ||
                            0
                        ),

                    pwd_female_over18:
                        Number(
                            $("paPFO18").value
                            ||
                            0
                        ),

                    pwd_male_u18:
                        Number(
                            $("paPMU18").value
                            ||
                            0
                        ),

                    pwd_male_over18:
                        Number(
                            $("paPMO18").value
                            ||
                            0
                        ),

                    total_participants:
                        null,

                    notes:
                        null
                };


                if (
                    payload.pwd_female_u18
                    >
                    payload.female_u18
                    ||
                    payload.pwd_female_over18
                    >
                    payload.female_over18
                    ||
                    payload.pwd_male_u18
                    >
                    payload.male_u18
                    ||
                    payload.pwd_male_over18
                    >
                    payload.male_over18
                ) {

                    throw new Error(
                        "PWD values must be subsets of the corresponding participant groups."
                    );
                }


                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            "project_participants"
                        )
                        .insert(
                            payload
                        );


                if (error) {
                    throw error;
                }


                await loadProjectParticipants();
            }
    });
}


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () =>
        loadApplication()
            .catch(
                error => {

                    console.error(
                        error
                    );


                    if (
                        $("loginMessage")
                    ) {

                        $("loginMessage")
                            .textContent =
                            error.message
                            ||
                            "Unable to initialize application.";
                    }
                }
            )
);

