import { useEditorStore } from "@/store/useEditorStore"
import { useTrackedTaskStore } from "@/store/useTaskStore"
import { useTrackedUserStore } from "@/store/useUserStore"
import { generateUserColor } from "@/utils/color"
import { useEffect, useMemo, useState } from "react"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import Entry from "./entry"

export default function EntryList() {
  const editorStore = useEditorStore()
  const userStore = useTrackedUserStore()
  const taskStore = useTrackedTaskStore()

  function handleStateChange(recordId: number, active: boolean) {
    editorStore.setActive(recordId, active)
  }

  const [showYours, setShowYours] = useState(true)
  const [showOthers, setShowOthers] = useState(true)

  const yours = useMemo(() => {
    return editorStore.history.filter(label => label.user_id === userStore.user.id)
  }, [editorStore.history, userStore.user])

  const others = useMemo(() => {
    return editorStore.history.filter(label => label.user_id !== userStore.user.id)
  }, [editorStore.history, userStore.user])

  const visible = useMemo(() => {
    return [
      ...(showYours ? yours : []),
      ...(showOthers ? others : []),
    ]
  }, [showYours, showOthers, yours, others])

  useEffect(() => {
    editorStore.setActiveBatch(yours.map(label => label.record_id), showYours)
    editorStore.setActiveBatch(others.map(label => label.record_id), showOthers)
  }, [showYours, showOthers, yours, others])

  return (
    <div>
      <div className="border-slate-200 flex flex-col items-start p-2 border-b gap-2">
        <div className="flex items-center gap-2">
          <Switch id="yours" checked={showYours} onCheckedChange={setShowYours} />
          <Label htmlFor="yours">Show yours</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="others" checked={showOthers} onCheckedChange={setShowOthers} />
          <Label htmlFor="others">Show others</Label>
        </div>
      </div>
      {visible.map((label) => {
        const color = generateUserColor(label.user_id, label.record_id)
        const texts = []
        const sourceText = label.source_end !== -1 ? taskStore.current?.doc.slice(label.source_start, label.source_end) : ""
        if (sourceText) {
          texts.push(`${sourceText.slice(0, Math.min(sourceText.length, 20))}...`)
        }
        const targetText = label.summary_end !== -1 ? taskStore.current?.sum.slice(label.summary_start, label.summary_end) : ""
        if (targetText) {
          texts.push(`${targetText.slice(0, Math.min(targetText.length, 20))}...`)
        }
        const text = texts.join(" -> ")
        return (
          <Entry
            key={label.record_id}
            username={label.username}
            hslColor={color}
            onStateChange={active => handleStateChange(label.record_id, active)}
            onSelect={() => editorStore.setViewing(label)}
            text={text}
          />
        )
      })}
    </div>
  )
}
