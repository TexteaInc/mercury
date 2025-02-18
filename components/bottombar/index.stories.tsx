import type { Comment, CommentData } from "@/utils/types"
import type { Meta, StoryObj } from "@storybook/react"
import { useTrackedLabelsStore } from "@/store/useLabelsStore"
import { fn } from "@storybook/test"
import { useState } from "react"
import BottomBar from "./index"

function BottomBarWithState(args: any) {
  const [labelData, setLabelData] = useState<string[]>([])
  const [noteData, setNoteData] = useState<string>("")
  const [comments, setComments] = useState<Comment[]>([
    {
      comment_id: 1,
      user_id: "1",
      username: "Alice",
      annot_id: 1,
      parent_id: null,
      text: "Hello, world!",
      comment_time: "2021-01-01T00:00:00Z",
    },
  ])

  function onSubmitChat(comment: CommentData) {
    const newComment = {
      ...comment,
      comment_id: comments.length + 1,
      comment_time: new Date().toISOString(),
      user_id: "2",
      username: "Bob",
    } as Comment
    setComments([...comments, newComment])
  }

  function onEdit(id: number, comment: CommentData) {
    setComments(comments.map(c => (c.comment_id === id ? { ...c, text: comment.text } : c)))
  }

  return (
    <div>
      <div className="h-64">
        <BottomBar {...args} onConsistentChange={setLabelData} onNoteChange={setNoteData} onSubmitChat={onSubmitChat} onEditMessage={onEdit} labelId={1} comments={comments} />
      </div>
      <div className="mt-4">
        <h3>Selected Labels:</h3>
        <pre>{JSON.stringify(labelData, null, 2)}</pre>
      </div>
      <div className="mt-4">
        <h3>Note:</h3>
        <pre>{JSON.stringify(noteData, null, 2)}</pre>
      </div>
    </div>
  )
}

const meta: Meta<typeof BottomBar> = {
  component: BottomBar,
  render: BottomBarWithState,
  decorators: [
    (Story) => {
      const labelsStore = useTrackedLabelsStore()
      labelsStore.setCandidates([
        "Questionable",
        "Benign",
        {
          Unwanted: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
        {
          Unwanted1: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
        {
          Unwanted2: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
      ])
      return <Story />
    },
  ],
  args: {
    onSubmitLabel: fn(),
    onDeleteLabel: fn(),
    onResetEditor: fn(),
    onSubmitChat: fn(),
    onEditMessage: fn(),
  },
}

export default meta
type Story = StoryObj<typeof BottomBar>

export const Primary: Story = {
  args: {
    initialConsistent: [
      "Questionable",
      "Benign",
      "Unwanted1.Extrinsic",
      "Unwanted2.Instrinsic",
    ],
    initialNote: "This is a note",
    type: "editing",
  },
}
