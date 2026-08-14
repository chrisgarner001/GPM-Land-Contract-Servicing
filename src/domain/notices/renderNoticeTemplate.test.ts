import { describe, expect, it } from "vitest";
import { renderNoticeTemplate } from "./renderNoticeTemplate";

describe("renderNoticeTemplate", () => {
  it("substitutes known merge fields", () => {
    expect(renderNoticeTemplate("Hi {{borrowerName}}, you owe {{amountDue}}.", { borrowerName: "Jane Doe", amountDue: "$100.00" })).toBe(
      "Hi Jane Doe, you owe $100.00."
    );
  });

  it("substitutes the same field appearing multiple times", () => {
    expect(renderNoticeTemplate("{{name}} {{name}}", { name: "X" })).toBe("X X");
  });

  it("blanks out an unknown/missing field rather than leaving the token literal", () => {
    expect(renderNoticeTemplate("Hi {{borrowerName}}, re: {{typoField}}.", { borrowerName: "Jane" })).toBe("Hi Jane, re: .");
  });

  it("tolerates extra whitespace inside the braces", () => {
    expect(renderNoticeTemplate("{{ name }}", { name: "Jane" })).toBe("Jane");
  });

  it("leaves text with no merge fields untouched", () => {
    expect(renderNoticeTemplate("No fields here.", {})).toBe("No fields here.");
  });
});
