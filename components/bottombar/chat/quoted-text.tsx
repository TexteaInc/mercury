interface QuotedTextProps {
  text: string
  textId: number
  parentId: number
}

export default function QuotedText({ text, textId, parentId }: QuotedTextProps) {
  return (
    <div className="flex flex-col space-y-1">
      {text.split("\n").map((line, index) => (
        <p
          id={`comment-${textId}`}
          key={index}
          className={line.startsWith(">") ? "text-gray-600 bg-gray-100 p-1 rounded-md cursor-pointer" : ""}
          onClick={() => {
            const comment = document.getElementById(`comment-${parentId}`)
            if (comment) {
              comment.scrollIntoView({ behavior: "smooth" })
            }
          }}
        >
          {line}
        </p>
      ))}
    </div>
  )
}
