import type { ReactElement } from "react"

interface WindowProps {
  children: ReactElement<any>
  action?: ReactElement<any>
  name: string
  noPadding?: boolean
}

export function Window({ children, action, name, noPadding = false }: WindowProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between bg-slate-100 h-9 px-4">
        <h1>{name}</h1>
        {action}
      </div>
      <div className={`flex-1 overflow-y-auto ${noPadding ? "" : "p-4"}`}>
        {children}
      </div>
    </div>
  )
}
