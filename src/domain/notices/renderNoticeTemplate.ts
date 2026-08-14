// Simple {{mergeField}} substitution — templates are drafted by Claude using
// a known set of tags per category (see server/notices.ts), so this stays a
// plain string-replace rather than a full templating engine. An unknown tag
// (a typo, or a field that genuinely has no value for this recipient) is
// left blank rather than kept literal — a stray "{{...}}" left in a sent
// notice is a worse failure mode than a blank.
export function renderNoticeTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => fields[key] ?? "");
}
