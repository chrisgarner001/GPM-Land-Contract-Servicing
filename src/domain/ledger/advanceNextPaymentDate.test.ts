import { describe, expect, it } from "vitest";
import { advanceNextPaymentDate, regressNextPaymentDate } from "./advanceNextPaymentDate";

describe("advanceNextPaymentDate", () => {
  it("advances a monthly due date by one calendar month", () => {
    expect(advanceNextPaymentDate("2026-07-01", "MONTHLY")).toBe("2026-08-01");
  });

  it("rolls a monthly due date over a year boundary", () => {
    expect(advanceNextPaymentDate("2026-12-15", "MONTHLY")).toBe("2027-01-15");
  });

  it("clamps a month-end monthly due date to the shorter next month", () => {
    expect(advanceNextPaymentDate("2026-01-31", "MONTHLY")).toBe("2026-02-28");
  });

  it("clamps into a leap-year February", () => {
    expect(advanceNextPaymentDate("2027-12-31", "MONTHLY")).toBe("2028-01-31");
    expect(advanceNextPaymentDate("2028-01-31", "MONTHLY")).toBe("2028-02-29");
  });

  it("advances a semi-monthly due date by 15 days", () => {
    expect(advanceNextPaymentDate("2026-07-01", "SEMI_MONTHLY")).toBe("2026-07-16");
  });

  it("advances a biweekly due date by 14 days", () => {
    expect(advanceNextPaymentDate("2026-07-01", "BIWEEKLY")).toBe("2026-07-15");
  });
});

describe("regressNextPaymentDate", () => {
  it("is the inverse of advancing a monthly due date", () => {
    expect(regressNextPaymentDate("2026-08-01", "MONTHLY")).toBe("2026-07-01");
  });

  it("rolls a monthly due date back over a year boundary", () => {
    expect(regressNextPaymentDate("2027-01-15", "MONTHLY")).toBe("2026-12-15");
  });

  it("regresses a semi-monthly due date by 15 days", () => {
    expect(regressNextPaymentDate("2026-07-16", "SEMI_MONTHLY")).toBe("2026-07-01");
  });

  it("regresses a biweekly due date by 14 days", () => {
    expect(regressNextPaymentDate("2026-07-15", "BIWEEKLY")).toBe("2026-07-01");
  });
});
