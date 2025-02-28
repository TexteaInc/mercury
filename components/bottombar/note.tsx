import { Textarea } from "@/components/ui/textarea"
import { Window } from "@/components/ui/window"

interface NoteProps {
  initialNote: string
  onNoteChange: (note: string) => void
  disabled?: boolean
}

export default function Note({ initialNote = "", onNoteChange, disabled = false }: NoteProps) {
  if (initialNote !== "") {
    onNoteChange(initialNote)
  }

  return (
    <Window name="Note">
      <div>
        <Textarea
          placeholder="Note"
          onChange={e => onNoteChange(e.target.value)}
          disabled={disabled}
          defaultValue={initialNote}
        />
      </div>
    </Window>
  )
}
