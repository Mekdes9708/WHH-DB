window.loadProjectLocations = async function () {
    const container =
        $("projectLocationsTabContent");

    const projectId =
        state.project?.project_id;

    if (!container || !projectId) {
        return;
    }

    container.textContent =
        "Loading locations...";

    const { data, error } =
        await supabaseClient
            .from("project_locations")
            .select(
                "project_location_id," +
                "project_id," +
                "location_id"
            )
            .eq(
                "project_id",
                projectId
            );

    if (error) {
        container.textContent =
            friendlyError(error);

        return;
    }

    let locations;

    try {
        locations = await safeSelect(
            "locations",
            [
                "location_id",
                "location_name",
                "location_type_id",
                "parent_location_id",
                "admin_pcode",
                "source_version",
                "is_custom"
            ].join(",")
        );
    } catch (lookupError) {
        container.textContent =
            friendlyError(lookupError);

        return;
    }

    const locationMap =
        Object.fromEntries(
            locations.map(location => [
                location.location_id,
                location
            ])
        );

    const admin = isAdmin();

    container.innerHTML = `
        <div class="section-panel">
            <div class="section-title-row">
                <h3>Locations</h3>

                ${
                    admin
                        ? `
                            <button
                                id="addLocationBtn"
                                type="button"
                                class="primary-button small-button"
                            >
                                Add Location
                            </button>
                        `
                        : ""
                }
            </div>

            <div class="table-panel flat">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Administrative Path</th>
                            <th>Level</th>
                            ${admin ? "<th></th>" : ""}
                        </tr>
                    </thead>

                    <tbody>
                        ${
                            (data || []).length
                                ? data.map(record => {
                                    const location =
                                        locationMap[
                                            record.location_id
                                        ];

                                    const path =
                                        buildLocationPath(
                                            record.location_id,
                                            locationMap
                                        ) ||
                                        location?.location_name ||
                                        "";

                                    const level =
                                        locationTypeNameById(
                                            location?.location_type_id
                                        ) || "";

                                    return `
                                        <tr>
                                            <td>
                                                ${esc(path)}
                                            </td>

                                            <td>
                                                ${esc(level)}
                                            </td>

                                            ${
                                                admin
                                                    ? `
                                                        <td>
                                                            <button
                                                                type="button"
                                                                class="inline-button"
                                                                data-remove-location="${esc(
                                                                    record.project_location_id
                                                                )}"
                                                                data-path="${esc(path)}"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    `
                                                    : ""
                                            }
                                        </tr>
                                    `;
                                }).join("")
                                : `
                                    <tr>
                                        <td colspan="${
                                            admin ? 3 : 2
                                        }">
                                            No locations added yet.
                                        </td>
                                    </tr>
                                `
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `;

    $("addLocationBtn")
        ?.addEventListener(
            "click",
            () => locationForm(locations)
        );

    container
        .querySelectorAll(
            "[data-remove-location]"
        )
        .forEach(button => {
            button.onclick = async () => {
                if (
                    !isAdmin() ||
                    button.disabled
                ) {
                    return;
                }

                const linkId = Number(
                    button.dataset.removeLocation
                );

                if (
                    !Number.isSafeInteger(linkId) ||
                    linkId < 1
                ) {
                    toast(
                        "Unable to identify this project-location link. Refresh the list."
                    );

                    return;
                }

                const confirmed = window.confirm(
                    `Remove "${button.dataset.path}" from this project?\n\n` +
                    "The location itself is kept; only the link to this project is removed."
                );

                if (!confirmed) {
                    return;
                }

                button.disabled = true;

                try {
                    const {
                        data: removed,
                        error: deleteError
                    } = await supabaseClient.rpc(
                        "whh_remove_project_location",
                        {
                            p_project_id:
                                projectId,

                            p_project_location_id:
                                linkId
                        }
                    );

                    if (deleteError) {
                        throw deleteError;
                    }

                    const confirmedRemoval =
                        removed &&
                        Number(
                            removed.project_location_id
                        ) === linkId &&
                        Number(
                            removed.project_id
                        ) === Number(projectId);

                    if (!confirmedRemoval) {
                        throw new Error(
                            "Removal was not confirmed by the database. Refresh the list and try again."
                        );
                    }

                    if (
                        state.project?.project_id ===
                        projectId
                    ) {
                        await loadProjectLocations();
                    }

                    toast(
                        "Location removed from this project."
                    );
                } catch (deleteError) {
                    toast(
                        friendlyError(deleteError)
                    );
                } finally {
                    button.disabled = false;
                }
            };
        });
};