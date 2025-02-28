function getRangeTextHandleableRange(range: Range): [number, number] {
  let start = range.startContainer
  let end = range.endContainer

  const startOffset = range.startOffset
  const endOffset = range.endOffset

  if (start.nodeType === Node.TEXT_NODE) {
    start = start.parentElement
  }

  if (end.nodeType === Node.TEXT_NODE) {
    end = end.parentElement
  }

  if (start === end && start.nodeName === "P") {
    return [
      Number.parseInt((start as HTMLElement).getAttribute("data-mercury-label-start")),
      Number.parseInt((start as HTMLElement).getAttribute("data-mercury-label-end")),
    ]
  }

  const startNodeLabelStart = Number.parseInt((start as HTMLElement).getAttribute("data-mercury-label-start"))
  const endNodeLabelStart = Number.parseInt((end as HTMLElement).getAttribute("data-mercury-label-start"))
  return [startOffset + startNodeLabelStart, endOffset + endNodeLabelStart]
}

export default getRangeTextHandleableRange
