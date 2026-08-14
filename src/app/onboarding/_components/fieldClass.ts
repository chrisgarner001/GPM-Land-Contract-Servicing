export const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
export const labelClass = "mb-1 block text-xs font-medium text-slate-600";

// Amber highlight for a field Import's extraction didn't find, so staff
// know at a glance what still needs a look — never applied for manual
// entry, where an empty field is just... empty, not "missing."
export function fieldClass(hasValue: unknown, highlightMissing?: boolean): string {
  return !highlightMissing || hasValue ? inputClass : `${inputClass} border-amber-400 bg-amber-50`;
}
