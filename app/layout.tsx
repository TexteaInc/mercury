"use client"

import { Toaster } from "@/components/ui/toaster"
import "@/app/globals.css"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Mercury</title>
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            async
          />
        )}
      </head>
      <body className="h-svh w-svw">
        <div>{children}</div>
        <Toaster />
      </body>
    </html>
  )
}
