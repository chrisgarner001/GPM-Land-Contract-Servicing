const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${below1000(n % 100)}` : ""}`;
}

function wholeNumberToWords(n: number): string {
  if (n === 0) return "zero";
  let dollars = n;
  let result = "";
  if (dollars >= 1_000_000) {
    result += `${below1000(Math.floor(dollars / 1_000_000))} million `;
    dollars %= 1_000_000;
  }
  if (dollars >= 1000) {
    result += `${below1000(Math.floor(dollars / 1000))} thousand `;
    dollars %= 1000;
  }
  if (dollars > 0) result += below1000(dollars);
  return result.trim();
}

// Matches this package's promissory-note/land-contract convention — e.g.
// "seventy thousand dollars" for an even $70,000.00, or "five hundred
// sixty-three dollars and twenty-four cents" for $563.24. Distinct from
// domain/documents/numberToWords.ts's QCDLC-style "One Hundred Twenty-Three
// and 45/100 Dollars" — a different document family with its own
// established phrasing, not worth unifying across the two.
export function dollarsToWordsLowercase(amountCents: number): string {
  const cents = Math.abs(amountCents) % 100;
  const dollars = Math.floor(Math.abs(amountCents) / 100);
  const dollarsWord = `${wholeNumberToWords(dollars)} dollars`;
  if (cents === 0) return dollarsWord;
  return `${dollarsWord} and ${wholeNumberToWords(cents)} cents`;
}

// Plain cardinal word form with no dollar framing — e.g. "forty-five" for
// day/percentage counts like default_grace_days_words.
export function numberToWordsLowercase(n: number): string {
  return wholeNumberToWords(n);
}
