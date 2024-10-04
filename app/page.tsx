"use client"

import {
  Avatar,
  Body1,
  Button,
  Card,
  CardHeader,
  Field,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  ProgressBar, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow,
  Text,
  Title1
} from "@fluentui/react-components"
import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import _ from "lodash"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Tooltip from "../components/tooltip"
import { updateSliceArray } from "../utils/mergeArray"
import getRangeTextHandleableRange from "../utils/rangeTextNodes"
import {
  exportLabel,
  getTaskHistory,
  getAllTasksLength,
  getSingleTask,
  labelText,
  selectText,
  deleteRecord,
  getAllLabels,
  changeName,
  checkUserMe
} from "../utils/request"
import { type LabelData, type SectionResponse, type Task, userSectionResponse } from "../utils/types"
import {
  ArrowExportRegular,
  ArrowSyncRegular,
  ChevronLeftRegular,
  DeleteRegular,
  EyeOffRegular,
  EyeRegular,
  HandRightRegular,
  IosChevronRightRegular,
  ShareRegular
} from "@fluentui/react-icons";
import { Allotment } from "allotment"
import "allotment/dist/style.css"
import ColumnResize from "react-table-column-resizer";
import "./page.css"

const labelIndexAtom = atomWithStorage("labelIndex", 0)

enum Stage {
  None = 0,
  First = 1,
}

const DISABLE_QUERY = false

const normalizationColor = (score: number[]) => {
  if (score.length === 0) return []
  if (score.length === 1) return [1]
  const minScore = Math.min(...score)
  const maxScore = Math.max(...score)
  const normalScores = []
  for (const single of score) {
    normalScores.push((single - minScore) / (maxScore - minScore))
  }
  return normalScores
}

const colors = [
  "#c4ebff",
  "#a8e1ff",
  "#70cdff",
  "#38baff",
  "#1cb0ff",
  "#00a6ff",
]
const getColor = (score: number) => {
  return colors[Math.floor(score * (colors.length - 1))]
}


// Function to determine if a color is light or dark
const isLightColor = (color: string) => {
  // Remove the hash if present
  let newcolor = color.replace('#', '');

  // Convert 3-digit hex to 6-digit hex
  if (newcolor.length === 3) {
    newcolor = newcolor.split('').map(char => char + char).join('');
  }

  // Convert hex to RGB
  const r = Number.parseInt(newcolor.substring(0, 2), 16);
  const g = Number.parseInt(newcolor.substring(2, 4), 16);
  const b = Number.parseInt(newcolor.substring(4, 6), 16);

  // Calculate luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Return true if luminance is greater than 128 (light color)
  return luminance > 200;
};

const exportJSON = () => {
  exportLabel().then(data => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "label.json"
    a.click()
    URL.revokeObjectURL(url)
  })
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
  const [waiting, setWaiting] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>(Stage.None)
  const [history, setHistory] = useState<LabelData[]>(null)
  const [viewingRecord, setViewingRecord] = useState<LabelData | null>(null)
  const [labels, setLabels] = useState<(string | object)[]>([])
  const [userName, setUserName] = useState<string>("No Name")
  const [tempUserName, setTempUserName] = useState<string>(userName)
  const [hideName, setHideName] = useState<boolean>(true)

  const historyColumns = [
    { columnKey: "summary", label: "Summary" },
    { columnKey: "source", label: "Source" },
    { columnKey: "consistent", label: "Consistent" },
    { columnKey: "actions", label: "Actions" }
  ]

  useEffect(() => {
    if (getLock.current) return
    setUserName(localStorage.getItem("name") || "No Name")
    Promise.all([
      getAllTasksLength(), 
      getAllLabels(),
      checkUserMe(),
    ])
      .then(([tasks, labels, result]) => {
        setMaxIndex(tasks.all)
        setLabels(labels)
        setHideName(!result)
        getLock.current = true
      })
      .then(() => {
        // get query of url
        const url = new URL(window.location.href)
        const index = url.searchParams.get("sample")
        if (index !== null) {
          washHand()
          const indexNumber = Number.parseInt(index)
          if (!Number.isNaN(indexNumber) && indexNumber >= 0 && indexNumber <= maxIndex) {
            setLabelIndex(indexNumber)
          }
        }
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

  const updateHistory = () => {
    getTaskHistory(labelIndex)
        .then(data => {
          setHistory(data)
          setViewingRecord(null)
        }).catch(error => {
      setHistory(null)
      setViewingRecord(null)
      console.error(error)
    })
  }

  useEffect(updateHistory, [currentTask])

  useEffect(() => {
    if (viewingRecord === null || currentTask === null) {
      washHand()
        return
    }
    setFirstRange([viewingRecord.source_start, viewingRecord.source_end])
    setRangeId("doc")
    setServerSelection([userSectionResponse(viewingRecord.summary_start, viewingRecord.summary_end, true)])
  }, [viewingRecord])

  useLayoutEffect(() => {
    const func = (event) => {
      const selection = window.getSelection()
      const target = event.target as HTMLElement
      
      const mercuryElements = document.querySelectorAll("[data-mercury-disable-selection]")
      
      // console.log(mercuryElements)
      
      for (const element of mercuryElements) {
        if (element.contains(target)) {
          return
        }
      }
      
      if (target.id.startsWith("label-")) {
        return
      }
      
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
    }
    document.body.addEventListener("mouseup", func)
    return () => {
      document.body.removeEventListener("mouseup", func)
    }
  }, [userSelection])

  useEffect(() => {
    if (firstRange === null || rangeId === null) {
      setServerSelection(null)
      return
    }
    _.debounce(() => {
      if (DISABLE_QUERY || viewingRecord != null) return
      setWaiting(rangeId === "summary" ? "doc" : "summary")
      selectText(labelIndex, {
        start: firstRange[0],
        end: firstRange[1],
        from_summary: rangeId === "summary",
      })
        .then(response => {
          setWaiting(null)
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
    }, 100)()
  }, [firstRange, rangeId, labelIndex])

  const washHand = () => {
    setFirstRange(null)
    setRangeId(null)
    setWaiting(null)
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
    return sliceArray.map(slice => {
      return slice[3] === 2 ? (
        <Tooltip
          start={slice[0]}
          end={slice[1]}
          key={`slice-${slice[0]}-${slice[1]}`}
          backgroundColor="#79c5fb"
          textColor="black"
          text={props.text.slice(slice[0], slice[1] + 1)}
          labels={labels}
          onLabel={async (label, note) => {
            if (firstRange === null || rangeId === null) {
              return Promise.resolve()
            }
            await labelText(labelIndex, {
              source_start: rangeId === "summary" ? -1 : firstRange[0],
              source_end: rangeId === "summary" ? -1 + 1 : firstRange[1],
              summary_start: rangeId === "summary" ? firstRange[0] : -1,
              summary_end: rangeId === "summary" ? firstRange[1] : -1,
              consistent: label,
              note: note,
            })
            updateHistory()
          }}
          message="Check all types that apply below."
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
    })
  }

  const SliceText = (props: { text: string; slices: SectionResponse; user: [number, number] | null }) => {
    const newSlices =
      props.user === null
        ? props.slices
        : [userSectionResponse(props.user[0], props.user[1], rangeId === "summary")]
    const sliceArray = updateSliceArray(props.text, newSlices)
    const allScore = []
    for (const slice of newSlices) {
      allScore.push(slice.score)
    }
    const normalColor = normalizationColor(allScore)
    return (
      <>
        {sliceArray.map(slice => {
          const isBackendSlice = slice[2]
          const score = slice[3]
          const bg_color = isBackendSlice ? score === 2 ? "#85e834" : getColor(normalColor[slice[4]]) : "#ffffff"
          const textColor = isLightColor(bg_color) ? 'black' : 'white'
          // const textColor= 'red'
          return isBackendSlice && viewingRecord == null ? (
            <Tooltip
              start={slice[0]}
              end={slice[1]}
              key={`slice-${slice[0]}-${slice[1]}`}
              backgroundColor={bg_color}
              textColor={textColor}
              text={props.text.slice(slice[0], slice[1] + 1)}
              score={score}
              labels={labels}
              onLabel={async (label, note) => {
                if (firstRange === null || rangeId === null) {
                  return Promise.resolve()
                }
                await labelText(labelIndex, {
                  source_start: rangeId === "summary" ? slice[0] : firstRange[0],
                  source_end: rangeId === "summary" ? slice[1] + 1 : firstRange[1],
                  summary_start: rangeId === "summary" ? firstRange[0] : slice[0],
                  summary_end: rangeId === "summary" ? firstRange[1] : slice[1] + 1,
                  consistent: label,
                  note: note,
                })
                updateHistory()
              }}
              message="Select the type(s) of hallucinatin below."
            />
            ) : (
            <Text
              as="span"
              style={{ backgroundColor: bg_color }}
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
    if (selection.toString().trim() === "" && JSON.stringify(firstRange) !== "[-1,-1]") return
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
          setFirstRange(getRangeTextHandleableRange(range))
          setUserSelection(null)
        } else {
          setUserSelection(getRangeTextHandleableRange(range))
        }
        break
      }
    }
  }

  return (
    <>
      <Title1>Mercury Label</Title1>
      <br />
      <br />
      <div
        style={{
          display: "flex",
          gap: "1em",
        }}
      >
        {JSON.stringify(firstRange) === "[-1,-1]" || viewingRecord != null ? (
          <Button appearance="primary" icon={<HandRightRegular />} onClick={washHand}>
            De-select/highlight
          </Button>
        ) : (
          <Button icon={<HandRightRegular />} onClick={washHand}>
            De-select/highlight
          </Button>
        )}
        <Button icon={<ArrowExportRegular />} onClick={exportJSON}>
          Export Labels
        </Button>
        <Button icon={<ShareRegular />} onClick={() => {
          navigator.clipboard.writeText(
            `${window.location.origin}${window.location.pathname}?sample=${labelIndex}`
          )
        }}>
          Share Link
        </Button>
        {!hideName && (
          <Popover trapFocus>
            <PopoverTrigger disableButtonEnhancement>
              <Button icon={<Avatar size={20} name={userName} />}>
                {userName}
              </Button>
            </PopoverTrigger>
            
            <PopoverSurface>
              <div>
                <Field style={{ 
                  display: "flex",
                  flexDirection: "column",
                  gap: "1em",
                }}
              >
                  <Body1>
                    <strong>Change Name</strong>
                  </Body1>
                  <input
                    type="text"
                    value={tempUserName}
                    onChange={event => {
                      setTempUserName(event.target.value)
                    }}
                  />
                  <Button
                    appearance="primary"
                    onClick={() => {
                      changeName(tempUserName).then(() => {
                        setUserName(tempUserName)
                      })
                    }}
                  >
                    Change
                  </Button>
                </Field>
              </div>
            </PopoverSurface>
          </Popover>
        )}
        
        
        {/* <Link href="/history/" rel="noopener noreferrer" target="_blank">
          <Button icon={<HistoryRegular />}></Button>
        </Link> */}
        {/* <Button
          icon={<AddRegular />}
          onClick={() => {
            washHand()
            setFirstRange([-1, -1])
            setUserSelection(null)
            setRangeId("doc")
          }}
          disabled={JSON.stringify(firstRange) === "[-1,-1]" && rangeId === "doc"}
        >
          Select Empty Source
        </Button>
        <Button
          icon={<AddRegular />}
          onClick={() => {
            washHand()
            setFirstRange([-1, -1])
            setUserSelection(null)
            setRangeId("summary")
          }}
          disabled={JSON.stringify(firstRange) === "[-1,-1]" && rangeId === "summary"}
        >
          Select Empty Summary
        </Button> */}
      </div>
      <br />
      <div
        style={{
          marginTop: "1em",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1em",
        }}
      >
        <Button
          disabled={labelIndex === 0}
          appearance="primary"
          icon={<ChevronLeftRegular />}
          iconPosition="before"
          onClick={() => {
            washHand()
            setLabelIndex(labelIndex - 1)
          }}
        >
          Previous
        </Button>
        <Field style={{ flexGrow: 1 }} validationMessage={`${labelIndex + 1} / ${maxIndex}`} validationState="none">
          <ProgressBar value={labelIndex + 1} max={maxIndex} thickness="large" />
        </Field>
        <Button
          disabled={labelIndex === maxIndex - 1}
          appearance="primary"
          icon={<IosChevronRightRegular />}
          iconPosition="after"
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
            height: "80vh",
            margin: "auto",
          }}
        >
          <Allotment>
            <Allotment.Pane>
              <div
                style={{
                  overflowY: "scroll",
                  height: "100%",
                }}
              >
                <Card
                  style={{
                    userSelect: waiting === "doc" ? "none" : "auto",
                    color: waiting === "doc" ? "gray" : "black",
                  }}
                >
                  <CardHeader
                    header={
                      <Body1>
                        <strong>Source</strong>
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
              </div>
            </Allotment.Pane>
            <Allotment.Pane>
              <Allotment vertical>
                <div
                  style={{
                    overflowY: "scroll",
                    height: "100%",
                  }}
                >
                  <Card
                    style={{
                      userSelect: waiting === "summary" ? "none" : "auto",
                      color: waiting === "summary" ? "gray" : "black",
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
                      onMouseUp={event => checkSelection(event.target as HTMLSpanElement)}
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
                <div
                  style={{
                    overflowY: "scroll",
                    height: "100%",
                  }}
                >
                  <Card>
                    <CardHeader
                      header={
                        <Body1>
                          <strong>Existing annotations</strong>
                          <Button icon={<ArrowSyncRegular />} style={{ marginLeft: "1em" }} onClick={updateHistory}>
                            Refresh
                          </Button>
                        </Body1>
                      }
                    />
                    {history === null ? (
                      <p>Loading...</p>
                    ) : (
                      <Table className="column_resize_table">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell key="source">Source</TableHeaderCell>
                            {/* @ts-ignore */}
                            <ColumnResize id={1} className="columnResizer" />
                            <TableHeaderCell key="summary">Summary</TableHeaderCell>
                            {/* @ts-ignore */}
                            <ColumnResize id={2} className="columnResizer" />
                            <TableHeaderCell key="consistent">Label(s)</TableHeaderCell>
                            {/* @ts-ignore */}
                            <ColumnResize id={3} className="columnResizer" /> 
                            <TableHeaderCell key="note">Note</TableHeaderCell>
                            {/* @ts-ignore */}
                            <ColumnResize id={4} className="columnResizer" /> 
                            {/* TODO: Display the resizer. Now they are invisible. */}
                            <TableHeaderCell key="actions">Actions</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history
                            .sort((a, b) => {
                              let c = a.source_start - b.source_start
                              if (c === 0) c = a.summary_start - b.summary_start
                              return c
                            })
                            .map((record, index) => (
                              <TableRow key={record.record_id}>
                                <TableCell>{currentTask.doc.slice(record.source_start, record.source_end)}</TableCell>
                                <TableCell className="column_resizer_body" />
                                <TableCell>{currentTask.sum.slice(record.summary_start, record.summary_end)}</TableCell>
                                <TableCell className="column_resizer_body" />
                                <TableCell>{record.consistent.join(", ")}</TableCell>
                                <TableCell className="column_resizer_body" />
                                <TableCell>{record.note}</TableCell>
                                <TableCell className="column_resizer_body" />
                                <TableCell>
                                  {viewingRecord != null && viewingRecord.record_id === record.record_id ? (
                                    <Button icon={<EyeOffRegular />} appearance="primary" onClick={washHand}>
                                      Restore
                                    </Button>
                                  ) : (
                                    <Button
                                      icon={<EyeRegular />}
                                      onClick={() => {
                                        setViewingRecord(record)
                                      }}
                                    >
                                      Show
                                    </Button>
                                  )}
                                  <Button
                                    icon={<DeleteRegular />}
                                    onClick={() => {
                                      deleteRecord(record.record_id).then(updateHistory)
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                                <TableCell className="column_resizer_body" />
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                </div>
              </Allotment>
            </Allotment.Pane>
          </Allotment>
        </div>
      )}
    </>
  )
}
