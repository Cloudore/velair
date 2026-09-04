import { css } from "lit";

export const humidityStyles = css`
.humidity-view {
  display: grid;
  gap: 12px;
  max-width: 100%;
  min-width: 0;
}

.humidity-intro {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  padding: 2px 4px 4px;
}

.humidity-intro > ha-icon {
  --mdc-icon-size: 22px;
  color: var(--primary-color);
}

.humidity-intro > span:not(.humidity-compliance) {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.humidity-intro strong {
  color: var(--primary-text-color);
  font-size: 14px;
  line-height: 1.25;
}

.humidity-intro small {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.35;
}

.humidity-compliance {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  padding: 4px 10px;
  white-space: nowrap;
}

.humidity-compliance ha-icon {
  --mdc-icon-size: 16px;
}

.humidity-compliance.compliant {
  background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent);
  color: var(--success-color, #43a047);
}

.humidity-compliance.exceeded {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, transparent);
  color: var(--warning-color, #f9a825);
}

.humidity-zone,
.humidity-global {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  min-width: 0;
  position: relative;
}

.humidity-zone-heading {
  align-items: center;
  border-bottom: 1px solid var(--divider-color);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  min-width: 0;
  padding: 12px;
}

.humidity-zone.collapsed .humidity-zone-heading {
  border-bottom: 0;
}

.humidity-zone.collapsed .humidity-summary:empty {
  display: none;
}

.humidity-zone-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
  padding: 0;
  text-align: left;
}

.humidity-zone-toggle:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 4px;
}

.humidity-zone-toggle:disabled {
  cursor: default;
}

.humidity-zone-toggle > ha-icon {
  --mdc-icon-size: 20px;
  color: var(--secondary-text-color);
}

.humidity-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.humidity-zone-identity strong,
.humidity-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.humidity-zone-identity strong {
  color: var(--primary-text-color);
  font-size: 14px;
}

.humidity-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.humidity-chip {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  padding: 4px 10px;
  white-space: nowrap;
  background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent);
  color: var(--secondary-text-color);
}

.humidity-chip ha-icon {
  --mdc-icon-size: 16px;
}

.humidity-chip.state-pulsing {
  background: color-mix(in srgb, var(--info-color, #039be5) 16%, transparent);
  color: var(--info-color, #039be5);
}

.humidity-chip.state-resting {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
}

.humidity-chip.state-waiting {
  background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent);
  color: var(--success-color, #43a047);
}

.humidity-chip.state-blocked_gate,
.humidity-chip.state-blocked_manual {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, transparent);
  color: var(--warning-color, #f9a825);
}

.humidity-chip.state-unavailable {
  background: color-mix(in srgb, var(--error-color, #db4437) 14%, transparent);
  color: var(--error-color, #db4437);
}

.humidity-priority-badge {
  align-items: center;
  color: var(--warning-color, #f9a825);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 4px;
  white-space: nowrap;
}

.humidity-priority-badge ha-icon {
  --mdc-icon-size: 16px;
}

.humidity-zone-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.humidity-enable-control.unavailable {
  opacity: 0.5;
}

.humidity-unavailable-message,
.humidity-reason {
  color: var(--secondary-text-color);
  font-size: 12px;
  padding: 0 12px 10px;
}

.humidity-summary {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

.humidity-summary:empty {
  display: none;
}

.humidity-metrics {
  display: grid;
  gap: 8px 12px;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
}

.humidity-metric {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.humidity-metric small {
  color: var(--secondary-text-color);
  font-size: 11px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.humidity-metric strong {
  color: var(--primary-text-color);
  font-size: 15px;
}

.humidity-metric em {
  color: var(--info-color, #039be5);
  font-size: 11px;
  font-style: normal;
}

.humidity-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.humidity-flag {
  align-items: center;
  border-radius: 999px;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 11px;
  gap: 4px;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent);
}

.humidity-flag ha-icon {
  --mdc-icon-size: 14px;
}

.humidity-flag.gate {
  color: var(--warning-color, #f9a825);
}

.humidity-flag.emergency {
  color: var(--error-color, #db4437);
}

.humidity-zone-content {
  border-top: 1px solid var(--divider-color);
  padding: 10px 12px 12px;
}

.humidity-global {
  padding: 12px;
}

.humidity-global h3 {
  align-items: center;
  color: var(--primary-text-color);
  display: flex;
  font-size: 14px;
  gap: 8px;
  margin: 0 0 4px;
}

.humidity-global h3 ha-icon {
  --mdc-icon-size: 18px;
  color: var(--primary-color);
}

.humidity-global-detail {
  color: var(--secondary-text-color);
  font-size: 12px;
  margin: 0 0 10px;
}

.humidity-config-rows {
  display: grid;
  gap: 8px;
}

.humidity-config-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 200px);
  min-width: 0;
}

.humidity-config-label {
  align-items: center;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 13px;
  gap: 6px;
  min-width: 0;
}

.humidity-number-input input,
.humidity-select-row select {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--primary-text-color);
  font: inherit;
  padding: 6px 8px;
  width: 100%;
}

.humidity-toggle-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

@media (max-width: 600px) {
  .humidity-zone-heading {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .humidity-chip {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .humidity-config-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;
