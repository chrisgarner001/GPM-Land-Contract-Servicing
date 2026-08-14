import { describe, expect, it } from "vitest";
import { classifyDisbursement } from "./classifyDisbursement";

describe("classifyDisbursement", () => {
  it("classifies a county tax disbursement", () => {
    expect(classifyDisbursement("Property Tax Payment", "Wayne County Treasurer")).toBe("TAX");
  });

  it("classifies an insurance disbursement", () => {
    expect(classifyDisbursement("Homeowners Insurance Premium", "State Farm")).toBe("INSURANCE");
  });

  it("classifies an HOI abbreviation as insurance", () => {
    expect(classifyDisbursement("HOI renewal", null)).toBe("INSURANCE");
  });

  it("falls back to OTHER when neither keyword matches", () => {
    expect(classifyDisbursement("Servicing Fee", "SGMS")).toBe("OTHER");
  });

  it("handles null description and payee", () => {
    expect(classifyDisbursement(null, null)).toBe("OTHER");
  });
});
