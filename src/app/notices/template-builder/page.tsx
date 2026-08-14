import { LayoutTemplate } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";
import { NOTICES_TAB_CATEGORIES } from "../_categories";
import TemplateBuilderWizard from "./_components/TemplateBuilderWizard";

export default function TemplateBuilderPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <LayoutTemplate size={20} className="text-slate-400" aria-hidden="true" />
        Notices
      </h1>
      <p className="mb-4 text-sm text-slate-500">Draft and approve a new notice template with AI assistance.</p>
      <CategoryTabs basePath="/notices" categories={NOTICES_TAB_CATEGORIES} />

      <TemplateBuilderWizard />
    </main>
  );
}
