const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Ported from the standalone Quitclaim Deed Dashboard's isoToDisplay/isoDay/
// isoMonth/isoYear — every deed template wants dates spelled out ("August
// 10, 2026") or split into day/month/year runs, never the raw yyyy-mm-dd
// an <input type="date"> holds.
export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export function isoDay(iso: string): string {
  return iso ? String(Number(iso.split("-")[2])) : "";
}

export function isoMonth(iso: string): string {
  return iso ? MONTHS[Number(iso.split("-")[1]) - 1] : "";
}

export function isoYear(iso: string): string {
  return iso ? iso.split("-")[0] : "";
}
