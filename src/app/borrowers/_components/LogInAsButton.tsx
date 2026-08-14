"use client";

import LogInAsNewWindowButton from "../../_components/LogInAsNewWindowButton";
import { logInAsBorrowerAction } from "../actions";

export default function LogInAsButton({ contractId }: { contractId: string }) {
  return (
    <LogInAsNewWindowButton
      action={() => logInAsBorrowerAction(contractId)}
      portalUrl="/online-portals/borrowers"
    />
  );
}
