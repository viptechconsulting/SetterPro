import type { SearchResult } from "@/types/campaign";

export function personalizeTemplate(template: string, lead: Partial<SearchResult>): string {
  const firstName = lead.first_name ?? "there";
  const lastName = lead.last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const company = lead.company_name ?? "tu empresa";
  const headline = lead.headline ?? "";

  return template
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{full_name\}\}/gi, fullName)
    .replace(/\{\{company_name\}\}/gi, company)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{headline\}\}/gi, headline)
    .trim();
}
