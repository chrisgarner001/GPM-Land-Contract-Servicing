"use client";

import LogInAsNewWindowButton from "../../_components/LogInAsNewWindowButton";
import { logInAsLenderAction } from "../actions";

export default function LogInAsButton({ lenderId }: { lenderId: string }) {
  return (
    <LogInAsNewWindowButton
      action={() => logInAsLenderAction(lenderId)}
      portalUrl={`/online-portals/lenders?as=${lenderId}`}
    />
  );
}
