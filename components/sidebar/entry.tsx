import { Button } from "@/components/ui/button"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

interface EntryProps {
  username: string
  hslColor: string
  text: string
  onStateChange: (active: boolean) => void
  onSelect: () => void
}

export default function Entry({ username, hslColor: color, text, onStateChange, onSelect }: EntryProps) {
  const [active, setActive] = useState(true)

  function handleStateChange(active: boolean) {
    setActive(active)
    onStateChange(active)
  }

  return (
    <div className="border-slate-200 flex items-center px-2 border-b flex-col">
      <div className="flex justify-between w-full items-center h-10">
        <div className="flex gap-2">
          <div className="size-6 rounded-sm" style={{ backgroundColor: color }} onClick={onSelect} />
          <p>{username}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => handleStateChange(!active)} className="shadow-none">
          {active ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      <div className="flex w-full">
        <p className="text-sm text-slate-500">{text}</p>
      </div>
    </div>
  )
}
