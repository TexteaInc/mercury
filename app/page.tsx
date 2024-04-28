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
import mergeArrays from "../utils/mergeArray"
import getRangeTextHandlableRange from "../utils/rangeTextNodes"
import { getAllTasksLength, getSingleTask, labelText, selectText } from "../utils/request"
import { type SectionResponse, type Task, userSectionResponse } from "../utils/types"

const labelIndexAtom = atomWithStorage("labelIndex", 0)

enum Stage {
  None = 0,
  First = 1,
}

const DISBALE_QUERY = false

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
  const [firstRange, setFirstRange] = useState<[number, number] | null>(null)
  const [rangeId, setRangeId] = useState<string | null>(null)
  const [serverSelection, setServerSelection] = useState<SectionResponse | null>(null)
  const [userSelection, setUserSelection] = useState<[number, number] | null>(null)
  const [waitting, setWaitting] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>(Stage.None)
  const registerLock = useRef(false)

  useEffect(() => {
    if (getLock.current) return
    getAllTasksLength().then(tasks => {
      setMaxIndex(tasks.all)
      getLock.current = true
    })
  }, [])

  useEffect(() => {
    getSingleTask(labelIndex)
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
    if (registerLock.current) return
    document.body.addEventListener("mouseup", event => {
      const selection = window.getSelection()
      console.log(selection)
      if (
        !selection.containsNode(document.getElementById("summary"), true) &&
        !selection.containsNode(document.getElementById("doc"), true)
      ) {
        if (userSelection !== null) {
          setUserSelection(null)
        } else {
          washHand()
        }
        return
      }

      if (selection.toString().trim() === "") {
        const target = event.target as HTMLElement
        if (target.tagName === "SPAN") {
          const span = target as HTMLSpanElement
          if (span.parentElement?.id === "summary" || span.parentElement?.id === "doc") {
            return
          }
        } else if (target.tagName === "P") {
          const p = target as HTMLParagraphElement
          if (p.id === "summary" || p.id === "doc") {
            return
          }
        } else {
          if (userSelection !== null) {
            setUserSelection(null)
          } else {
            washHand()
          }
          return
        }
      }
    })
    registerLock.current = true
  }, [userSelection])

  useEffect(() => {
    if (firstRange === null || rangeId === null) {
      setServerSelection(null)
      return
    }
    _.debounce(() => {
      if (DISBALE_QUERY) return
      setWaitting(rangeId === "summary" ? "doc" : "summary")
      selectText(labelIndex, {
        up: firstRange[0],
        bottom: firstRange[1],
        from_summary: rangeId === "summary",
      })
        .then(response => {
          setWaitting(null)
          if ("error" in response) {
            console.error(response.error)
            return
          }
          if (firstRange === null || rangeId === null) {
            setServerSelection(null)
            return
          }
          setServerSelection(response as SectionResponse)
        })
        .catch(error => {
          console.error(error)
        })
    }, 500)()
  }, [firstRange, rangeId, labelIndex])

  const washHand = () => {
    setFirstRange(null)
    setRangeId(null)
    setWaitting(null)
    setServerSelection(null)
    setStage(Stage.None)
    setUserSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const JustSliceText = (props: { text: string; startAndEndOffset: [number, number] }) => {
    const fakeResponse = userSectionResponse(
      props.startAndEndOffset[0],
      props.startAndEndOffset[1],
      rangeId === "summary",
    )
    const sliceArray = updateSliceArray(props.text, [fakeResponse])
    return sliceArray.map(slice => (
      <Text
        as="span"
        key={`slice-${slice[0]}-${slice[1]}`}
        data-mercury-label-start={slice[0]}
        data-mercury-label-end={slice[1]}
        style={{
          backgroundColor: slice[2] ? "#79c5fb" : undefined,
        }}
      >
        {props.text.slice(slice[0], slice[1] + 1)}
      </Text>
    ))
  }

  const SliceText = (props: { text: string; slices: SectionResponse; user: [number, number] | null }) => {
    const newSlices =
      props.user === null
        ? props.slices
        : mergeArrays(props.slices, userSectionResponse(props.user[0], props.user[1], rangeId === "summary"))
    const sliceArray = updateSliceArray(props.text, newSlices)
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
                    : score === 2
                      ? "#0ee96d"
                      : "#0ea5e9"
          return isBackendSlice ? (
            <Tooltip
              data-mercury-label-start={slice[0]}
              data-mercury-label-end={slice[1]}
              key={`slice-${slice[0]}-${slice[1]}`}
              backgroundColor={color}
              text={props.text.slice(slice[0], slice[1] + 1)}
              score={score}
              onYes={() => {
                if (firstRange === null || rangeId === null) return Promise.resolve()
                return labelText(labelIndex, {
                  sup: rangeId === "summary" ? slice[0] : firstRange[0],
                  sbottom: rangeId === "summary" ? slice[1] : firstRange[1],
                  dup: rangeId === "summary" ? firstRange[0] : slice[0],
                  dbottom: rangeId === "summary" ? firstRange[1] : slice[1],
                  correct: true,
                }).then(() => {})
              }}
              onNo={() => {
                if (firstRange === null || rangeId === null) return Promise.resolve()
                return labelText(labelIndex, {
                  sup: rangeId === "summary" ? slice[0] : firstRange[0],
                  sbottom: rangeId === "summary" ? slice[1] : firstRange[1],
                  dup: rangeId === "summary" ? firstRange[0] : slice[0],
                  dbottom: rangeId === "summary" ? firstRange[1] : slice[1],
                  correct: false,
                }).then(() => {})
              }}
            />
          ) : (
            <Text
              as="span"
              key={`slice-${slice[0]}-${slice[1]}`}
              data-mercury-label-start={slice[0]}
              data-mercury-label-end={slice[1]}
            >
              {props.text.slice(slice[0], slice[1] + 1)}
            </Text>
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
    const range = selection.getRangeAt(0)
    switch (stage) {
      case Stage.None: {
        if (
          range.intersectsNode(element) &&
          range.startContainer === range.endContainer &&
          range.startContainer === element.firstChild &&
          range.startOffset !== range.endOffset
        ) {
          setFirstRange([range.startOffset, range.endOffset])
          setUserSelection(null)
          setRangeId(element.id)
        }
        if (selection.containsNode(element, false)) {
          setFirstRange([range.startOffset, element.firstChild?.textContent?.length])
          setUserSelection(null)
          setRangeId(element.id)
        }
        setStage(Stage.First)
        break
      }
      case Stage.First: {
        if (element.id === rangeId || element.parentElement?.id === rangeId) {
          setFirstRange(getRangeTextHandlableRange(range))
          setUserSelection(null)
        } else {
          setUserSelection(getRangeTextHandlableRange(range))
        }
        break
      }
    }
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <Title1>Mercury Label</Title1>
      <br />
      <Field validationMessage={`${labelIndex + 1} / ${maxIndex}`} validationState="none">
        <ProgressBar value={labelIndex + 1} max={maxIndex} thickness="large" />
      </Field>
      <br />
      <Button onClick={washHand}>Wash Hand</Button>
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
            washHand()
            setLabelIndex(labelIndex - 1)
          }}
        >
          Previous
        </Button>
        <Button
          disabled={labelIndex === maxIndex - 1}
          onClick={() => {
            washHand()
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
              color: waitting === "doc" ? "gray" : "black",
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
              as="p"
              data-mercury-label-start={0}
              data-mercury-label-end={currentTask.doc.length}
              onMouseUp={event => {
                checkSelection(event.target as HTMLSpanElement)
              }}
            >
              {serverSelection !== null && serverSelection.length > 0 && rangeId === "summary" ? (
                <SliceText text={currentTask.doc} slices={serverSelection} user={userSelection} />
              ) : rangeId === "doc" ? (
                <JustSliceText text={currentTask.doc} startAndEndOffset={firstRange} />
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
              color: waitting === "summary" ? "gray" : "black",
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
              as="p"
              data-mercury-label-start={0}
              data-mercury-label-end={currentTask.sum.length}
              onMouseUp={event => {
                checkSelection(event.target as HTMLSpanElement)
              }}
            >
              {serverSelection !== null && rangeId === "doc" ? (
                <SliceText text={currentTask.sum} slices={serverSelection} user={userSelection} />
              ) : rangeId === "summary" ? (
                <JustSliceText text={currentTask.sum} startAndEndOffset={firstRange} />
              ) : (
                currentTask.sum
              )}
            </Text>
          </Card>
        </div>
      )}
    </FluentProvider>
  )
}
