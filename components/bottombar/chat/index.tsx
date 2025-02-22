import type { Comment, CommentData } from "@/utils/types"
import { Button } from "@/components/ui/button"
import { Window } from "@/components/ui/window"
import { useTrackedUserStore } from "@/store/useUserStore"
import { useState } from "react"
import CommentForm from "./comment-form"
import CommentList from "./comment-list"

interface ChatProps {
  labelId: number | null
  comments: Comment[]
  onSubmit: (comments: CommentData) => void
  onEdit: (id: number, comment: CommentData) => void
  onRefresh: () => void
  disabled?: boolean
}

export default function Chat({ labelId, comments, onSubmit, onEdit, onRefresh, disabled = false }: ChatProps) {
  const [newComment, setNewComment] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const userStore = useTrackedUserStore()

  const handleSendComment = () => {
    if (newComment.trim() !== "") {
      const parentComment = comments.find(c => c.comment_id === replyingTo)
      let text = newComment
      if (parentComment) {
        text = `> ${parentComment.username}: ${parentComment.text.substring(0, 50)}${parentComment.text.length > 50 ? "..." : ""}\n\n${newComment}`
      }
      const newCommentObj: CommentData = {
        annot_id: labelId,
        parent_id: replyingTo,
        text,
      }
      onSubmit(newCommentObj)
      setNewComment("")
      setReplyingTo(null)
    }
  }

  const handleEditComment = (id: number) => {
    const commentToEdit = comments.find(c => c.comment_id === id)
    if (commentToEdit) {
      setEditingId(id)
      setEditText(commentToEdit.text)
    }
  }

  const handleSaveEdit = () => {
    if (editingId !== null) {
      onEdit(editingId, { annot_id: labelId, parent_id: null, text: editText })
      setEditingId(null)
      setEditText("")
    }
  }

  return (
    <Window name="Chat" action={<Button onClick={onRefresh} variant="ghost">Refresh</Button>}>
      <div className="w-full flex flex-col bg-background h-full">
        <div className="flex-1 overflow-y-auto h-full">
          <CommentList
            comments={comments}
            onReply={setReplyingTo}
            onEdit={handleEditComment}
            editingId={editingId}
            editText={editText}
            onEditChange={setEditText}
            onSaveEdit={handleSaveEdit}
            currentUserId={userStore.user.id}
          />
        </div>
        <div className="border-t pt-4">
          <CommentForm
            newComment={newComment}
            onCommentChange={setNewComment}
            onSubmit={handleSendComment}
            onCancel={() => setReplyingTo(null)}
            isReplying={replyingTo !== null}
            disabled={disabled}
          />
        </div>
      </div>
    </Window>
  )
}
