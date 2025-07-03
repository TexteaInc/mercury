import type { SelectionRequest } from "@/utils/types"
import { Window } from "@/components/ui/window"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import { useTrackedLabelsStore } from "@/store/useLabelsStore"
import { generateUserColor, getServerColor } from "@/utils/color"
import { IconLoader } from "@tabler/icons-react"
import rangy from "rangy"
import { useCallback, useImperativeHandle, useMemo, useState } from "react"
import Highlight from "./highlight"
import "rangy/lib/rangy-textrange"

interface EditorPanelProps {
  docType: "text1" | "text2"
  type: "editing" | "viewing"
  text: string
  pending: boolean
  onSelectionChange: (selection: SelectionRequest | null) => void
  ref: React.RefObject<EditorPanelRef>
}

export interface EditorPanelRef {
  setSelection: (selection: SelectionRequest | null) => void
  reset: () => void
}

export default function EditorPanel({ docType, type, text, pending, onSelectionChange, ref }: EditorPanelProps) {
  const editorStore = useTrackedEditorStore()
  const labelsStore = useTrackedLabelsStore()
  const [selection, setSelection] = useState<SelectionRequest | null>(null)

  const handleMouseUp = useCallback(() => {
    if (typeof window === "undefined")
      return
    const rangySelection = rangy.getSelection()
    if (!rangySelection || rangySelection.rangeCount <= 0)
      return
    if (type === "viewing")
      return
    const range = rangySelection.getRangeAt(0)

    if (range.toString().trim() === "") {
      setSelection(null)
      return
    }

    const element = document.getElementById(docType) as HTMLElement
    const { start, end } = range.toCharacterRange(element)

    const selection = {
      start,
      end,
      text_type: docType,
    }
    setSelection(selection)
    onSelectionChange(selection)

    window.getSelection()?.empty()
  }, [docType, type, onSelectionChange])

  const handleClick = useCallback((start: number, end: number) => {
    if (type === "viewing")
      return
    const selection = {
      start,
      end,
      text_type: docType,
    }
    setSelection(selection)
    onSelectionChange(selection)
  }, [docType, type, onSelectionChange])

  const highlights = useMemo(() => {
    if (selection !== null) {
      return [{
        start: selection.start,
        end: selection.end,
        color: "hsl(204.92, 94.2%, 72.94%)",
      }]
    }
    if (pending || editorStore.editing) {
      return []
    }
    if (editorStore.serverSection.length > 0) {
      return editorStore.serverSection
        .filter(section => section.text_type === docType)
        .map(section => ({
          start: section.offset,
          end: section.offset + section.len,
          color: getServerColor(section.score),
          score: section.score,
        }))
    }
    if (editorStore.viewing) {
      const start = docType === "text1" ? editorStore.viewing.text1_start : editorStore.viewing.text2_start
      const end = docType === "text1" ? editorStore.viewing.text1_end : editorStore.viewing.text2_end
      return [{
        start,
        end,
        color: generateUserColor(editorStore.viewing.user_id, editorStore.viewing.record_id),
      }]
    }
    if (Object.keys(editorStore.activeList).length > 0) {
      return Object.entries(editorStore.activeList)
        .filter(([_key, value]) => value)
        .reduce((acc, [key, _value]) => {
          const label = editorStore.history.find(label => label.record_id === Number.parseInt(key))
          if (!label) {
            return acc
          }

          if (docType === "text2") {
            return [...acc, {
              start: label.text2_start,
              end: label.text2_end,
              color: generateUserColor(label.user_id, label.record_id),
            }]
          }

          return [...acc, {
            start: label.text1_start,
            end: label.text1_end,
            color: generateUserColor(label.user_id, label.record_id),
          }]
        }, [])
    }
    return []
  }, [selection, pending, editorStore.editing, editorStore.serverSection, editorStore.viewing, editorStore.activeList, editorStore.history, docType])

  useImperativeHandle(ref, () => {
    return {
      setSelection: (selection: SelectionRequest | null) => {
        setSelection(selection)
        onSelectionChange(selection)
      },
      reset: () => {
        setSelection(null)
        onSelectionChange(null)
      },
    }
  })

  return (
    <Window name={labelsStore.titles[docType === "text1" ? 0 : 1]}>
      <div className="relative w-full h-full">
        {pending && (
          <div className="flex justify-center items-center absolute inset-0 z-10">
            <IconLoader className="animate-spin" />
          </div>
        )}
        <Highlight text={text} highlights={highlights} onMouseUp={handleMouseUp} id={docType} pending={pending} clickable={type === "editing"} onClick={handleClick} />
      </div>
    </Window>
  )
}
