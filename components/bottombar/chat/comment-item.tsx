import type { Comment } from "@/utils/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
        <div className="mx-2 flex-grow">
          <div className="flex items-start w-full gap-2">
            <div className="font-semibold flex-shrink-0">{comment.username}</div>
            <div className="hitespace-pre-wrap flex flex-col gap-2">
              <div className="flex items-center">
                {isEditing
                  ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          onSaveEdit()
                        }}
                        className="flex items-center"
                      >
                        <Textarea
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
                      </>
                    )}
              </div>
              <div className="text-sm text-gray-500 flex items-center">
                {new Date(comment.comment_time).toLocaleString()}
                {comment.user_id === currentUserId && (
                  <button
                    onClick={() => onEdit(comment.comment_id)}
                    className="ml-2 flex items-center text-xs opacity-50 hover:opacity-100"
                  >
                    <Pencil size={12} className="mr-1" />
                    {" "}
                    Edit
                  </button>
                )}
                <button
                  onClick={() => onReply(comment.comment_id)}
                  className="ml-2 text-blue-800 flex items-center text-xs opacity-50 hover:opacity-100"
                >
                  <MessageSquare size={12} className="mr-1" />
                  {" "}
                  Reply
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
