import type { Comment, CommentData } from "@/utils/types"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import Chat from "./chat"
import ThreeInOne from "./three-in-one"

interface BottomBarProps {
  type: "editing" | "viewing"
  initialConsistent?: Array<string>
  initialNote?: string
  onConsistentChange: (result: Array<string>) => void
  onNoteChange: (note: string) => void
  onDeleteLabel: () => void
  onEditLabel: () => void
  onResetEditor: () => void
  onSubmitLabel: () => void
  comments: Array<Comment>
  onSubmitMessage: (comment: CommentData) => void
  onEditMessage: (id: number, comment: CommentData) => void
  onRefreshMessage: () => void
}

export default function BottomBar({ initialConsistent, initialNote, onConsistentChange, onNoteChange, onSubmitLabel, onDeleteLabel, onResetEditor, type, comments, onSubmitMessage, onEditMessage, onEditLabel, onRefreshMessage }: BottomBarProps) {
  const editorStore = useTrackedEditorStore()
  return (
    <ResizablePanelGroup direction="horizontal" className="border border-slate-200">
      <ResizablePanel defaultSize={70}>
        <ThreeInOne
          type={type}
          initialConsistent={initialConsistent}
          initialNote={initialNote}
          onConsistentChange={onConsistentChange}
          onNoteChange={onNoteChange}
          onDeleteLabel={onDeleteLabel}
          onEditLabel={onEditLabel}
          onResetEditor={onResetEditor}
          onSubmitLabel={onSubmitLabel}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30}>
        {
          editorStore.viewing
            ? (
                <Chat labelId={editorStore.viewing.record_id} comments={comments} onSubmit={onSubmitMessage} onEdit={onEditMessage} disabled={type === "editing"} onRefresh={onRefreshMessage} />
              )
            : (
                <Chat labelId={null} comments={[]} onSubmit={onSubmitMessage} onEdit={onEditMessage} disabled={type === "editing"} onRefresh={onRefreshMessage} />
              )
        }
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
