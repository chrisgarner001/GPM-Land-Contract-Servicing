import { config } from "dotenv";
import { computeMonthlyPaymentCents, generateSchedule } from "../src/domain/amortization/generateSchedule";

async function main() {
  // Loaded via dynamic import, after dotenv config runs below — a static
  // top-level import would be hoisted ahead of config() and see an empty env.
  config({ path: ".env.local" });
  const { db } = await import("../src/db/client");
  const { parties, properties } = await import("../src/db/schema/parties");
  const { contracts, contractParties } = await import("../src/db/schema/contracts");
  const { amortizationScheduleVersions, scheduledPayments } = await import("../src/db/schema/amortization");

  // Anonymized stand-in for a real TMO contract, used to validate the schedule
  // against TMO's own amortization export before trusting real data.
  const principalCents = 95_000_00;
  const annualRatePercent = 7.5;
  const amortizationTermMonths = 180;
  const originationDate = "2026-02-01";
  const firstPaymentDate = "2026-03-01";
  const paymentAmountCents = computeMonthlyPaymentCents(principalCents, annualRatePercent, amortizationTermMonths);

  const scheduleRows = generateSchedule({
    principalCents,
    annualRatePercent,
    paymentAmountCents,
    amortizationTermMonths,
    numberOfPayments: amortizationTermMonths,
    firstPaymentDate,
  });

  await db.transaction(async (tx) => {
    const [buyer] = await tx
      .insert(parties)
      .values({
        partyType: "INDIVIDUAL",
        displayName: "Sample Buyer",
        firstName: "Sample",
        lastName: "Buyer",
      })
      .returning();

    const [seller] = await tx
      .insert(parties)
      .values({
        partyType: "INDIVIDUAL",
        displayName: "Sample Seller",
        firstName: "Sample",
        lastName: "Seller",
      })
      .returning();

    const [property] = await tx
      .insert(properties)
      .values({
        streetAddress: "123 Sample St",
        city: "Sampletown",
        state: "MI",
        zip: "48000",
        county: "Sample County",
        parcelNumber: "00-000-000",
      })
      .returning();

    const [contract] = await tx
      .insert(contracts)
      .values({
        contractNumber: "SAMPLE-0001",
        propertyId: property.id,
        purchasePriceCents: principalCents + 5_000_00,
        downPaymentCents: 5_000_00,
        originalPrincipalCents: principalCents,
        currentPrincipalBalanceCents: principalCents,
        interestRateAnnual: annualRatePercent.toFixed(4),
        amortizationTermMonths,
        paymentAmountCents,
        originationDate,
        firstPaymentDate,
        status: "ACTIVE",
      })
      .returning();

    await tx.insert(contractParties).values([
      { contractId: contract.id, partyId: buyer.id, role: "BUYER" },
      { contractId: contract.id, partyId: seller.id, role: "SELLER" },
    ]);

    const [scheduleVersion] = await tx
      .insert(amortizationScheduleVersions)
      .values({
        contractId: contract.id,
        versionNumber: 1,
        effectiveDate: originationDate,
        reason: "ORIGINATION",
        principalBalanceAtStartCents: principalCents,
        interestRateAnnual: annualRatePercent.toFixed(4),
        amortizationTermMonths,
        numberOfPayments: amortizationTermMonths,
        paymentAmountCents,
      })
      .returning();

    await tx.insert(scheduledPayments).values(
      scheduleRows.map((row) => ({
        scheduleVersionId: scheduleVersion.id,
        periodNumber: row.periodNumber,
        dueDate: row.dueDate,
        beginningBalanceCents: row.beginningBalanceCents,
        scheduledInterestCents: row.scheduledInterestCents,
        scheduledPrincipalCents: row.scheduledPrincipalCents,
        scheduledTotalCents: row.scheduledTotalCents,
        endingBalanceCents: row.endingBalanceCents,
      }))
    );

    console.log(`Seeded contract ${contract.contractNumber} (id: ${contract.id}) with ${scheduleRows.length} scheduled payments.`);
    console.log(`View it at /contracts/${contract.id}`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
