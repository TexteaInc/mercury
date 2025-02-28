import type { Comment } from "@/utils/types"
import CommentItem from "./comment-item"

interface CommentListProps {
  comments: Comment[]
  onReply: (commentId: number) => void
  onEdit: (commentId: number) => void
  editingId: number | null
  editText: string
  onEditChange: (text: string) => void
  onSaveEdit: () => void
  currentUserId: string
}

export default function CommentList({
  comments,
  onReply,
  onEdit,
  editingId,
  editText,
  onEditChange,
  onSaveEdit,
  currentUserId,
}: CommentListProps) {
  return (
    <div className="h-full pr-4 overflow-y-auto">
      {comments.map(comment => (
        <CommentItem
          key={comment.comment_id}
          comment={comment}
          onReply={onReply}
          onEdit={onEdit}
          isEditing={editingId === comment.comment_id}
          editText={editText}
          onEditChange={onEditChange}
          onSaveEdit={onSaveEdit}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}
