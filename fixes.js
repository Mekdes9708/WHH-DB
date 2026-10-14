// ============================================================

// WHH PARTNERSHIP MANAGEMENT SYSTEM - fixes.js

// Loaded AFTER app.js. Overrides specific functions without touching the

// 9,000-line app.js. To revert, delete the <script src="fixes.js"> line.

//

// 1. Pagination for large tables (Supabase returns max 1000 rows per request)

// 2. Safe, debounced partner search (escapes % and _ wildcards)

// 3. Modal: double-submit guard, Escape to close, friendly error messages,

//    start/end date validation on every form

// 4. Rebuilt cascading location picker (Region > Zone > Woreda > Kebele)

//    with "add another" and a Remove button

// 5. Sector weight total warning (should be 100%)

// 6. Session-expiry handling

// ============================================================



(function () {

    "use strict";



    // --------------------------------------------------------

    // Shared helpers

    // --------------------------------------------------------



    const escapeLike = text =>

        String(text || "").replace(/[**\\\**%_]/g, match => "\\\\" + match);



    const byName = (a, b) =>

        String(a.location_name || "").localeCompare(String(b.location_name || ""));



    function friendlyError(error) {

        const code = String(error?.code || "");

        const raw = String(error?.message || "");



        if (code === "23505") return "This record already exists (duplicate). Check the list before adding it again.";

        if (code === "23503") return "This record is linked to other records, or a linked record no longer exists.";

        if (code === "23502") return "A required field is empty. Please complete all fields marked *.";

        if (code === "23514") return "One of the values is not allowed (for example a percentage above 100 or an end date before the start date).";

        if (code === "42501" || /row-level security/i.test(raw)) return "You do not have permission to do this. Please contact the system administrator.";

        if (/Failed to fetch|NetworkError|network/i.test(raw)) return "Cannot reach the server. Check your internet connection and try again.";

        if (/JWT|expired/i.test(raw)) return "Your session has expired. Please sign in again.";

        return raw || "Unable to save the record.";

    }

    window.friendlyError = friendlyError;



    // --------------------------------------------------------

    // 1. Pagination (fixes silently truncated location lists)

    // --------------------------------------------------------



    const PAGE_SIZE = 1000;

    const STABLE_ORDER = {

        locations: "location_id",

        partners: "partner_id",

        projects: "project_id",

        partnerships: "partnership_id"

    };



    window.safeSelect = async function (table, columns = "*") {

        const orderColumn = STABLE_ORDER[table];



        // Small lookup tables: one request, same as before.

        if (!orderColumn) {

            const { data, error } = await supabaseClient.from(table).select(columns);

            if (error) throw error;

            return data || [];

        }



        // Large tables: page until the server returns nothing more.

        const rows = [];

        let from = 0;

        while (true) {

            const { data, error } = await supabaseClient

                .from(table)

                .select(columns)

                .order(orderColumn)

                .range(from, from + PAGE_SIZE - 1);

            if (error) throw error;

            if (!data || data.length === 0) break;

            rows.push(...data);

            from += data.length;

        }

        return rows;

    };



    // --------------------------------------------------------

    // 2. Partner search: debounce + escape wildcards

    // --------------------------------------------------------



    const originalLoadPartners = window.loadPartners;

    let searchTimer = null;



    window.loadPartners = function (search = "") {

        clearTimeout(searchTimer);

        const term = String(search || "").trim();

        if (!term) return originalLoadPartners("");

        return new Promise(resolve => {

            searchTimer = setTimeout(

                async () => resolve(await originalLoadPartners(escapeLike(term))),

                300

            );

        });

    };



    // --------------------------------------------------------

    // 3. Modal improvements

    // --------------------------------------------------------



    function validateDatePairs() {

        const form = $("modalForm");

        if (!form) return;



        // Pairs are matched by id convention: xxxStart / xxxEnd

        form.querySelectorAll('input[type="date"]').forEach(startInput => {

            const match = startInput.id.match(/^(.*)Start$/);

            if (!match) return;

            const endInput = $(match[1] + "End");

            if (!endInput || !startInput.value || !endInput.value) return;

            if (endInput.value < startInput.value) {

                endInput.focus();

                throw new Error("The end date cannot be earlier than the start date.");

            }

        });

    }



    const originalOpenModal = window.openModal;



    window.openModal = function (options) {

        const wrapped = { ...options };



        if (options.onSave) {

            wrapped.onSave = async () => {

                const button = document.querySelector("#modalForm button[type='submit']");

                const label = button?.textContent;

                if (button) {

                    button.disabled = true;          // blocks double-click / double Enter

                    button.textContent = "Saving...";

                }

                try {

                    validateDatePairs();

                    await options.onSave();

                } catch (error) {

                    console.error(error);

                    throw new Error(friendlyError(error));

                } finally {

                    if (button && button.isConnected) {

                        button.disabled = false;

                        button.textContent = label;

                    }

                }

            };

        }

        return originalOpenModal(wrapped);

    };



    document.addEventListener("keydown", event => {

        if (event.key === "Escape" && $("modalRoot")?.children.length) {

            closeModal();

        }

    });



    // --------------------------------------------------------

    // 4. Locations

    // --------------------------------------------------------



    // Exact, case-insensitive match (wildcards escaped) so "Addis_Ababa"

    // can never match "Addis Ababa" by accident.

    window.createOrReuseCustomLocation = async function (name, typeName, parentLocationId) {

        const clean = String(name || "").trim().replace(/\s+/g, " ");

        if (!clean) return null;



        const typeId = locationTypeId(typeName);

        if (!typeId) throw new Error(`Location type '${typeName}' is not configured.`);



        const columns = "location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom";



        const find = async () => {

            let query = supabaseClient

                .from("locations")

                .select(columns)

                .eq("location_type_id", typeId)

                .ilike("location_name", escapeLike(clean));

            query = (parentLocationId === null || parentLocationId === undefined)

                ? query.is("parent_location_id", null)

                : query.eq("parent_location_id", parentLocationId);

            const { data, error } = await query.limit(1);

            if (error) throw error;

            return data?.[0] || null;

        };



        const existing = await find();

        if (existing) return existing;



        const { data, error } = await supabaseClient

            .from("locations")

            .insert({

                location_name: clean,

                location_type_id: typeId,

                parent_location_id: parentLocationId ?? null,

                admin_pcode: null,

                source_version: "custom",

                is_custom: true

            })

            .select(columns)

            .single();



        if (error) {

            // Someone else created it a moment ago: reuse theirs.

            if (String(error.code) === "23505") {

                const again = await find();

                if (again) return again;

            }

            throw error;

        }

        return data;

    };



    window.locationForm = function (locations) {

        const OTHER = "__OTHER__";

        const typeId = name => Number(locationTypeId(name));



        const usable = row => row.is_custom || isOfficialAdminLocation(row);



        const childrenByParent = new Map();

        locations.forEach(row => {

            if (row.parent_location_id == null || !usable(row)) return;

            const key = Number(row.parent_location_id);

            if (!childrenByParent.has(key)) childrenByParent.set(key, []);

            childrenByParent.get(key).push(row);

        });



        const childrenOf = (parentId, typeName) =>

            (childrenByParent.get(Number(parentId)) || [])

                .filter(row => Number(row.location_type_id) === typeId(typeName))

                .sort(byName);



        const regions = locations

            .filter(row =>

                Number(row.location_type_id) === typeId("Region") &&

                isOfficialAdminLocation(row) &&

                /^ET\d{2}$/.test(String(row.admin_pcode || "")))

            .sort(byName);



        const otherOption = `<option value="${OTHER}">Other (not in list)</option>`;



        openModal({

            title: "Add Project Location",

            large: true,

            body: `

            <div class="form-grid">

                <div class="form-group"><label>Country</label><input value="Ethiopia" disabled></div>



                <div class="form-group">

                    <label for="locRegion">Region *</label>

                    <select id="locRegion" required>

                        ${optionHtml(regions, "location_id", "location_name", null, "Select region")}

                        ${otherOption}

                    </select>

                </div>

                <div id="locRegionOtherGroup" class="form-group hidden">

                    <label for="locRegionOther">Specify Region *</label><input id="locRegionOther">

                </div>



                <div class="form-group">

                    <label for="locZone">Zone <span class="field-hint">(optional)</span></label>

                    <select id="locZone" disabled></select>

                </div>

                <div id="locZoneOtherGroup" class="form-group hidden">

                    <label for="locZoneOther">Specify Zone *</label><input id="locZoneOther">

                </div>



                <div class="form-group">

                    <label for="locWoreda">Woreda <span class="field-hint">(optional)</span></label>

                    <select id="locWoreda" disabled></select>

                </div>

                <div id="locWoredaOtherGroup" class="form-group hidden">

                    <label for="locWoredaOther">Specify Woreda *</label><input id="locWoredaOther">

                </div>



                <div class="form-group full-field">

                    <label for="locKebele">Kebele / Specific Place <span class="field-hint">(optional)</span></label>

                    <input id="locKebele" disabled placeholder="Select a woreda first">

                </div>





                <div class="form-group full-field">

                    <label style="display:flex;gap:8px;align-items:center;font-weight:normal">

                        <input type="checkbox" id="locAddAnother" style="width:auto">

                        Add another location after saving

                    </label>

                </div>

            </div>`,



            onOpen: () => {

                const region = $("locRegion");

                const zone = $("locZone");

                const woreda = $("locWoreda");

                const kebele = $("locKebele");



                const toggleOther = (group, input, visible) => {

                    $(group).classList.toggle("hidden", !visible);

                    $(input).required = visible;

                    if (!visible) $(input).value = "";

                };


                const resetKebele = () => {

                    const enabled = Boolean(woreda.value);

                    kebele.disabled = !enabled;

                    kebele.placeholder = enabled ? "Type the kebele or village name" : "Select a woreda first";

                    if (!enabled) kebele.value = "";

                };



                const fillWoredas = () => {

                    // Woredas sit under a zone, but custom woredas may sit

                    // directly under a region.

                    let rows = [];

                    if (!region.value) {

                        woreda.innerHTML = `<option value="">Select a region first</option>`;

                        woreda.disabled = true;

                        toggleOther("locWoredaOtherGroup", "locWoredaOther", false);

                        resetKebele();

                        return;

                    }

                    if (zone.value && zone.value !== OTHER) {

                        rows = childrenOf(zone.value, "Woreda");

                    } else if (!zone.value && region.value !== OTHER) {

                        rows = childrenOf(region.value, "Woreda");

                    }

                    woreda.innerHTML =

                        optionHtml(rows, "location_id", "location_name", null, "Whole zone / region") +

                        otherOption;

                    woreda.disabled = false;

                    toggleOther("locWoredaOtherGroup", "locWoredaOther", false);

                    resetKebele();

                };



                const fillZones = () => {

                    toggleOther("locRegionOtherGroup", "locRegionOther", region.value === OTHER);

                    if (!region.value) {

                        zone.innerHTML = `<option value="">Select a region first</option>`;

                        zone.disabled = true;

                        toggleOther("locZoneOtherGroup", "locZoneOther", false);

                        fillWoredas();

                        return;

                    }

                    const rows = region.value === OTHER ? [] : childrenOf(region.value, "Zone");

                    zone.innerHTML =

                        optionHtml(rows, "location_id", "location_name", null, "Whole region") + otherOption;

                    zone.disabled = false;

                    toggleOther("locZoneOtherGroup", "locZoneOther", false);

                    fillWoredas();

                };



                region.onchange = fillZones;

                zone.onchange = () => {

                    toggleOther("locZoneOtherGroup", "locZoneOther", zone.value === OTHER);

                    fillWoredas();

                };

                woreda.onchange = () => {

                    toggleOther("locWoredaOtherGroup", "locWoredaOther", woreda.value === OTHER);

                    resetKebele();

                };



                fillZones();

            },



            onSave: async () => {

                const regionValue = $("locRegion").value;

                if (!regionValue) throw new Error("Select a Region.");



                const need = (id, label) => {

                    const value = $(id).value.trim();

                    if (!value) throw new Error(`Please specify the ${label}.`);

                    return value;

                };



                let regionId;

                if (regionValue === OTHER) {

                    const country = locations.find(row =>

                        locationTypeNameById(row.location_type_id) === "Country" &&

                        String(row.admin_pcode || "") === "ET");

                    regionId = (await createOrReuseCustomLocation(

                        need("locRegionOther", "Region"), "Region", country?.location_id ?? null)).location_id;

                } else {

                    regionId = Number(regionValue);

                }



                let zoneId = null;

                const zoneValue = $("locZone").value;

                if (zoneValue === OTHER) {

                    zoneId = (await createOrReuseCustomLocation(

                        need("locZoneOther", "Zone"), "Zone", regionId)).location_id;

                } else if (zoneValue) {

                    zoneId = Number(zoneValue);

                }



                let woredaId = null;

                const woredaValue = $("locWoreda").value;

                if (woredaValue === OTHER) {

                    woredaId = (await createOrReuseCustomLocation(

                        need("locWoredaOther", "Woreda"), "Woreda", zoneId || regionId)).location_id;

                } else if (woredaValue) {

                    woredaId = Number(woredaValue);

                }



                let finalId = woredaId || zoneId || regionId;



                const kebeleName = $("locKebele").value.trim();

                if (kebeleName) {

                    if (!woredaId) throw new Error("Select or specify a Woreda before entering a Kebele / Specific Place.");

                    finalId = (await createOrReuseCustomLocation(kebeleName, "Kebele", woredaId)).location_id;

                }



                const { error } = await supabaseClient

                    .from("project_locations")

                    .insert({ project_id: state.project.project_id, location_id: finalId });



                if (error) {

                    if (String(error.code) === "23505") {

                        throw new Error("This location is already linked to the project.");

                    }

                    throw error;

                }



                const addAnother = $("locAddAnother")?.checked;

                await loadProjectLocations();



                if (addAnother) {

                    // closeModal() runs right after onSave returns; reopen after it.

                    const fresh = await safeSelect(

                        "locations",

                        "location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom"

                    );

                    window.setTimeout(() => locationForm(fresh), 50);

                }

            }

        });

    };



    window.loadProjectLocations = async function () {

        const container = $("projectLocationsTabContent");

        const projectId = state.project.project_id;



        const { data, error } = await supabaseClient

            .from("project_locations")

            .select("project_location_id,project_id,location_id")

            .eq("project_id", projectId);



        if (error) {

            container.textContent = friendlyError(error);

            return;

        }



        const locations = await safeSelect(

            "locations",

            "location_id,location_name,location_type_id,parent_location_id,admin_pcode,source_version,is_custom"

        );

        const locationMap = Object.fromEntries(locations.map(row => [row.location_id, row]));

        const admin = isAdmin();



        container.innerHTML = `

            <div class="section-panel">

                <div class="section-title-row">

                    <h3>Locations</h3>

                    ${admin ? `<button id="addLocationBtn" class="primary-button small-button">Add Location</button>` : ""}

                </div>

                <div class="table-panel flat">

                    <table class="data-table">

                        <thead><tr><th>Administrative Path</th><th>Level</th>${admin ? "<th></th>" : ""}</tr></thead>

                        <tbody>

                        ${(data || []).length ? data.map(record => {

                            const location = locationMap[record.location_id];

                            const path = buildLocationPath(record.location_id, locationMap) || location?.location_name || "";

                            return `<tr>

                                <td>${esc(path)}</td>

                                <td>${esc(locationTypeNameById(location?.location_type_id) || "")}</td>

                                ${admin ? `<td><button type="button" class="inline-button" data-remove-location="${esc(record.project_location_id)}" data-path="${esc(path)}">Remove</button></td>` : ""}

                            </tr>`;

                        }).join("") : `<tr><td colspan="${admin ? 3 : 2}">No locations added yet.</td></tr>`}

                        </tbody>

                    </table>

                </div>

            </div>`;



        $("addLocationBtn")?.addEventListener("click", () => locationForm(locations));



        container.querySelectorAll("[data-remove-location]").forEach(button => {

            button.onclick = async () => {

                if (!window.confirm(`Remove "${button.dataset.path}" from this project?\n\nThe location itself is kept; only the link to this project is removed.`)) return;

                const { error: deleteError } = await supabaseClient

                    .from("project_locations")

                    .delete()

                    .eq("project_location_id", Number(button.dataset.removeLocation));

                if (deleteError) {

                    toast(friendlyError(deleteError));

                    return;

                }

                toast("Location removed.");

                await loadProjectLocations();

            };

        });

    };



    // --------------------------------------------------------

    // 5. Sector weights should total 100%

    // --------------------------------------------------------



    const originalLoadProjectSectors = window.loadProjectSectors;



    window.loadProjectSectors = async function () {

        await originalLoadProjectSectors();

        try {

            const container = $("projectSectorsTabContent");

            const { data, error } = await supabaseClient

                .from("project_sectors")

                .select("weight_percentage")

                .eq("project_id", state.project.project_id);

            if (error || !container || !data?.length) return;



            const total = data.reduce((sum, row) => sum + Number(row.weight_percentage || 0), 0);

            const note = document.createElement("div");

            note.className = "form-message";

            note.style.margin = "12px 0";

            if (Math.abs(total - 100) < 0.01) {

                note.textContent = "Sector weights total 100%.";

            } else {

                note.textContent = `Sector weights currently total ${total}%. They should add up to 100%.`;

                note.style.color = "#b45309";

                note.style.fontWeight = "600";

            }

            container.appendChild(note);

        } catch (warning) {

            console.warn("Sector weight check skipped:", warning);

        }

    };



    // --------------------------------------------------------

    // 6. Session expiry

    // --------------------------------------------------------



    supabaseClient.auth.onAuthStateChange(event => {

        if (event === "SIGNED_OUT") {

            show($("loginPage"));

            hide($("appPage"));

            const message = $("loginMessage");

            if (message && !message.textContent) {

                message.textContent = "You have been signed out. Please sign in again.";

            }

        }

    });

})();