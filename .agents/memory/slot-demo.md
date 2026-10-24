---
name: Slot demo constraints
description: Product constraints and simulation decisions for the JFK demo
---
The uploaded AIrplanes PRD is authoritative for domain rules and planted scenarios. Keep this a frontend-only, single-airport, single-season P0 demo; do not introduce backend services or P1 execution without a new request.

The user represents Delta and wants to offer Delta-held slots through the marketplace. Make Delta the default perspective and foreground seller/lease-out actions; keep other carriers available as selectable demo roles.

**Why:** The scripted JetBlue rescue is a useful scenario, but it must not imply JetBlue is the user's own airline or that Delta is only a buyer.

**How to apply:** Use DL as a clean-install/reset role and default to the marketplace's own-listings view. Preserve the B6-to-DL scenario and exact planted data for demonstrations.

**Why:** The user needs a reliable three-minute JetBlue-to-Delta rescue demonstration, not a generalized slot marketplace. The exact initial JetBlue severity counts are part of that story.

**How to apply:** Background cancellation randomness must not accidentally create additional JetBlue warnings. Use seeded stratified cancellations for background series; retain exact overrides for planted series. Unspecified cancellation dates can be deterministic, but prescribed dates and reasons cannot change.

Execution projections are effective-dated views, never mutations of the original seed. Future committed lease operations are credited in projections and treated as fulfilled in later demo snapshots.

**Why:** Presenters move the date backward and forward to compare old reports with the rescue. Re-randomizing history or executing a trade again on date changes would invalidate that demonstration.

**How to apply:** Preserve both original occurrence outcomes and execution records. A prior snapshot before approval must show the historical unrescued position; extended next-season terms remain metadata only.
