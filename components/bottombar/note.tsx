import { Textarea } from "@/components/ui/textarea"

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
    <div>
      <Textarea
        placeholder="Note"
        onChange={e => onNoteChange(e.target.value)}
        disabled={disabled}
        defaultValue={initialNote}
      />
    </div>
  )
}
