import type { SectionResponse, ServerSection } from "./types"

export function processServerSection(section: SectionResponse, text_type: "text1" | "text2") {
  const indexedSection = section
    .filter(section => section.text_type === text_type)
    .map((s, i) => ({ ...s, index: i } as ServerSection),
    )

  return indexedSection
    .sort((a, b) => a.offset - b.offset)
}
