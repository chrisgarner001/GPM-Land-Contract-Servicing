// Lender payment release hold: a payment's credit to the lender isn't
// eligible for inclusion in a Lender Payment Run until 5 days after the date
// it was received — gives an NSF/chargeback window before the lender is
// actually paid out. Shared by RecordPaymentModal's client-side preview and
// the server-side insert so the two can never drift.
export function computeReleaseDate(receivedDate: string): string {
  const date = new Date(`${receivedDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 5);
  return date.toISOString().slice(0, 10);
}
