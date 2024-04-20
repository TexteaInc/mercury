export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Mercury</title>
      </head>
      <body
        style={{
          margin: "0",
          height: "100vh",
        }}
      >
        <div style={{ width: "98%", padding: "1rem", margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  )
}
