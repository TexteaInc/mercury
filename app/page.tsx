"use client"

import {
  Body1,
  Button,
  Card,
  CardHeader,
  Field,
  FluentProvider,
  ProgressBar,
  Text,
  Title1,
  webLightTheme,
} from "@fluentui/react-components"
import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import _ from "lodash"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Tooltip from "../components/tooltip"
import { getAllTasksLength, getSingleTask, labelText, selectText } from "../utils/request"
import type { SectionResponse, Task } from "../utils/types"

const labelIndexAtom = atomWithStorage("labelIndex", 0)
const backend = "http://127.0.0.1:8000"

const updateSliceArray = (text: string, slices: SectionResponse): [number, number, boolean, number][] => {
  if (slices.length === 0) return [[0, text.length - 1, false, 0] as [number, number, boolean, number]]
  const sliceArray: [number, number, boolean, number][] = slices.map(slice => {
    return [slice.offset, slice.offset + slice.len - 1, true, slice.score]
  })
  sliceArray.sort((a, b) => a[0] - b[0])
  const newSliceArray: [number, number, boolean, number][] = []
  for (let i = 0; i < sliceArray.length; i++) {
    const currentSlice = sliceArray[i]
    if (i > 0 && currentSlice[0] > sliceArray[i - 1][1]) {
      newSliceArray.push([sliceArray[i - 1][1] + 1, currentSlice[0] - 1, false, 0])
    }
    newSliceArray.push(currentSlice)
  }
  if (sliceArray[sliceArray.length - 1][1] < text.length - 1) {
    newSliceArray.push([sliceArray[sliceArray.length - 1][1] + 1, text.length - 1, false, 0])
  }
  if (newSliceArray[0][0] !== 0) {
    newSliceArray.unshift([0, newSliceArray[0][0] - 1, false, 0])
  }

  return newSliceArray
}

export default function Index() {
  const [labelIndex, setLabelIndex] = useAtom(labelIndexAtom)
  const [maxIndex, setMaxIndex] = useState(1)
  const [currentTask, setCurrentTask] = useState<Task | null>(null)
  const getLock = useRef(false)
  const [range, setRange] = useState<[number, number] | null>(null)
  const [rangeId, setRangeId] = useState<string | null>(null)
  const [serverSelection, setServerSelection] = useState<SectionResponse | null>(null)
  const [waitting, setWaitting] = useState<string | null>(null)

  useEffect(() => {
    if (getLock.current) return
    getAllTasksLength(backend).then(tasks => {
      setMaxIndex(tasks.all)
      getLock.current = true
    })
  }, [])

  useEffect(() => {
    getSingleTask(backend, labelIndex)
      .then(task => {
        if ("doc" in task) {
          setCurrentTask(task)
        }
      })
      .catch(error => {
        setCurrentTask(null)
        console.error(error)
      })
  }, [labelIndex])

  useLayoutEffect(() => {
    document.body.addEventListener("mouseup", () => {
      const selection = window.getSelection()
      if (selection === null || selection === undefined) {
        setRange(null)
        setRangeId(null)
        return
      }
      if (selection.toString().trim() === "") {
        setRange(null)
        setRangeId(null)
        return
      }
      if (
        !selection.containsNode(document.getElementById("summary"), true) &&
        !selection.containsNode(document.getElementById("doc"), true)
      ) {
        setRange(null)
        setRangeId(null)
        return
      }
    })
  }, [])

  useEffect(() => {
    if (range === null || rangeId === null) {
      setServerSelection(null)
      return
    }
    _.debounce(() => {
      setWaitting(rangeId === "summary" ? "doc" : "summary")
      selectText(backend, labelIndex, {
        up: range[0],
        bottom: range[1],
        from_summary: rangeId === "summary",
      })
        .then(response => {
          setWaitting(null)
          if ("error" in response) {
            console.error(response.error)
            return
          }
          if (range === null || rangeId === null) {
            setServerSelection(null)
            return
          }
          setServerSelection(response as SectionResponse)
        })
        .catch(error => {
          console.error(error)
        })
    }, 500)()
  }, [range, rangeId, labelIndex])

  const SliceText = (props: { text: string; slices: SectionResponse }) => {
    const sliceArray = updateSliceArray(props.text, props.slices)
    return (
      <>
        {sliceArray.map(slice => {
          const isBackendSlice = slice[2]
          const score = slice[3]
          const color =
            0 <= score && score <= 0.2
              ? "#e0f2fe"
              : 0.2 < score && score <= 0.4
                ? "#bae6fd"
                : 0.4 < score && score <= 0.6
                  ? "#7dd3fc"
                  : 0.6 < score && score <= 0.8
                    ? "#38bdf8"
                    : "#0ea5e9"
          return isBackendSlice ? (
            <Tooltip
              backgroundColor={color}
              text={props.text.slice(slice[0], slice[1] + 1)}
              score={score}
              onYes={() => {
                if (range === null || rangeId === null) return Promise.resolve()
                return labelText(backend, labelIndex, {
                  sup: rangeId === "summary" ? slice[0] : range[0],
                  sbottom: rangeId === "summary" ? slice[1] : range[1],
                  dup: rangeId === "summary" ? range[0] : slice[0],
                  dbottom: rangeId === "summary" ? range[1] : slice[1],
                  correct: true,
                }).then(() => {})
              }}
              onNo={() => {
                if (range === null || rangeId === null) return Promise.resolve()
                return labelText(backend, labelIndex, {
                  sup: rangeId === "summary" ? slice[0] : range[0],
                  sbottom: rangeId === "summary" ? slice[1] : range[1],
                  dup: rangeId === "summary" ? range[0] : slice[0],
                  dbottom: rangeId === "summary" ? range[1] : slice[1],
                  correct: false,
                }).then(() => {})
              }}
            />
          ) : (
            <Text as="span">{props.text.slice(slice[0], slice[1] + 1)}</Text>
          )
        })}
      </>
    )
  }

  const checkSelection = (element: HTMLSpanElement) => {
    const selection = window.getSelection()
    if (selection === null || selection === undefined) return
    if (!selection.containsNode(element, true)) return
    if (selection.toString().trim() === "") return
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i)
      if (
        range.intersectsNode(element) &&
        range.startContainer === range.endContainer &&
        range.startContainer === element.firstChild &&
        range.startOffset !== range.endOffset
      ) {
        setRange([range.startOffset, range.endOffset])
        setRangeId(element.id)
        i = selection.rangeCount
      }
      if (selection.containsNode(element, false)) {
        setRange([range.startOffset, element.firstChild?.textContent?.length])
        setRangeId(element.id)
        i = selection.rangeCount
      }
    }
  }

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
        <FluentProvider theme={webLightTheme}>
          <Title1>Mercury Label</Title1>
          <br />
          <Field validationMessage={`${labelIndex + 1} / ${maxIndex}`} validationState="none">
            <ProgressBar value={labelIndex} max={maxIndex} thickness="large" />
          </Field>
          <br />
          <Button
            onClick={() => {
              setRange(null)
              setRangeId(null)
              setWaitting(null)
              setServerSelection(null)
              window.getSelection()?.removeAllRanges()
            }}
          >
            Wash Hand
          </Button>
          <br />
          <div
            style={{
              marginTop: "1em",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button
              disabled={labelIndex === 0}
              onClick={() => {
                setRange(null)
                setRangeId(null)
                setWaitting(null)
                setServerSelection(null)
                window.getSelection()?.removeAllRanges()
                setLabelIndex(labelIndex - 1)
              }}
            >
              Previous
            </Button>
            <Button
              disabled={labelIndex === maxIndex - 1}
              onClick={() => {
                setRange(null)
                setRangeId(null)
                setWaitting(null)
                setServerSelection(null)
                window.getSelection()?.removeAllRanges()
                setLabelIndex(labelIndex + 1)
              }}
            >
              Next
            </Button>
          </div>
          <br />
          {currentTask === null ? (
            <p>Loading...</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "center",
              }}
            >
              <Card
                style={{
                  flex: 1,
                  marginRight: "1em",
                  userSelect: waitting === "doc" ? "none" : "auto",
                }}
              >
                <CardHeader
                  header={
                    <Body1>
                      <strong>Doc</strong>
                    </Body1>
                  }
                />
                <Text
                  id="doc"
                  as="span"
                  onMouseUp={event => {
                    checkSelection(event.target as HTMLSpanElement)
                  }}
                >
                  {serverSelection !== null && serverSelection.length > 0 && rangeId === "summary" ? (
                    <SliceText text={currentTask.doc} slices={serverSelection} />
                  ) : (
                    currentTask.doc
                  )}
                </Text>
              </Card>
              <Card
                style={{
                  flex: 1,
                  marginLeft: "1em",
                  userSelect: waitting === "summary" ? "none" : "auto",
                }}
              >
                <CardHeader
                  header={
                    <Body1>
                      <strong>Summary</strong>
                    </Body1>
                  }
                />
                <Text
                  id="summary"
                  as="span"
                  onMouseUp={event => {
                    checkSelection(event.target as HTMLSpanElement)
                  }}
                >
                  {serverSelection !== null && rangeId === "doc" ? (
                    <SliceText text={currentTask.sum} slices={structuredClone(serverSelection)} />
                  ) : (
                    currentTask.sum
                  )}
                </Text>
              </Card>
            </div>
          )}
        </FluentProvider>
      </body>
    </html>
  )
}
