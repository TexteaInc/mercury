import { Button } from "@/components/ui/button"
import { Window } from "@/components/ui/window"
import { useToast } from "@/hooks/use-toast"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import { useTrackedIndexStore } from "@/store/useIndexStore"
import { useTrackedUserStore } from "@/store/useUserStore"
import { useCallback, useEffect } from "react"
import EntryList from "./entry-list"

export default function Sidebar() {
  const editorStore = useTrackedEditorStore()
  const indexStore = useTrackedIndexStore()
  const userStore = useTrackedUserStore()
  const { toast } = useToast()

  const handleRefresh = useCallback(async () => {
    editorStore.fetchHistory(userStore.accessToken, indexStore.index).catch((e) => {
      console.warn(e)
      toast({
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
      })
    })
  }, [userStore.accessToken, indexStore.index])

  useEffect(() => {
    handleRefresh()
  }, [userStore.accessToken, indexStore.index])

  return (
    <Window name="Annotations" noPadding action={<Button onClick={handleRefresh} variant="ghost">Refresh</Button>}>
      <EntryList />
    </Window>
  )
}
