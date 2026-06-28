# Documentation

Velair documentation is grouped by audience and topic.

## User Documentation

- [Installation](user/installation.md): install Velair through HACS or manually.
- [Usage](user/usage.md): configure climates, schedules, templates, boosts, pauses, import/export, and services.
- [Adaptive Preconditioning](user/adaptive-preconditioning.md): start scheduled comfort targets early with local learning.
- [Room Assist](user/room-assist.md): use a separate room temperature sensor for TRVs, thermostats, and AC units.
- [Troubleshooting](user/troubleshooting.md): common setup, frontend resource, and runtime issues.

## Developer Documentation

- [Architecture](developer/architecture.md): backend and frontend module boundaries, persistence model and scheduler flow.
- [WebSocket API](developer/api.md): frontend/backend API contract.
- [Adaptive preconditioning internals](developer/adaptive-preconditioning.md): local learning states, similarity weighting, storage, and API output.
- [Room Assist internals](developer/room-assist.md): room sensor source selection, assisted target calculation, runtime status, restoration, and events.
- [Frontend](developer/frontend.md): frontend runtime elements, build commands, Lovelace resource, translations, UI principles, and frontend workflow.
- [Development](developer/development.md): local checks, generated files, coding guidelines, and contribution workflow.
- [Manual testing](developer/manual-testing.md): release and behavior verification checklist.

## Project Documentation

- [Screenshots](project/screenshots.md): real screenshots.

Future ideas and feature requests should be tracked through GitHub issues or discussions so they can evolve with community feedback without creating roadmap promises.
