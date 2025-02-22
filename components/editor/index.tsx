import type { Comment, CommentData, LabelRequest, SelectionRequest } from "@/utils/types"
import type { EditorPanelRef } from "./panel"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useToast } from "@/hooks/use-toast"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import { useTrackedIndexStore } from "@/store/useIndexStore"
import { useTaskStore } from "@/store/useTaskStore"
import { useTrackedUserStore } from "@/store/useUserStore"
import { commitComment, deleteLabel, getComment, labelText, patchComment, patchLabel, selectText } from "@/utils/request"
import { isRequestError } from "@/utils/types"
import { produce } from "immer"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import BottomBar from "../bottombar"
import EditorPanel from "./panel"

export default function Editor() {
  const taskStore = useTaskStore()
  const editorStore = useTrackedEditorStore()
  const userStore = useTrackedUserStore()
  const indexStore = useTrackedIndexStore()
  const { toast } = useToast()

  const type = useMemo(() => {
    if (editorStore.viewing) {
      return "viewing"
    }
    return "editing"
  }, [editorStore.viewing])

  const sourceRef = useRef<EditorPanelRef>(null)
  const summaryRef = useRef<EditorPanelRef>(null)
  const [consistent, setConsistent] = useState<string[]>([])
  const [note, setNote] = useState<string>("")
  const [summaryIsPending, startRequestSummary] = useTransition()
  const [sourceIsPending, startRequestSource] = useTransition()
  const [selection, setSelection] = useState<{
    sourceSelection: SelectionRequest | null
    summarySelection: SelectionRequest | null
  }>({
    sourceSelection: null,
    summarySelection: null,
  })
  const [comments, setComments] = useState<Comment[]>([])

  const initialNote = useMemo(() => {
    if (editorStore.viewing) {
      return editorStore.viewing.note
    }
    return ""
  }, [editorStore.viewing])

  const initialConsistent = useMemo(() => {
    if (editorStore.editing) {
      if (editorStore.viewing === editorStore.editing) {
        return editorStore.viewing.consistent
      }
    }
    if (editorStore.viewing) {
      return editorStore.viewing.consistent
    }
    return []
  }, [editorStore.viewing, editorStore.history, editorStore.editing])

  async function fetchComments() {
    if (!editorStore.viewing) {
      return
    }
    try {
      const response = await getComment(editorStore.viewing.record_id)
      setComments(response)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: `There was a problem fetching comments.: ${error}`,
      })
    }
  }

  useEffect(() => {
    fetchComments()
  }, [editorStore.viewing])

  async function handleSubmitComment(comment: CommentData) {
    if (!editorStore.viewing) {
      return
    }
    try {
      await commitComment(userStore.accessToken, comment)
      toast({
        title: "Comment submitted",
        description: "Your comment has been submitted",
      })
      await fetchComments()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: `There was a problem with your request: ${error}`,
      })
    }
  }

  async function handleEditComment(id: number, comment: CommentData) {
    if (!editorStore.viewing) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
      })
      return
    }
    try {
      await patchComment(userStore.accessToken, id, comment)
      toast({
        title: "Comment updated",
        description: "Your comment has been updated",
      })
      await fetchComments()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: `There was a problem with your request: ${error}`,
      })
    }
  }

  async function handleDeleteLabel() {
    if (!editorStore.viewing) {
      toast({
        title: "Cannot delete label",
        description: "You did not select any label to delete.",
      })
      return
    }
    try {
      await deleteLabel(userStore.accessToken, editorStore.viewing.record_id)
      editorStore.setViewing(null)
      editorStore.fetchHistory(userStore.accessToken, indexStore.index).catch((e) => {
        console.warn(e)
        toast({
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        })
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: `There was a problem with your request: ${error}`,
      })
    }
  }

  function handleResetLabel() {
    sourceRef.current?.reset()
    summaryRef.current?.reset()
    editorStore.clearServerSection()
    editorStore.setViewing(null)
  }

  const handleSubmitLabel = useCallback(async () => {
    if (editorStore.viewing) {
      return
    }

    const sourceSelection = selection.sourceSelection
    const summarySelection = selection.summarySelection

    if (!sourceSelection && !summarySelection) {
      return
    }

    const labelRequest: LabelRequest = {
      summary_start: summarySelection?.start ?? -1,
      summary_end: summarySelection?.end ?? -1,
      source_start: sourceSelection?.start ?? -1,
      source_end: sourceSelection?.end ?? -1,
      consistent,
      note,
    }

    try {
      if (editorStore.editing) {
        await patchLabel(userStore.accessToken, indexStore.index, editorStore.editing.record_id, labelRequest)
        editorStore.setEditing(null)
      } else {
        await labelText(userStore.accessToken, indexStore.index, labelRequest)
      }
      handleResetLabel()
      editorStore.fetchHistory(userStore.accessToken, indexStore.index).catch((e) => {
        console.warn(e)
        toast({
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        })
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: `There was a problem with your request: ${error}`,
      })
    }
  }, [consistent, note, indexStore.index, userStore.accessToken, editorStore.viewing, selection])

  function handleSelectionChange(selection: SelectionRequest | null, docType: "source" | "summary") {
    setSelection(produce((draft) => {
      if (docType === "source") {
        draft.sourceSelection = selection
      } else {
        draft.summarySelection = selection
      }
    }))
  }

  useEffect(() => {
    if (indexStore.index !== undefined) {
      taskStore.fetch(indexStore.index).catch((e) => {
        console.warn(e)
        toast({
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        })
      })
      editorStore.fetchHistory(userStore.accessToken, indexStore.index).catch((e) => {
        console.warn(e)
        toast({
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        })
      })
      handleResetLabel()
    }
  }, [indexStore.index, userStore.accessToken])

  useEffect(() => {
    // only request server section when only one of the panel is selected
    if (selection.sourceSelection && !selection.summarySelection) {
      startRequestSummary(async () => {
        const response = await selectText(indexStore.index, selection.sourceSelection)
        if (isRequestError(response)) {
          console.error(response.error)
        } else {
          editorStore.setServerSection(response)
        }
      })
    } else if (!selection.sourceSelection && selection.summarySelection) {
      startRequestSource(async () => {
        const response = await selectText(indexStore.index, selection.summarySelection)
        if (isRequestError(response)) {
          console.error(response.error)
        } else {
          editorStore.setServerSection(response)
        }
      })
    }
  }, [selection, indexStore.index])

  const handleEditLabel = useCallback(() => {
    if (!editorStore.viewing) {
      return
    }

    editorStore.setEditing(editorStore.viewing)
    editorStore.setViewing(null)
    sourceRef.current?.setSelection({
      start: editorStore.viewing.source_start,
      end: editorStore.viewing.source_end,
      from_summary: false,
    })
    summaryRef.current?.setSelection({
      start: editorStore.viewing.summary_start,
      end: editorStore.viewing.summary_end,
      from_summary: true,
    })
  }, [editorStore.viewing])

  return (
    <ResizablePanelGroup direction="vertical">
      <ResizablePanel defaultSize={75}>
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50}>
            <EditorPanel
              docType="source"
              type={type}
              text={taskStore.current?.doc || ""}
              ref={sourceRef}
              pending={sourceIsPending}
              onSelectionChange={selection => handleSelectionChange(selection, "source")}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>
            <EditorPanel
              docType="summary"
              type={type}
              text={taskStore.current?.sum || ""}
              ref={summaryRef}
              pending={summaryIsPending}
              onSelectionChange={selection => handleSelectionChange(selection, "summary")}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25}>
        <div className="relative w-full h-full">
          {(!editorStore.viewing && !selection.sourceSelection && !selection.summarySelection)
            ? (
                <div className="flex justify-center items-center absolute inset-0 z-10 bg-white">
                  Please select a span or click a label on sidebar to view it
                </div>
              )
            : (
                <BottomBar
                  initialNote={initialNote}
                  initialConsistent={initialConsistent}
                  type={type}
                  onConsistentChange={setConsistent}
                  onNoteChange={setNote}
                  onSubmitMessage={handleSubmitComment}
                  onEditMessage={handleEditComment}
                  comments={comments}
                  onDeleteLabel={handleDeleteLabel}
                  onResetEditor={handleResetLabel}
                  onEditLabel={handleEditLabel}
                  onSubmitLabel={handleSubmitLabel}
                  onRefreshMessage={fetchComments}
                />
              )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
