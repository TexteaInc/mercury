"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useTrackedUserStore } from "@/store/useUserStore"
import { login } from "@/utils/request"
import { useRouter } from "next/navigation"

export default function Login() {
  const router = useRouter()
  const { toast } = useToast()
  const userStore = useTrackedUserStore()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (email && password) {
      const accessToken = await login(email, password)
      if (accessToken) {
        userStore.setAccessToken(accessToken)
        router.push("/")
      } else {
        toast({
          title: "Login Error",
          description: "User does not exist or mismatched email and password",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-sm">
      <h1 className="text-3xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <Input id="email" name="email" type="email" required className="mt-1 block w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <Input id="password" name="password" type="password" required className="mt-1 block w-full" />
        </div>
        <Button type="submit" className="w-full">Login</Button>
      </form>
    </div>
  )
}
