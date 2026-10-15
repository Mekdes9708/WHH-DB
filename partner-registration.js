// Load last, after the existing application scripts.

(function () {
    "use strict";

    const id = name =>
        document.getElementById("reg_" + name);

    const value = name =>
        id(name).value.trim() || null;

    const other = name =>
        id(name)
            .selectedOptions[0]
            ?.textContent
            .trim()
            .toLowerCase() === "other";

    window.partnerForm = function (record = null) {
        const characteristics = (
            state.lookups.localization_characteristics || []
        ).filter(row => row.is_active !== false);

        let localizationReady = !record?.partner_id;

        function field(name, label, type = "text") {
            return `
                <div class="form-group">
                    <label for="reg_${name}">
                        ${label}
                    </label>

                    <input
                        id="reg_${name}"
                        type="${type}"
                        value="${esc(record?.[name] ?? "")}"
                    >
                </div>
            `;
        }

        function select(name, label, rows, key, text) {
            return `
                <div class="form-group">
                    <label for="reg_${name}">
                        ${label}
                    </label>

                    <select id="reg_${name}">
                        <option value="">Select</option>

                        ${rows.map(row => `
                            <option
                                value="${esc(row[key])}"
                                ${
                                    String(record?.[name] ?? "") ===
                                    String(row[key])
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${esc(row[text])}
                            </option>
                        `).join("")}
                    </select>
                </div>
            `;
        }

        const statuses = [...new Set([
            "Potential Partners",
            "Prospective",
            "Active",
            "Inactive",
            "Archived",

            ...(
                record?.partner_status
                    ? [record.partner_status]
                    : []
            )
        ])].map(text => ({
            value: text,
            label: text
        }));

        const reaches = [...new Set([
            "Community",
            "Woreda",
            "Zone",
            "Regional",
            "National",
            "Other",

            ...(
                record?.geographic_reach
                    ? [record.geographic_reach]
                    : []
            )
        ])].map(text => ({
            value: text,
            label: text
        }));

        openModal({
            title: record
                ? "Edit Partner"
                : "Add Partner",

            large: true,

            body: `
                <div class="form-grid">

                    <div class="form-group full-field">
                        <label for="reg_partner_name">
                            Partner Name *
                        </label>

                        <input
                            id="reg_partner_name"
                            required
                            value="${esc(
                                record?.partner_name ?? ""
                            )}"
                        >
                    </div>

                    ${field("acronym", "Acronym")}

                    ${field(
                        "registration_number",
                        "Registration Number"
                    )}

                    ${select(
                        "partner_type_id",
                        "Partner Type",
                        state.lookups.partner_types || [],
                        "partner_type_id",
                        "partner_type_name"
                    )}

                    <div id="reg_type_group">
                        ${field(
                            "partner_type_other",
                            "Please specify Partner Type"
                        )}
                    </div>

                    ${select(
                        "legal_status_id",
                        "Legal Status",
                        state.lookups.legal_statuses || [],
                        "legal_status_id",
                        "legal_status_name"
                    )}

                    <div id="reg_legal_group">
                        ${field(
                            "legal_status_other",
                            "Please specify Legal Status"
                        )}
                    </div>

                    ${field(
                        "date_established",
                        "Date Established",
                        "date"
                    )}

                    ${field(
                        "headquarters_location",
                        "Headquarters"
                    )}

                    ${field("city", "City")}

                    ${field("country", "Country")}

                    ${select(
                        "geographic_reach",
                        "Geographic Reach",
                        reaches,
                        "value",
                        "label"
                    )}

                    <div id="reg_reach_group">
                        ${field(
                            "reach_other",
                            "Please specify Geographic Reach"
                        )}
                    </div>

                    ${field(
                        "date_first_engaged_with_whh",
                        "First Engagement with WHH",
                        "date"
                    )}

                    ${select(
                        "partner_status",
                        "Partner Status",
                        statuses,
                        "value",
                        "label"
                    )}

                    ${field("website", "Website")}

                    ${field("address", "Address")}

                    <div class="form-group full-field">
                        <label>
                            Organization Identity /
                            Localization Characteristics
                        </label>

                        <div class="checkbox-grid">
                            ${characteristics.map(row => `
                                <label class="checkbox-option">
                                    <input
                                        type="checkbox"
                                        class="reg_characteristic"
                                        value="${esc(
                                            row.localization_characteristic_id
                                        )}"
                                        data-name="${esc(
                                            row.characteristic_name
                                        )}"
                                    >

                                    <span>
                                        ${esc(
                                            row.characteristic_name
                                        )}
                                    </span>
                                </label>
                            `).join("")}
                        </div>
                    </div>

                    <div id="reg_identity_group">
                        ${field(
                            "identity_other",
                            "Please specify Other organization identity"
                        )}
                    </div>

                    <div class="form-group full-field">
                        <label for="reg_localization_notes">
                            Localization / Identity Notes
                        </label>

                        <textarea
                            id="reg_localization_notes"
                        >${esc(
                            record?.localization_notes ?? ""
                        )}</textarea>
                    </div>

                    <div class="form-group full-field">
                        <label for="reg_description">
                            Organization Description
                        </label>

                        <textarea
                            id="reg_description"
                            rows="4"
                        >${esc(
                            record?.description ?? ""
                        )}</textarea>
                    </div>

                </div>
            `,

            onOpen: async () => {
                function bindOther(name, group) {
                    const sync = () => {
                        id(group).classList.toggle(
                            "hidden",
                            !other(name)
                        );
                    };

                    id(name).addEventListener(
                        "change",
                        sync
                    );

                    sync();
                }

                bindOther(
                    "partner_type_id",
                    "type_group"
                );

                bindOther(
                    "legal_status_id",
                    "legal_group"
                );

                bindOther(
                    "geographic_reach",
                    "reach_group"
                );

                const syncIdentity = () => {
                    const chosen = [
                        ...document.querySelectorAll(
                            ".reg_characteristic:checked"
                        )
                    ].some(box =>
                        box.dataset.name
                            .trim()
                            .toLowerCase() === "other"
                    );

                    id("identity_group")
                        .classList.toggle(
                            "hidden",
                            !chosen
                        );
                };

                document.querySelectorAll(
                    ".reg_characteristic"
                ).forEach(box => {
                    box.addEventListener(
                        "change",
                        syncIdentity
                    );
                });

                syncIdentity();

                if (record?.partner_id) {
                    try {
                        const { data, error } =
                            await supabaseClient
                                .from(
                                    "partner_localization_characteristics"
                                )
                                .select(
                                    "localization_characteristic_id," +
                                    "other_description"
                                )
                                .eq(
                                    "partner_id",
                                    record.partner_id
                                );

                        if (error) throw error;

                        for (
                            const box of
                            document.querySelectorAll(
                                ".reg_characteristic"
                            )
                        ) {
                            const existing = (
                                data || []
                            ).find(row =>
                                String(
                                    row.localization_characteristic_id
                                ) === box.value
                            );

                            box.checked =
                                Boolean(existing);

                            if (
                                existing &&
                                box.dataset.name
                                    .trim()
                                    .toLowerCase() === "other"
                            ) {
                                id("identity_other").value =
                                    existing.other_description || "";
                            }
                        }

                        localizationReady = true;

                        syncIdentity();
                    } catch (error) {
                        $("modalMessage").textContent =
                            friendlyError(error);
                    }
                }
            },

            onSave: async () => {
                if (!value("partner_name")) {
                    throw new Error(
                        "Enter the Partner Name."
                    );
                }

                if (!localizationReady) {
                    throw new Error(
                        "Reopen the form to load the existing details."
                    );
                }

                const payload = {};

                const textFields = [
                    "partner_name",
                    "acronym",
                    "registration_number",
                    "date_established",
                    "headquarters_location",
                    "city",
                    "country",
                    "date_first_engaged_with_whh",
                    "partner_status",
                    "website",
                    "address",
                    "description",
                    "localization_notes"
                ];

                for (const name of textFields) {
                    payload[name] = value(name);
                }

                payload.partner_type_id =
                    value("partner_type_id")
                        ? Number(value("partner_type_id"))
                        : null;

                payload.legal_status_id =
                    value("legal_status_id")
                        ? Number(value("legal_status_id"))
                        : null;

                payload.partner_type_other =
                    other("partner_type_id")
                        ? value("partner_type_other")
                        : null;

                payload.legal_status_other =
                    other("legal_status_id")
                        ? value("legal_status_other")
                        : null;

                payload.geographic_reach =
                    other("geographic_reach")
                        ? (
                            value("reach_other") ||
                            "Other"
                        )
                        : value("geographic_reach");

                if (
                    payload.partner_status === "Active"
                ) {
                    payload.is_active = true;
                }

                if (
                    ["Inactive", "Archived"].includes(
                        payload.partner_status
                    )
                ) {
                    payload.is_active = false;
                }

                const saved = await upsertRecord(
                    "partners",
                    payload,
                    "partner_id",
                    record?.partner_id
                );

                const selected = [
                    ...document.querySelectorAll(
                        ".reg_characteristic:checked"
                    )
                ].map(box => ({
                    partner_id: saved.partner_id,

                    localization_characteristic_id:
                        Number(box.value),

                    other_description:
                        box.dataset.name
                            .trim()
                            .toLowerCase() === "other"
                                ? value("identity_other")
                                : null
                }));

                const {
                    data: existing,
                    error: readError
                } = await supabaseClient
                    .from(
                        "partner_localization_characteristics"
                    )
                    .select(
                        "partner_localization_id," +
                        "localization_characteristic_id"
                    )
                    .eq(
                        "partner_id",
                        saved.partner_id
                    );

                if (readError) throw readError;

                if (selected.length) {
                    const { error } =
                        await supabaseClient
                            .from(
                                "partner_localization_characteristics"
                            )
                            .upsert(
                                selected,
                                {
                                    onConflict:
                                        "partner_id,localization_characteristic_id"
                                }
                            );

                    if (error) throw error;
                }

                const selectedIds = new Set(
                    selected.map(row =>
                        String(
                            row.localization_characteristic_id
                        )
                    )
                );

                const removed = (
                    existing || []
                ).filter(row =>
                    !selectedIds.has(
                        String(
                            row.localization_characteristic_id
                        )
                    )
                ).map(row =>
                    row.partner_localization_id
                );

                if (removed.length) {
                    const { error } =
                        await supabaseClient
                            .from(
                                "partner_localization_characteristics"
                            )
                            .delete()
                            .in(
                                "partner_localization_id",
                                removed
                            );

                    if (error) throw error;
                }

                await openPartner(
                    saved.partner_id
                );

                toast("Partner saved.");
            }
        });
    };
})();