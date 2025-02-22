import type { Comment, CommentData } from "@/utils/types"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import Actions from "./actions"
import Chat from "./chat"
import Label from "./label"
import Note from "./note"

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
      <ResizablePanel defaultSize={20}>
        <Label initialData={initialConsistent} onResultChange={onConsistentChange} disabled={type === "viewing"} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30}>
        <Note initialNote={initialNote} onNoteChange={onNoteChange} disabled={type === "viewing"} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={20}>
        <Actions onSubmit={onSubmitLabel} onDelete={onDeleteLabel} onReset={onResetEditor} onEdit={onEditLabel} type={type} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30}>
        <Chat labelId={editorStore.viewing?.record_id} comments={comments} onSubmit={onSubmitMessage} onEdit={onEditMessage} disabled={type === "editing"} onRefresh={onRefreshMessage} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
