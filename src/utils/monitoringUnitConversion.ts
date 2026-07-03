export type MonitoringTimeUnit = 'minutes' | 'hours' | 'days';

const minutesPerUnit: Record<MonitoringTimeUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export const fromCanonicalTime = (
  value: number,
  canonicalUnit: MonitoringTimeUnit,
  displayUnit: MonitoringTimeUnit,
) => {
  const converted = value * minutesPerUnit[canonicalUnit] / minutesPerUnit[displayUnit];
  return Number(converted.toFixed(3));
};

export const toCanonicalTime = (
  value: number,
  canonicalUnit: MonitoringTimeUnit,
  displayUnit: MonitoringTimeUnit,
) => Math.round(value * minutesPerUnit[displayUnit] / minutesPerUnit[canonicalUnit]);
