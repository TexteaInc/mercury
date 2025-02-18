import { Button } from "@/components/ui/button"
import { Window } from "@/components/ui/window"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import { useTrackedUserStore } from "@/store/useUserStore"
import { useMemo } from "react"

interface ActionsProps {
  onSubmit: () => void
  onDelete: () => void
  onReset: () => void
  type: "editing" | "viewing"
}

export default function Actions({ onSubmit, onDelete, onReset, type }: ActionsProps) {
  const editorStore = useTrackedEditorStore()
  const userStore = useTrackedUserStore()

  const deletable = useMemo(() => {
    return editorStore.viewing?.user_id === userStore.user.id
  }, [editorStore.viewing, userStore.user])

  return (
    <Window name="Actions">
      <div className="flex gap-2">
        <Button onClick={onReset} variant="outline">Reset</Button>
        {type === "editing" && (
          <>
            <Button onClick={onSubmit} variant="outline">Submit</Button>
          </>
        )}
        {type === "viewing" && (
          <>
            <Button onClick={onDelete} variant="destructive" disabled={!deletable}>Delete</Button>
          </>
        )}
      </div>
    </Window>
  )
}
