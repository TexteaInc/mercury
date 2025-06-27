import { Window } from "@/components/ui/window"
import Actions from "./actions"
import Label from "./label"
import Note from "./note"

interface ThreeInOneProps {
  type: "editing" | "viewing"
  initialConsistent?: Array<string>
  initialNote?: string
  onConsistentChange: (result: Array<string>) => void
  onNoteChange: (note: string) => void
  onDeleteLabel: () => void
  onEditLabel: () => void
  onResetEditor: () => void
  onSubmitLabel: () => void
}

export default function ThreeInOne({ type, initialConsistent, initialNote, onConsistentChange, onNoteChange, onDeleteLabel, onEditLabel, onResetEditor, onSubmitLabel }: ThreeInOneProps) {
  return (
    <Window name="Label Action">
      <div className="flex gap-2 w-full">
        <div className="flex-1">
          <Label initialData={initialConsistent} onResultChange={onConsistentChange} disabled={type === "viewing"} />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <Note initialNote={initialNote} onNoteChange={onNoteChange} disabled={type === "viewing"} />
          <Actions onSubmit={onSubmitLabel} onDelete={onDeleteLabel} onReset={onResetEditor} onEdit={onEditLabel} type={type} />
        </div>
      </div>
    </Window>
  )
}
