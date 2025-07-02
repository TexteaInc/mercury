import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface CommentFormProps {
  newComment: string
  onCommentChange: (comment: string) => void
  onSubmit: () => void
  onCancel: () => void
  isReplying: boolean
  disabled?: boolean
}

export default function CommentForm({ newComment, onCommentChange, onSubmit, onCancel, isReplying, disabled = false }: CommentFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex w-full space-x-2"
    >
      <Textarea
        value={newComment}
        onChange={e => onCommentChange(e.target.value)}
        placeholder={isReplying ? "Type your reply..." : "Type a comment..."}
        className="flex-grow min-h-9 h-9"
        disabled={disabled}
      />
      <Button type="submit" disabled={disabled}>{isReplying ? "Reply" : "Send"}</Button>
      {isReplying && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      )}
    </form>
  )
}
