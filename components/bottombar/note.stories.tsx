import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import Note from "./note"

function NoteWithState(args: any) {
  const [result, setResult] = useState<string>("")

  return (
    <div>
      <Note {...args} onNoteChange={setResult} />
      <div className="mt-4">
        <h3>Note:</h3>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>
    </div>
  )
}

const meta: Meta<typeof Note> = {
  component: Note,
  render: NoteWithState,
}

export default meta
type Story = StoryObj<typeof Note>

export const Primary: Story = {
  args: {
    initialNote: "This is a note",
  },
}
