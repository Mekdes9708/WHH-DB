WHH PARTNERSHIP MANAGEMENT SYSTEM - MONDAY FINAL

Landing page
- After sign-in the application opens on a clean Home screen rather than a records table.
- Home provides module launch cards for Partners, Partnerships, Projects, Meetings & Actions, and PROMIS.
- Projects remains a full module in this prototype so the system can operate independently if PROMIS integration is not available.

Project scope
- The project schema and existing project tabs are retained, including Overview, Partners, Sectors, Locations, Budgets, Participants, and Documents.
- The design does not assume an API connection to PROMIS.
- Related Projects remains a generic relationship inside a Partnership.

Important retained fixes
- Ethiopia Region > Zone > Woreda cascade with custom Other options.
- Large-table pagination so locations are not truncated at 1,000 rows.
- Location preview/subtitle under the form removed; the cascade itself is unchanged.
- Participant module remains loaded after fixes.js and retains PWD subset validation and partner/year breakdown logic.
- Global modal scroll fix remains active for long forms and dropdowns.
- File/document support remains in the application.

Configuration
- Keep the existing local config.js used by the working prototype.
- This package does not include Supabase credentials.

Next planned step
- Validate the Monday prototype end-to-end, then update Power BI retrieval/views and agree the refresh schedule.
