import type { Comment } from "@/utils/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Pencil } from "lucide-react"
import QuotedText from "./quoted-text"

interface CommentItemProps {
  comment: Comment
  onReply: (commentId: number) => void
  onEdit: (commentId: number) => void
  isEditing: boolean
  editText: string
  onEditChange: (text: string) => void
  onSaveEdit: () => void
  currentUserId: string
}

export default function CommentItem({
  comment,
  onReply,
  onEdit,
  isEditing,
  editText,
  onEditChange,
  onSaveEdit,
  currentUserId,
}: CommentItemProps) {
  return (
    <div className="mb-4">
      <div className="flex items-start">
        <Avatar className="w-8 h-8">
          <AvatarFallback>{comment.username[0]}</AvatarFallback>
        </Avatar>
        <div className="mx-2 flex-grow">
          <div className="font-semibold">{comment.username}</div>
          <div className="p-2 rounded-lg bg-gray-200 whitespace-pre-wrap">
            {isEditing
              ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      onSaveEdit()
                    }}
                    className="flex items-center"
                  >
                    <Input
                      value={editText}
                      onChange={e => onEditChange(e.target.value)}
                      className="mr-2 bg-white text-black"
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                )
              : (
                  <>
                    <QuotedText text={comment.text} />
                    {comment.user_id === currentUserId && (
                      <button
                        onClick={() => onEdit(comment.comment_id)}
                        className="ml-2 text-xs opacity-50 hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </>
                )}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {new Date(comment.comment_time).toLocaleString()}
            <button
              onClick={() => onReply(comment.comment_id)}
              className="ml-2 text-blue-500 hover:underline flex items-center"
            >
              <MessageSquare size={12} className="mr-1" />
              {" "}
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
