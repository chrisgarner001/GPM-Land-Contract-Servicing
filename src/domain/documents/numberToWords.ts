const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${below1000(n % 100)}` : ""}`;
}

// Spells out a whole-cents amount as "One Hundred Twenty-Three and 45/100
// Dollars" — ported from the standalone Quitclaim Deed Dashboard's
// numberToWords(), used for QCDLC's consideration_words merge field.
export function amountCentsToWords(amountCents: number): string {
  const cents = Math.abs(amountCents) % 100;
  let dollars = Math.floor(Math.abs(amountCents) / 100);

  if (dollars === 0) return `Zero and ${String(cents).padStart(2, "0")}/100 Dollars`;

  let result = "";
  if (dollars >= 1_000_000) {
    result += `${below1000(Math.floor(dollars / 1_000_000))} Million `;
    dollars %= 1_000_000;
  }
  if (dollars >= 1000) {
    result += `${below1000(Math.floor(dollars / 1000))} Thousand `;
    dollars %= 1000;
  }
  if (dollars > 0) result += below1000(dollars);

  return `${result.trim()} and ${String(cents).padStart(2, "0")}/100 Dollars`;
}
