import type { SectionResponse, ServerSection } from "./types"

export function processServerSection(section: SectionResponse, toDoc: boolean) {
  const indexedSection = section
    .filter(section => section.to_doc === toDoc)
    .map((s, i) => ({ ...s, index: i } as ServerSection),
    )

  return indexedSection
    .sort((a, b) => a.offset - b.offset)
}
