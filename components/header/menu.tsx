import { Button } from "@/components/ui/button"

import { ButtonGroup } from "@/components/ui/button-group"
import { useToast } from "@/hooks/use-toast"
import { useTrackedEditorStore } from "@/store/useEditorStore"
import { useTrackedIndexStore } from "@/store/useIndexStore"
import { useTrackedUserStore } from "@/store/useUserStore"
import { exportFullLabels, exportLabel } from "@/utils/request"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"

export default function Menu() {
  const editorStore = useTrackedEditorStore()
  const userStore = useTrackedUserStore()
  const indexStore = useTrackedIndexStore()

  const { toast } = useToast()

  return (
    <div>
      <ButtonGroup>
        <Button variant="outline" onClick={() => editorStore.setWantToReset(true)}>Reset highlight</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="-rounded-md">
            <Button variant="outline">Export labels</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                if (!userStore.accessToken) {
                  return
                }
                exportLabel(userStore.accessToken).then((labels) => {
                  const blob = new Blob([JSON.stringify(labels, null, 2)], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = "labels.json"
                  a.click()
                })
              }}
            >
              Export own labels
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                exportFullLabels().then((labels) => {
                  const blob = new Blob([JSON.stringify(labels, null, 2)], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = "all_labels.json"
                  a.click()
                })
              }}
            >
              Export all labels
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          onClick={() => {
            const url = `${window.location.protocol}//${window.location.host}/?sample=${indexStore.index}`
            navigator.clipboard.writeText(url)
              .then(() => {
                toast({
                  title: "Copied to clipboard",
                })
              })
              .catch(() => {
                toast({
                  title: "Failed to copy to clipboard",
                })
              })
          }}
        >
          Share
        </Button>
      </ButtonGroup>
    </div>
  )
}
