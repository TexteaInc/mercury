import { useTrackedEditorStore } from "@/store/useEditorStore"
import Menu from "./menu"
import Pagination from "./pagination"
import User from "./user"

export default function Header() {
  const editorStore = useTrackedEditorStore()

  return (
    <div className="bg-slate-50 flex gap-3 justify-between h-16 items-center w-auto px-4">
      <div className="flex gap-3 items-center">
        <Menu />
        {editorStore.editing && (
          <p className="text-amber-600">
            Editing:
            #
            {" "}
            {editorStore.editing.record_id}
          </p>
        )}
      </div>
      <Pagination />
      <User />
    </div>
  )
}
