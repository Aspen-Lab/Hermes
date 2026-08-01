import { cleanDisplayText } from "@/lib/text/clean";
import type { EventOrg, EventPerson } from "@/types";
import { stripHtml } from "./shared";

export interface EventRosterDetails {
  organisations?: EventOrg[];
  people?: EventPerson[];
}

interface HeadingSection {
  html: string;
  prosePeople: boolean;
}

interface TaggedElement {
  tag: string;
  attributes: string;
  body: string;
}

const ORGANISATION_HEADING_RE =
  /\b(?:sponsors?|exhibitors?|partners?|supporters?)\b/i;
const PEOPLE_HEADING_RE =
  /\b(?:speakers?|keynotes?|presenters?|panelists?)\b/i;
const PROGRAMME_HEADING_RE = /\b(?:program(?:me)?|schedule|agenda)\b/i;
const CTA_HEADING_RE =
  /\b(?:become|opportunit(?:y|ies)|packages?|prospectus|apply)\b/i;
const PAGE_FURNITURE_ROLE_RE =
  /\b(?:navigation|banner|contentinfo|complementary)\b/i;
const PAGE_FURNITURE_NAME_RE =
  /\b(?:nav|navigation|navbar|header|masthead|footer|sidebar|menu|breadcrumb)\b/i;
const ROSTER_STOP_LABEL_RE =
  /^(?:download\s+(?:the\s+)?brochure|companies?\s+[a-z]\s*(?:-|to)\s*[a-z]|executive\s+team|mailing\s+list|request\s+(?:more\s+)?information|privacy\s+policy|contact\s+us|terms(?:\s+(?:of\s+(?:use|service)|and\s+conditions))?|site\s*map)$/i;

const ORGANISATION_CARD_RE =
  /\b(?:sponsor|exhibitor|partner|supporter|organi[sz]ation)\b.*\b(?:card|item|entry|profile)\b|\b(?:card|item|entry|profile)\b.*\b(?:sponsor|exhibitor|partner|supporter|organi[sz]ation)\b/i;
const PERSON_CARD_RE =
  /\b(?:speaker|presenter|keynote|panelist|person)\b.*\b(?:card|item|entry|profile)\b|\b(?:card|item|entry|profile)\b.*\b(?:speaker|presenter|keynote|panelist|person)\b/i;

const PERSON_NAME_FIELDS = [
  "speaker name",
  "presenter name",
  "panelist name",
  "person name",
  "name",
] as const;
const PERSON_ROLE_FIELDS = [
  "speaker role",
  "job title",
  "role",
  "position",
] as const;
const PERSON_INSTITUTION_FIELDS = [
  "speaker institution",
  "institution",
  "affiliation",
  "company",
  "organisation",
  "organization",
] as const;
const PERSON_SPEAKING_FIELDS = [
  "talk title",
  "session title",
  "presentation title",
  "speaking",
  "topic",
] as const;

const ORGANISATION_NAME_FIELDS = [
  "sponsor name",
  "exhibitor name",
  "partner name",
  "organisation name",
  "organization name",
  "name",
] as const;
const ORGANISATION_DESCRIPTOR_FIELDS = [
  "sponsor tier",
  "tier",
  "level",
  "category",
  "descriptor",
] as const;
const ORGANISATION_EVENT_FIELDS = [
  "at event",
  "booth",
  "stand",
  "location",
] as const;

function withoutHiddenContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi,
      " ",
    );
}

function displayText(html: string): string {
  return cleanDisplayText(stripHtml(html)).replace(/\s+/g, " ").trim();
}

function sectionKind(
  heading: string,
): { organisation: boolean; people: boolean; prosePeople: boolean } {
  const organisation =
    ORGANISATION_HEADING_RE.test(heading) && !CTA_HEADING_RE.test(heading);
  const prosePeople = PEOPLE_HEADING_RE.test(heading);
  const people = prosePeople || PROGRAMME_HEADING_RE.test(heading);
  return { organisation, people, prosePeople };
}

function headingSections(html: string): {
  organisations: HeadingSection[];
  people: HeadingSection[];
} {
  const headings = Array.from(
    html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi),
    (match) => ({
      level: Number(match[1]),
      title: displayText(match[2]),
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }),
  );
  const organisations: HeadingSection[] = [];
  const people: HeadingSection[] = [];

  headings.forEach((heading, index) => {
    const kind = sectionKind(heading.title);
    if (!kind.organisation && !kind.people) return;
    const next = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level);
    const body = html.slice(heading.end, next?.start ?? html.length);
    if (kind.organisation) {
      organisations.push({ html: body, prosePeople: false });
    }
    if (kind.people) {
      people.push({ html: body, prosePeople: kind.prosePeople });
    }
  });

  return { organisations, people };
}

function semanticValues(attributes: string): string[] {
  const values: string[] = [];
  for (const match of attributes.matchAll(
    /\b(?:class|itemprop|data-field|data-type)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    const raw = match[1] ?? match[2] ?? "";
    values.push(
      ...raw
        .split(/\s+/)
        .map((value) => value.toLowerCase().replace(/[-_]+/g, " ").trim())
        .filter(Boolean),
    );
  }
  const itemType = attributes.match(
    /\bitemtype\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (itemType) values.push((itemType[1] ?? itemType[2] ?? "").toLowerCase());
  return values;
}

function findElementBody(
  html: string,
  tag: string,
  contentStart: number,
): { body: string; end: number } | undefined {
  const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  token.lastIndex = contentStart;
  let depth = 1;
  for (let match = token.exec(html); match; match = token.exec(html)) {
    if (/^<\//.test(match[0])) {
      depth -= 1;
      if (depth === 0) {
        return {
          body: html.slice(contentStart, match.index),
          end: token.lastIndex,
        };
      }
    } else if (!/\/>$/.test(match[0])) {
      depth += 1;
    }
  }
  return undefined;
}

function isPageFurniture(tag: string, attributes: string): boolean {
  if (["nav", "header", "footer", "aside"].includes(tag)) return true;
  const role = attributes.match(
    /\brole\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (PAGE_FURNITURE_ROLE_RE.test(role?.[1] ?? role?.[2] ?? "")) return true;
  return PAGE_FURNITURE_NAME_RE.test(semanticValues(attributes).join(" "));
}

function withoutPageFurniture(html: string): string {
  const ranges: Array<{ start: number; end: number }> = [];
  const opening = /<(nav|header|footer|aside|div|section)\b([^>]*)>/gi;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2] ?? "";
    if (!isPageFurniture(tag, attributes)) continue;
    const found = findElementBody(html, tag, opening.lastIndex);
    if (!found) continue;
    ranges.push({ start: match.index, end: found.end });
    opening.lastIndex = found.end;
  }
  if (ranges.length === 0) return html;

  let cursor = 0;
  let visible = "";
  for (const range of ranges) {
    visible += `${html.slice(cursor, range.start)} `;
    cursor = range.end;
  }
  return visible + html.slice(cursor);
}

function taggedElements(
  html: string,
  accepts: (tag: string, attributes: string, semantics: string[]) => boolean,
): TaggedElement[] {
  const elements: TaggedElement[] = [];
  const opening = /<(article|li|div)\b([^>]*)>/gi;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1].toLowerCase();
    const attributes = match[2] ?? "";
    const semantics = semanticValues(attributes);
    if (!accepts(tag, attributes, semantics)) continue;
    const found = findElementBody(html, tag, opening.lastIndex);
    if (!found) continue;
    elements.push({ tag, attributes, body: found.body });
  }
  return elements;
}

function isCard(
  kind: "organisation" | "person",
  tag: string,
  attributes: string,
  semantics: readonly string[],
): boolean {
  const joined = semantics.join(" ");
  const entity =
    kind === "organisation"
      ? /\b(?:sponsor|exhibitor|partner|supporter|organi[sz]ation)\b/i
      : /\b(?:speaker|presenter|keynote|panelist|person)\b/i;
  if (/schema\.org\/(?:person|organization|organisation)\b/i.test(joined)) {
    return kind === "person"
      ? /schema\.org\/person\b/i.test(joined)
      : /schema\.org\/organi[sz]ation\b/i.test(joined);
  }
  if ((tag === "article" || tag === "li") && entity.test(joined)) return true;
  const cardPattern =
    kind === "organisation" ? ORGANISATION_CARD_RE : PERSON_CARD_RE;
  return cardPattern.test(`${joined} ${attributes}`);
}

function explicitField(
  html: string,
  acceptedFields: readonly string[],
): string | undefined {
  const opening = /<([a-z][\w-]*)\b([^>]*)>/gi;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1].toLowerCase();
    if (["img", "input", "meta", "br", "hr"].includes(tag)) continue;
    const semantics = semanticValues(match[2] ?? "");
    if (!semantics.some((value) => acceptedFields.includes(value))) continue;
    const found = findElementBody(html, tag, opening.lastIndex);
    if (!found) continue;
    const value = displayText(found.body);
    if (value && value.length <= 240) return value;
  }
  return undefined;
}

function fallbackMarkedTexts(html: string): string[] {
  return Array.from(
    html.matchAll(
      /<(?:h[2-6]|strong|b|a)\b[^>]*>([\s\S]*?)<\/(?:h[2-6]|strong|b|a)>/gi,
    ),
    (match) => displayText(match[1]),
  ).filter(Boolean);
}

function normalizedKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isRosterStopLabel(value: string): boolean {
  return ROSTER_STOP_LABEL_RE.test(value.replace(/\s+/g, " ").trim());
}

// Sponsor walls are grids of logo images, and their alt text is very often the
// asset filename. The North American Membrane Society page yielded a roster of
// "NSFlogo.png", "gmbh.png", "Untitled.png", "generon logo.png" and a raw UUID
// — none of which the earlier digit and punctuation checks reject. A name that
// ends in an asset extension is a file reference, never an organisation.
const ASSET_FILENAME_RE =
  /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?|pdf)$/i;
const OPAQUE_IDENTIFIER_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAssetReference(value: string): boolean {
  const name = value.replace(/\s+/g, " ").trim();
  return (
    ASSET_FILENAME_RE.test(name) ||
    OPAQUE_IDENTIFIER_RE.test(name.replace(ASSET_FILENAME_RE, ""))
  );
}

function looksLikePersonName(value: string): boolean {
  const name = value.replace(/\s+/g, " ").trim();
  if (
    !name ||
    name.length > 100 ||
    /[@/:]|\d/.test(name) ||
    isRosterStopLabel(name) ||
    isAssetReference(name)
  ) {
    return false;
  }
  if (
    /\b(?:university|institute|laborator(?:y|ies)|company|corporation|society|association|department|session|workshop)\b/i.test(
      name,
    )
  ) {
    return false;
  }
  const tokens = name.split(/\s+/);
  const withoutHonorific = tokens.filter(
    (token) => !/^(?:dr|prof|professor|mr|ms|mrs)\.?$/i.test(token),
  );
  if (withoutHonorific.length < 2 || withoutHonorific.length > 8) return false;
  if (
    /^(?:chief|senior|junior|research|director|head|keynote|panel|session|speaker)$/i.test(
      withoutHonorific[0],
    )
  ) {
    return false;
  }
  return withoutHonorific.every(
    (token) =>
      /^(?:de|da|del|van|von|bin|al)$/i.test(token) ||
      /^\p{Lu}[\p{L}\p{M}'’.-]*$/u.test(token),
  );
}

function looksLikeOrganisationName(value: string): boolean {
  const name = value.replace(/\s+/g, " ").trim();
  if (
    !name ||
    name.length > 140 ||
    /https?:|@/.test(name) ||
    isRosterStopLabel(name) ||
    isAssetReference(name)
  ) {
    return false;
  }
  if (
    /^(?:logo|sponsor|sponsors|partner|partners|exhibitor|exhibitors|supporter|supporters|gold|silver|bronze|platinum|diamond)$/i.test(
      name,
    )
  ) {
    return false;
  }
  if (
    /\b(?:become a|learn more|read more|contact us|register|apply now|opportunit(?:y|ies)|package|prospectus)\b/i.test(
      name,
    )
  ) {
    return false;
  }
  return name.split(/\s+/).length <= 14;
}

function imageAltNames(html: string): string[] {
  return Array.from(
    html.matchAll(
      /<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi,
    ),
    (match) =>
      cleanDisplayText(match[1] ?? match[2] ?? "")
        .replace(/\s+logo$/i, "")
        .trim(),
  ).filter(looksLikeOrganisationName);
}

function extractStructuredPeople(sectionHtml: string): EventPerson[] {
  return taggedElements(sectionHtml, (tag, attributes, semantics) =>
    isCard("person", tag, attributes, semantics),
  ).flatMap((card) => {
    const name =
      explicitField(card.body, PERSON_NAME_FIELDS) ??
      fallbackMarkedTexts(card.body).find(looksLikePersonName);
    if (!name || !looksLikePersonName(name)) return [];
    const role = explicitField(card.body, PERSON_ROLE_FIELDS);
    const institution = explicitField(
      card.body,
      PERSON_INSTITUTION_FIELDS,
    );
    const speaking = explicitField(card.body, PERSON_SPEAKING_FIELDS);
    return [
      {
        name,
        ...(role ? { role } : {}),
        ...(institution ? { institution } : {}),
        ...(speaking ? { speaking } : {}),
      },
    ];
  });
}

function prosePeople(sectionHtml: string): EventPerson[] {
  const markedNames = fallbackMarkedTexts(sectionHtml).filter(
    looksLikePersonName,
  );
  if (markedNames.length > 0) {
    return markedNames.map((name) => ({ name }));
  }

  const text = displayText(sectionHtml);
  const list = text.match(
    /\b(?:featured\s+)?speakers?\s+(?:include|are)\s+([^.!?]+)/i,
  )?.[1];
  if (!list) return [];
  return list
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map((name) => name.trim())
    .filter(looksLikePersonName)
    .map((name) => ({ name }));
}

function extractStructuredOrganisations(sectionHtml: string): EventOrg[] {
  return taggedElements(sectionHtml, (tag, attributes, semantics) =>
    isCard("organisation", tag, attributes, semantics),
  ).flatMap((card) => {
    const name =
      explicitField(card.body, ORGANISATION_NAME_FIELDS) ??
      imageAltNames(card.body)[0] ??
      fallbackMarkedTexts(card.body).find(looksLikeOrganisationName);
    if (!name || !looksLikeOrganisationName(name)) return [];
    const descriptor = explicitField(
      card.body,
      ORGANISATION_DESCRIPTOR_FIELDS,
    );
    const atEvent = explicitField(card.body, ORGANISATION_EVENT_FIELDS);
    return [
      {
        name,
        ...(descriptor ? { descriptor } : {}),
        ...(atEvent ? { atEvent } : {}),
      },
    ];
  });
}

function mergeOrganisations(items: readonly EventOrg[]): EventOrg[] {
  const merged: EventOrg[] = [];
  for (const item of items) {
    const existing = merged.find(
      (candidate) => normalizedKey(candidate.name) === normalizedKey(item.name),
    );
    if (!existing) {
      merged.push({ ...item });
      continue;
    }
    existing.descriptor ??= item.descriptor;
    existing.atEvent ??= item.atEvent;
  }
  return merged;
}

function mergePeople(items: readonly EventPerson[]): EventPerson[] {
  const merged: EventPerson[] = [];
  for (const item of items) {
    const existing = merged.find((candidate) => {
      if (normalizedKey(candidate.name) !== normalizedKey(item.name)) {
        return false;
      }
      return (
        !candidate.institution ||
        !item.institution ||
        normalizedKey(candidate.institution) === normalizedKey(item.institution)
      );
    });
    if (!existing) {
      merged.push({ ...item });
      continue;
    }
    existing.role ??= item.role;
    existing.institution ??= item.institution;
    existing.speaking ??= item.speaking;
  }
  return merged;
}

export function extractEventRoster(html: string): EventRosterDetails {
  const visibleHtml = withoutPageFurniture(withoutHiddenContent(html));
  const sections = headingSections(visibleHtml);
  const organisations = mergeOrganisations(
    sections.organisations.flatMap((section) => {
      const structured = extractStructuredOrganisations(section.html);
      return structured.length > 0
        ? structured
        : imageAltNames(section.html).map((name) => ({ name }));
    }),
  );
  const people = mergePeople(
    sections.people.flatMap((section) => {
      const structured = extractStructuredPeople(section.html);
      if (structured.length > 0 || !section.prosePeople) return structured;
      return prosePeople(section.html);
    }),
  );

  return {
    ...(organisations.length > 0 ? { organisations } : {}),
    ...(people.length > 0 ? { people } : {}),
  };
}
