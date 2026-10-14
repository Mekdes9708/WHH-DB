// ============================================================

// participants.js - Project "Participants" tab (replaces the original)

// Load AFTER app.js and fixes.js.

//

// * Official record stays project x year (what donors and management report)

// * Optional partner breakdown per year (needs 04_participants_by_partner.sql)

// * Clear labels: "of which PWD" (PWD are already inside the sex/age counts)

// * Percentages, edit, delete, live totals, and checks that partner figures

//   never exceed the project figure

// ============================================================

(function () {

    "use strict";



    const GROUPS = [

        { key: "female_u18",    pwd: "pwd_female_u18",    label: "Female <18" },

        { key: "female_over18", pwd: "pwd_female_over18", label: "Female 18+" },

        { key: "male_u18",      pwd: "pwd_male_u18",      label: "Male <18" },

        { key: "male_over18",   pwd: "pwd_male_over18",   label: "Male 18+" }

    ];



    const num = value => Number(value) || 0;

    const total = row => GROUPS.reduce((sum, g) => sum + num(row[g.key]), 0);

    const pwdTotal = row => GROUPS.reduce((sum, g) => sum + num(row[g.pwd]), 0);

    const femaleTotal = row => num(row.female_u18) + num(row.female_over18);

    const fmt = value => Number(value).toLocaleString();

    const pct = (part, whole) =>

        whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toString()}%` : "\u2014";



    const missingTable = error =>

        Boolean(error) && (String(error.code) === "42P01" || String(error.code) === "PGRST205" ||

            /project_partner_participants/i.test(String(error.message || "")));



    // ---------------- shared form pieces ----------------



    function numberInput(id, label, value) {

        return `

            <div class="form-group">

                <label for="${id}">${esc(label)}</label>

                <input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${num(value)}">

            </div>`;

    }



    function fieldsHtml(prefix, values = {}) {

        return `

            <div class="form-group full-field"><strong>Participants reached</strong></div>

            ${GROUPS.map(g => numberInput(`${prefix}_${g.key}`, g.label, values[g.key])).join("")}

            <div class="form-group full-field">

                <strong>Of which persons with disabilities (PWD)</strong><br>

                <span class="field-hint">Already counted in the numbers above. Do not add them again.</span>

            </div>

            ${GROUPS.map(g => numberInput(`${prefix}_${g.pwd}`, `PWD ${g.label}`, values[g.pwd])).join("")}

            <div class="form-group full-field">

                <div class="location-preview"><div id="${prefix}_summary"></div></div>

            </div>`;

    }



    function readFields(prefix) {

        const values = {};

        GROUPS.forEach(g => {

            [g.key, g.pwd].forEach(field => {

                const raw = $(`${prefix}_${field}`).value;

                const value = raw === "" ? 0 : Number(raw);

                if (!Number.isInteger(value) || value < 0) {

                    throw new Error("Participant numbers must be whole numbers, zero or higher.");

                }

                values[field] = value;

            });

        });

        GROUPS.forEach(g => {

            if (values[g.pwd] > values[g.key]) {

                throw new Error(`PWD (${g.label}) cannot be higher than the number of ${g.label} participants.`);

            }

        });

        return values;

    }



    function wireSummary(prefix) {

        const update = () => {

            let values;

            try { values = readFields(prefix); }

            catch (error) {

                $(`${prefix}_summary`).textContent = error.message;

                return;

            }

            const all = total(values);

            $(`${prefix}_summary`).textContent =

                `Total: ${fmt(all)}  |  Female: ${pct(femaleTotal(values), all)}  |  PWD: ${fmt(pwdTotal(values))} (${pct(pwdTotal(values), all)})`;

        };

        GROUPS.forEach(g => {

            [g.key, g.pwd].forEach(field => $(`${prefix}_${field}`).addEventListener("input", update));

        });

        update();

    }



    // ---------------- data ----------------



    async function fetchProjectYear(projectId, year) {

        const { data, error } = await supabaseClient

            .from("project_participants")

            .select("*")

            .eq("project_id", projectId)

            .eq("reporting_year", year)

            .maybeSingle();

        if (error) throw error;

        return data;

    }



    async function fetchPartnerRows(projectId, year) {

        let query = supabaseClient

            .from("project_partner_participants")

            .select("*, partners(partner_name)")

            .eq("project_id", projectId);

        if (year !== undefined) query = query.eq("reporting_year", year);

        const { data, error } = await query;

        if (error) throw error;

        return data || [];

    }



    // ---------------- main tab ----------------



    window.loadProjectParticipants = async function () {

        const container = $("projectParticipantsTabContent");

        const projectId = state.project.project_id;

        const admin = isAdmin();



        const { data, error } = await supabaseClient

            .from("project_participants")

            .select("*")

            .eq("project_id", projectId)

            .order("reporting_year");



        if (error) {

            container.textContent = friendlyError(error);

            return;

        }



        let partnerRows = [];

        let partnerLayer = true;

        try {

            partnerRows = await fetchPartnerRows(projectId);

        } catch (partnerError) {

            if (missingTable(partnerError)) partnerLayer = false;

            else console.warn("Partner participants not loaded:", partnerError);

        }



        const viaPartners = {};

        partnerRows.forEach(row => {

            viaPartners[row.reporting_year] = (viaPartners[row.reporting_year] || 0) + total(row);

        });



        const columns = 9 + (partnerLayer ? 1 : 0) + (admin || partnerLayer ? 1 : 0);



        container.innerHTML = `

            <div class="section-panel">

                <div class="section-title-row">

                    <h3>Participants</h3>

                    ${admin ? `<button id="addParticipantBtn" class="primary-button small-button">Add Year</button>` : ""}

                </div>

                <div class="table-panel flat">

                    <table class="data-table">

                        <thead>

                            <tr>

                                <th>Year</th>

                                ${GROUPS.map(g => `<th>${esc(g.label)}</th>`).join("")}

                                <th>Total</th>

                                <th>% Female</th>

                                <th>Of which PWD</th>

                                ${partnerLayer ? "<th>Reached via partners</th>" : ""}

                                <th></th>

                            </tr>

                        </thead>

                        <tbody>

                        ${data?.length ? data.map(row => {

                            const all = total(row);

                            const via = viaPartners[row.reporting_year] || 0;

                            const exceeds = via > all;

                            return `<tr>

                                <td><strong>${esc(row.reporting_year)}</strong></td>

                                ${GROUPS.map(g => `<td>${fmt(num(row[g.key]))}</td>`).join("")}

                                <td><strong>${fmt(all)}</strong></td>

                                <td>${pct(femaleTotal(row), all)}</td>

                                <td>${fmt(pwdTotal(row))} (${pct(pwdTotal(row), all)})</td>

                                ${partnerLayer ? `<td>${via ? `${fmt(via)} (${pct(via, all)})` : "\u2014"}${exceeds ? ' <span title="Partner figures are higher than the project total" style="color:#b45309">\u26A0</span>' : ""}</td>` : ""}

                                <td style="white-space:nowrap">

                                    ${partnerLayer ? `<button type="button" class="inline-button" data-partners-year="${esc(row.reporting_year)}">By partner</button>` : ""}

                                    ${admin ? `<button type="button" class="inline-button" data-edit-year="${esc(row.reporting_year)}">Edit</button>

                                               <button type="button" class="inline-button" data-delete-year="${esc(row.reporting_year)}">Delete</button>` : ""}

                                </td>

                            </tr>`;

                        }).join("") : `<tr><td colspan="${columns}">No participant records yet.</td></tr>`}

                        </tbody>

                    </table>

                </div>



            </div>`;



        $("addParticipantBtn")?.addEventListener("click", () => participantForm());



        container.querySelectorAll("[data-edit-year]").forEach(button => {

            button.onclick = () => {

                const row = data.find(item => String(item.reporting_year) === button.dataset.editYear);

                if (row) participantForm(row);

            };

        });



        container.querySelectorAll("[data-partners-year]").forEach(button => {

            button.onclick = () => showPartnerBreakdown(Number(button.dataset.partnersYear));

        });



        container.querySelectorAll("[data-delete-year]").forEach(button => {

            button.onclick = async () => {

                const year = Number(button.dataset.deleteYear);

                const message = partnerLayer

                    ? `Delete the ${year} participant figures for this project, including any partner breakdown for ${year}?\n\nThis cannot be undone.`

                    : `Delete the ${year} participant figures for this project?\n\nThis cannot be undone.`;

                if (!window.confirm(message)) return;

                try {

                    if (partnerLayer) {

                        const { error: partnerDeleteError } = await supabaseClient

                            .from("project_partner_participants")

                            .delete()

                            .eq("project_id", projectId)

                            .eq("reporting_year", year);

                        if (partnerDeleteError) throw partnerDeleteError;

                    }

                    const { error: deleteError } = await supabaseClient

                        .from("project_participants")

                        .delete()

                        .eq("project_id", projectId)

                        .eq("reporting_year", year);

                    if (deleteError) throw deleteError;

                    toast(`${year} figures deleted.`);

                    await loadProjectParticipants();

                } catch (deleteFailure) {

                    toast(friendlyError(deleteFailure));

                }

            };

        });

    };



    // ---------------- project-year form (add / edit) ----------------



    window.participantForm = function (existing) {

        const editing = Boolean(existing);



        openModal({

            title: editing ? `Edit Participants - ${existing.reporting_year}` : "Add Participants for a Year",

            large: true,

            body: `

            <div class="form-grid">

                <div class="form-group">

                    <label for="pfYear">Reporting Year *</label>

                    <input id="pfYear" type="number" min="2000" max="2100" step="1" required

                           value="${editing ? esc(existing.reporting_year) : new Date().getFullYear()}"

                           ${editing ? "disabled" : ""}>

                </div>

                <div class="form-group full-field">

                    <span class="field-hint">Project total for the year, all partners and WHH-direct activities combined.</span>

                </div>

                ${fieldsHtml("pf", existing || {})}

                <div class="form-group full-field">

                    <label for="pfNotes">Notes (source, method, comments)</label>

                    <textarea id="pfNotes" rows="2">${esc(existing?.notes || "")}</textarea>

                </div>

            </div>`,



            onOpen: () => wireSummary("pf"),



            onSave: async () => {

                const year = Number($("pfYear").value);

                if (!Number.isInteger(year) || year < 2000 || year > 2100) {

                    throw new Error("Enter a valid reporting year (for example 2026).");

                }

                const values = readFields("pf");

                const notes = emptyToNull($("pfNotes").value);



                if (editing) {

                    const { error } = await supabaseClient

                        .from("project_participants")

                        .update({ ...values, notes })

                        .eq("project_id", state.project.project_id)

                        .eq("reporting_year", year);

                    if (error) throw error;

                } else {

                    const { error } = await supabaseClient

                        .from("project_participants")

                        .insert({

                            project_id: state.project.project_id,

                            reporting_year: year,

                            ...values,

                            total_participants: null,

                            notes

                        });

                    if (error) {

                        if (String(error.code) === "23505") {

                            throw new Error(`Figures for ${year} already exist. Use Edit on that row instead.`);

                        }

                        throw error;

                    }

                }

                await loadProjectParticipants();

            }

        });

    };



    // ---------------- partner breakdown ----------------



    async function showPartnerBreakdown(year) {

        const projectId = state.project.project_id;

        const admin = isAdmin();

        let projectRow, rows;

        try {

            [projectRow, rows] = await Promise.all([

                fetchProjectYear(projectId, year),

                fetchPartnerRows(projectId, year)

            ]);

        } catch (error) {

            toast(friendlyError(error));

            return;

        }

        rows.sort((a, b) =>

            String(a.partners?.partner_name || "").localeCompare(String(b.partners?.partner_name || "")));



        const projectTotal = projectRow ? total(projectRow) : 0;

        const attributed = rows.reduce((sum, row) => sum + total(row), 0);

        const direct = Math.max(projectTotal - attributed, 0);



        openModal({

            title: `Participants by partner - ${year}`,

            large: true,

            body: `

            <div class="table-panel flat">

                <table class="data-table">

                    <thead><tr>

                        <th>Partner</th>

                        ${GROUPS.map(g => `<th>${esc(g.label)}</th>`).join("")}

                        <th>Total</th><th>Of which PWD</th>${admin ? "<th></th>" : ""}

                    </tr></thead>

                    <tbody>

                    ${rows.length ? rows.map(row => `<tr>

                        <td>${esc(row.partners?.partner_name || "")}</td>

                        ${GROUPS.map(g => `<td>${fmt(num(row[g.key]))}</td>`).join("")}

                        <td><strong>${fmt(total(row))}</strong></td>

                        <td>${fmt(pwdTotal(row))}</td>

                        ${admin ? `<td style="white-space:nowrap">

                            <button type="button" class="inline-button" data-edit-partner="${esc(row.partner_id)}">Edit</button>

                            <button type="button" class="inline-button" data-delete-partner="${esc(row.partner_id)}">Delete</button>

                        </td>` : ""}

                    </tr>`).join("") : `<tr><td colspan="${admin ? 8 : 7}">No partner figures recorded for ${year}.</td></tr>`}

                    </tbody>

                </table>

            </div>

            <div class="location-preview" style="margin-top:12px">

                <div>Project total ${year}: <strong>${fmt(projectTotal)}</strong></div>

                <div>Reached via partners: <strong>${fmt(attributed)}</strong> (${pct(attributed, projectTotal)})</div>

                <div>WHH-direct or not yet attributed: <strong>${fmt(direct)}</strong> (${pct(direct, projectTotal)})</div>

                ${attributed > projectTotal ? `<div style="color:#b45309;font-weight:600">Partner figures are higher than the project total. Please check them.</div>` : ""}

            </div>

            ${admin ? `<div style="margin-top:12px"><button type="button" id="addPartnerFigures" class="primary-button small-button">Add partner figures</button></div>` : ""}`,



            onOpen: () => {

                $("addPartnerFigures")?.addEventListener("click", () =>

                    partnerParticipantForm(year, projectRow, rows));



                document.querySelectorAll("[data-edit-partner]").forEach(button => {

                    button.onclick = () => {

                        const row = rows.find(item => String(item.partner_id) === button.dataset.editPartner);

                        if (row) partnerParticipantForm(year, projectRow, rows, row);

                    };

                });



                document.querySelectorAll("[data-delete-partner]").forEach(button => {

                    button.onclick = async () => {

                        const row = rows.find(item => String(item.partner_id) === button.dataset.deletePartner);

                        if (!row || !window.confirm(`Delete ${row.partners?.partner_name || "this partner"}'s ${year} figures?`)) return;

                        const { error } = await supabaseClient

                            .from("project_partner_participants")

                            .delete()

                            .eq("project_partner_participant_id", row.project_partner_participant_id);

                        if (error) {

                            toast(friendlyError(error));

                            return;

                        }

                        toast("Partner figures deleted.");

                        await loadProjectParticipants();

                        showPartnerBreakdown(year);

                    };

                });

            }

        });

    }



    async function partnerParticipantForm(year, projectRow, rows, existing) {

        if (!projectRow) {

            toast(`Add the project total for ${year} first, then the partner breakdown.`);

            return;

        }

        const editing = Boolean(existing);

        const projectId = state.project.project_id;



        const { data: links, error: linkError } = await supabaseClient

            .from("partner_projects")

            .select("partner_id, partners(partner_name)")

            .eq("project_id", projectId);

        if (linkError) {

            toast(friendlyError(linkError));

            return;

        }



        const used = new Set(rows.map(row => String(row.partner_id)));

        const options = (links || [])

            .filter(link => editing || !used.has(String(link.partner_id)))

            .map(link => ({ id: link.partner_id, name: link.partners?.partner_name || `Partner ${link.partner_id}` }))

            .sort((a, b) => a.name.localeCompare(b.name));



        if (!editing && !options.length) {

            toast("All partners linked to this project already have figures for this year. Link more partners on the Partners tab first.");

            return;

        }



        openModal({

            title: editing ? `Edit partner figures - ${year}` : `Add partner figures - ${year}`,

            large: true,

            body: `

            <div class="form-grid">

                <div class="form-group full-field">

                    <label for="ppPartner">Partner *</label>

                    <select id="ppPartner" required ${editing ? "disabled" : ""}>

                        ${optionHtml(options, "id", "name", existing?.partner_id ?? null, "Select partner")}

                    </select>

                </div>

                ${fieldsHtml("pp", existing || {})}

                <div class="form-group full-field">

                    <label for="ppNotes">Notes</label>

                    <textarea id="ppNotes" rows="2">${esc(existing?.notes || "")}</textarea>

                </div>

            </div>`,



            onOpen: () => wireSummary("pp"),



            onSave: async () => {

                const partnerId = Number($("ppPartner").value);

                if (!partnerId) throw new Error("Select a partner.");

                const values = readFields("pp");



                // Partner figures must never exceed the project figure.

                const latest = await fetchPartnerRows(projectId, year);

                GROUPS.forEach(g => {

                    const others = latest

                        .filter(row => Number(row.partner_id) !== partnerId)

                        .reduce((sum, row) => sum + num(row[g.key]), 0);

                    if (others + values[g.key] > num(projectRow[g.key])) {

                        throw new Error(

                            `Partner figures for ${g.label} would add up to ${fmt(others + values[g.key])}, ` +

                            `more than the project total of ${fmt(num(projectRow[g.key]))}.`);

                    }

                });



                const { error } = await supabaseClient

                    .from("project_partner_participants")

                    .upsert({

                        project_id: projectId,

                        reporting_year: year,

                        partner_id: partnerId,

                        ...values,

                        notes: emptyToNull($("ppNotes").value),

                        updated_at: new Date().toISOString()

                    }, { onConflict: "project_id,reporting_year,partner_id" });

                if (error) throw error;



                await loadProjectParticipants();

                window.setTimeout(() => showPartnerBreakdown(year), 50);

            }

        });

    }

})();