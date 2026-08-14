import { createClient } from "@/lib/supabase/server";
import { isSuperUser } from "@/lib/superUser";
import NewCustomizationWizard from "./_components/NewCustomizationWizard";

export default async function NewCustomizationRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isSuperUser(user?.email))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-slate-500">Not authorized.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">New Customization Request</h1>
      <p className="mb-6 text-sm text-slate-500">Describe what you'd like changed or added — the agent will ask questions before drafting.</p>
      <NewCustomizationWizard />
    </main>
  );
}
