import { Button } from "@/components/ui/button"
import { useTrackedIndexStore } from "@/store/useIndexStore"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"
import { useEffect, useState } from "react"

export default function Pagination() {
  const indexStore = useTrackedIndexStore()
  const [pageInput, setPageInput] = useState<string>(String(indexStore.index + 1))
  const [isEditing, setIsEditing] = useState<boolean>(false)

  useEffect(() => {
    if (!isEditing) {
      setPageInput(String(indexStore.index + 1))
    }
  }, [indexStore.index, isEditing])

  function commitPageChange() {
    const page = Number.parseInt(pageInput, 10)
    if (!Number.isNaN(page) && page >= 1 && page <= indexStore.max + 1) {
      indexStore.setIndex(page - 1)
    } else {
      setPageInput(String(indexStore.index + 1))
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPageInput(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commitPageChange()
      setIsEditing(false)
    } else if (e.key === "Escape") {
      setPageInput(String(indexStore.index + 1))
      setIsEditing(false)
    }
  }

  return (
    <div className="flex gap-4">
      <Button disabled={indexStore.index === 0} onClick={indexStore.previous} variant="outline" size="icon">
        <IconArrowLeft />
      </Button>
      <div className="flex items-center gap-1">
        {isEditing
          ? (
              <input
                type="text"
                value={pageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  commitPageChange()
                  setIsEditing(false)
                }}
                className="w-12 text-center border rounded"
                autoFocus
              />
            )
          : (
              <span
                onClick={() => setIsEditing(true)}
                className="cursor-pointer border rounded px-1 hover:bg-gray-100"
              >
                {pageInput}
              </span>
            )}
        <span>
          {" "}
          /
          {" "}
          {indexStore.max + 1}
        </span>
      </div>
      <Button disabled={indexStore.index === indexStore.max} onClick={indexStore.next} variant="outline" size="icon">
        <IconArrowRight />
      </Button>
    </div>
  )
}
