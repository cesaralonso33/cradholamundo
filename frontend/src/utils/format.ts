const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "medium",
});

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
}
