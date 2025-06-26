interface QuotedTextProps {
  text: string
}

export default function QuotedText({ text }: QuotedTextProps) {
  return (
    <>
      {text.split("\n").map((line, index) => (
        <p key={index} className={line.startsWith(">") ? "text-gray-600 border-l-4 border-gray-400" : ""}>
          {line}
        </p>
      ))}
    </>
  )
}
