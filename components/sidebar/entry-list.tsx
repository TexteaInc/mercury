import { useEditorStore } from "@/store/useEditorStore"
import { generateUserColor } from "@/utils/color"
import Entry from "./entry"

export default function EntryList() {
  const editorStore = useEditorStore()

  function handleStateChange(recordId: number, active: boolean) {
    editorStore.setActive(recordId, active)
  }

  return (
    <div>
      {editorStore.history.map((label) => {
        const color = generateUserColor(label.user_id, label.record_id)
        return (
          <Entry
            key={label.record_id}
            username={label.username}
            hslColor={color}
            onStateChange={active => handleStateChange(label.record_id, active)}
            onSelect={() => editorStore.setViewing(label)}
          />
        )
      })}
    </div>
  )
}
