"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useTrackedUserStore } from "@/store/useUserStore"
import { changeName } from "@/utils/request"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

export default function User() {
  const userStore = useTrackedUserStore()
  const router = useRouter()
  const { toast } = useToast()
  function handleLogout() {
    userStore.logout()
    router.push("/login")
  }

  const [name, setName] = useState(userStore.user?.name)
  const [open, setOpen] = useState(false)

  async function handleChangeName() {
    try {
      await changeName(userStore.accessToken, name)
      userStore.fetch()
      setOpen(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to change name",
        description: error.message,
      })
    }
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarFallback>{userStore.user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{userStore.user?.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DialogTrigger asChild>
              <DropdownMenuItem>Change name</DropdownMenuItem>
            </DialogTrigger>
            <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input id="username" defaultValue={userStore.user?.name} className="col-span-3" onChange={e => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleChangeName}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
