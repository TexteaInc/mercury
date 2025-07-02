import type { Comment, CommentData } from "@/utils/types"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import Chat from "./index"

function ChatWithState(args: any) {
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

  function onSubmit(comment: CommentData) {
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

  return <Chat {...args} comments={comments} labelId={1} onSubmit={onSubmit} onEdit={onEdit} />
}

const meta: Meta<typeof Chat> = {
  component: Chat,
  render: ChatWithState,
}

export default meta
type Story = StoryObj<typeof Chat>

export const Primary: Story = {
}
