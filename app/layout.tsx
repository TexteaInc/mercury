export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Mercury</title>
      </head>
      <body
        style={{
          padding: "1em",
          margin: "1em",
        }}
      >
        {children}
      </body>
    </html>
  )
}

