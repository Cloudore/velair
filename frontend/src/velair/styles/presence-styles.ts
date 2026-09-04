import { css } from "lit";

export const presenceStyles = css`
.presence-view {
  display: grid;
  gap: 12px;
  max-width: 100%;
  min-width: 0;
}

.presence-intro {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  padding: 2px 4px 4px;
}

.presence-intro > ha-icon {
  --mdc-icon-size: 22px;
  color: var(--primary-color);
}

.presence-intro > span:not(.presence-chip) {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.presence-intro strong {
  color: var(--primary-text-color);
  font-size: 14px;
  line-height: 1.25;
}

.presence-intro small {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.35;
}

.presence-section,
.presence-zone {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  min-width: 0;
  position: relative;
}

.presence-section {
  padding: 12px;
}

.presence-section > h3,
.presence-zone-section > h3 {
  align-items: center;
  color: var(--primary-text-color);
  display: flex;
  font-size: 14px;
  font-weight: 600;
  gap: 8px;
  margin: 0 0 4px;
}

.presence-section > h3 ha-icon,
.presence-zone-section > h3 ha-icon {
  --mdc-icon-size: 18px;
  color: var(--primary-color);
}

.presence-section-detail {
  color: var(--secondary-text-color);
  font-size: 12px;
  margin: 0 0 10px;
}

.presence-subsection {
  border-top: 1px solid var(--divider-color);
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
}

.presence-subsection > h4 {
  align-items: center;
  color: var(--primary-text-color);
  display: flex;
  font-size: 13px;
  font-weight: 600;
  gap: 6px;
  margin: 0 0 2px;
}

.presence-subsection > h4 ha-icon {
  --mdc-icon-size: 16px;
  color: var(--secondary-text-color);
}

.presence-fields {
  display: grid;
  gap: 8px;
}

.presence-field {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(140px, 240px);
  min-width: 0;
}

.presence-field-label {
  align-items: center;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 13px;
  gap: 6px;
  min-width: 0;
}

.presence-toggle-field {
  grid-template-columns: minmax(0, 1fr) auto;
}

.presence-entity-list-field {
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}

.presence-number-input,
.presence-time-input {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  min-width: 0;
}

.presence-number-input input,
.presence-time-input input,
.presence-text-field input,
.presence-select-field select,
.presence-entity-add select,
.presence-stage-row input,
.presence-stage-row select,
.presence-hold input,
.presence-hold select {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--primary-text-color);
  font: inherit;
  min-height: 34px;
  padding: 6px 8px;
  width: 100%;
}

.presence-number-input input {
  min-width: 0;
}

.presence-unit {
  color: var(--secondary-text-color);
  flex: 0 0 auto;
  font-size: 12px;
}

.presence-inline-clear,
.presence-chip-remove,
.presence-row-remove {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--secondary-text-color);
  cursor: pointer;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  padding: 0;
  width: 28px;
}

.presence-inline-clear ha-icon,
.presence-chip-remove ha-icon,
.presence-row-remove ha-icon {
  --mdc-icon-size: 16px;
}

.presence-inline-clear:disabled,
.presence-chip-remove:disabled,
.presence-row-remove:disabled {
  cursor: default;
  opacity: 0.45;
}

.presence-entity-list {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.presence-entity-chip {
  align-items: center;
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary-color) 30%, var(--divider-color));
  border-radius: 999px;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 12px;
  gap: 2px;
  max-width: 100%;
  padding: 2px 4px 2px 10px;
}

.presence-entity-chip > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.presence-entity-chip .presence-chip-remove {
  height: 22px;
  width: 22px;
}

.presence-entity-list-empty {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.presence-entity-add {
  flex: 1 1 200px;
  margin-top: 0;
  max-width: 320px;
  min-width: 160px;
}

.presence-zone-picker {
  display: grid;
  gap: 8px;
}

.presence-zone-picker .zones {
  margin-top: 0;
}

.presence-zone {
  gap: 0;
}

.presence-zone-heading {
  align-items: center;
  border-bottom: 1px solid var(--divider-color);
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  padding: 12px;
}

.presence-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.presence-zone-identity strong,
.presence-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.presence-zone-identity strong {
  color: var(--primary-text-color);
  font-size: 14px;
}

.presence-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.presence-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.presence-chip {
  align-items: center;
  background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent);
  border-radius: 999px;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  padding: 4px 10px;
  white-space: nowrap;
}

.presence-chip ha-icon {
  --mdc-icon-size: 16px;
}

.presence-chip small {
  font-weight: 400;
  opacity: 0.85;
}

.presence-chip.tone-good {
  background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent);
  color: var(--success-color, #43a047);
}

.presence-chip.tone-info {
  background: color-mix(in srgb, var(--info-color, #039be5) 16%, transparent);
  color: var(--info-color, #039be5);
}

.presence-chip.tone-primary {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
}

.presence-chip.tone-warning {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, transparent);
  color: var(--warning-color, #f9a825);
}

.presence-chip.tone-error {
  background: color-mix(in srgb, var(--error-color, #db4437) 14%, transparent);
  color: var(--error-color, #db4437);
}

.presence-zone-section {
  border-bottom: 1px solid var(--divider-color);
  padding: 12px;
}

.presence-zone-section:last-child {
  border-bottom: 0;
}

.presence-zone-section-heading {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 8px;
}

.presence-zone-section-heading > h3 {
  align-items: center;
  color: var(--primary-text-color);
  display: flex;
  font-size: 14px;
  font-weight: 600;
  gap: 8px;
  margin: 0;
}

.presence-zone-section-heading > h3 ha-icon {
  --mdc-icon-size: 18px;
  color: var(--primary-color);
}

.presence-stages {
  display: grid;
  gap: 6px;
}

.presence-stage-row {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: auto minmax(70px, 110px) auto auto minmax(90px, 140px) auto 28px;
  min-width: 0;
}

.presence-stage-row.release {
  grid-template-columns: auto minmax(70px, 110px) auto auto minmax(150px, 1fr) 28px;
}

.presence-stage-row > span {
  color: var(--secondary-text-color);
  font-size: 12px;
  white-space: nowrap;
}

.presence-stage-row .presence-stage-index {
  color: var(--primary-text-color);
  font-weight: 600;
}

.presence-stage-row input {
  min-width: 0;
}

.presence-stage-row select {
  min-width: 0;
}

.presence-stage-row.invalid input,
.presence-stage-row.invalid select {
  border-color: var(--error-color, #db4437);
}

.presence-stage-error {
  color: var(--error-color, #db4437);
  font-size: 12px;
}

.presence-stage-add {
  justify-self: start;
}

.presence-hold {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.presence-hold-heading {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.presence-hold-heading strong {
  color: var(--primary-text-color);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.presence-hold-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.presence-hold-grid .presence-field {
  grid-template-columns: minmax(0, 1fr);
}

.presence-empty-list {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.presence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.presence-actions .command-button.compact {
  font-size: 13px;
}

.presence-disabled-note {
  color: var(--secondary-text-color);
  font-size: 12px;
  padding: 0 0 4px;
}

.presence-unavailable-message {
  color: var(--secondary-text-color);
  font-size: 12px;
  padding: 10px 12px;
}

@media (max-width: 600px) {
  .presence-intro {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .presence-intro > .presence-chip {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .presence-field {
    grid-template-columns: minmax(0, 1fr);
  }

  .presence-toggle-field {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .presence-zone-heading,
  .presence-zone-section-heading {
    grid-template-columns: minmax(0, 1fr);
  }

  .presence-chips {
    justify-content: flex-start;
  }

  .presence-stage-row,
  .presence-stage-row.release {
    grid-template-columns: auto minmax(0, 1fr) auto 28px;
  }

  .presence-stage-row > .presence-stage-then {
    display: none;
  }
}
`;
