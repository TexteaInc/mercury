"use client"

import Editor from "@/components/editor"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { useTrackedIndexStore } from "../store/useIndexStore"
import { useTrackedLabelsStore } from "../store/useLabelsStore"
import { useUserStore } from "../store/useUserStore"
import { checkUserMe } from "../utils/request"

let didInit = false

function Page() {
  const indexStore = useTrackedIndexStore()
  const labelsStore = useTrackedLabelsStore()
  const userStore = useUserStore()

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    if (!didInit) {
      didInit = true

      indexStore.fetchMax().catch((e) => {
        console.warn(e)
        toast({
          title: "Fail loading index",
          description: "Please try again later.",
        })
      })

      labelsStore.fetch().catch((e) => {
        console.warn(e)
        toast({
          title: "Fail loading labels",
          description: "Please try again later.",
        })
      })

      if (searchParams.has("sample")) {
        const index = searchParams.get("sample")
        const indexNumber = Number.parseInt(index)
        if (!Number.isNaN(indexNumber) && indexNumber >= 0) {
          indexStore.setIndex(indexNumber)
        }
      }
    }

    return () => {
      didInit = false
    }
  }, [])

  useEffect(() => {
    if (window !== undefined && userStore.user.name === undefined) {
      if (userStore.accessToken === "") {
        toast({
          title: "Not logged in",
          description: "Please log in to continue.",
        })
        router.push("/login")
        return
      }
      checkUserMe(userStore.accessToken).then((valid) => {
        if (!valid) {
          localStorage.removeItem("access_token")
          toast({
            title: "Session expired",
            description: "Please log in to continue.",
          })
          router.push("/login")
        }
      })
      userStore.fetch().catch((e) => {
        console.warn(e)
        toast({
          title: "Fail loading user data",
          description: "Please try again later.",
        })
      })
    }
  }, [userStore.user])

  return (
    <div className="h-svh w-svw flex flex-col">
      <Header />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={85}>
          <Editor />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={15}>
          <Sidebar />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default function Index() {
  return (
    <Suspense>
      <Page />
    </Suspense>
  )
}
