export function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(dateInput: string | Date, days: number) {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T00:00:00`) : new Date(dateInput);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
