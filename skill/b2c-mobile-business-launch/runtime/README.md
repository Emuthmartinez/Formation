# Runtime

The runtime owns execution semantics: stable graph identities, workflow contracts, compilation, readiness, resource claims, retries, joins, approvals, verification, and evidence lineage. It does not own business policy prose or mutable launch state.

The canonical typed graph lives in `graph/`. Generated projections live in `graph/generated/` and must be changed through their source definitions and renderer.
