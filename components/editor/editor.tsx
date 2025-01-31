"use client"

import { useTrackedEditorStore } from "../../store/useEditorStore"
import { useTrackedTaskStore } from "../../store/useTaskStore"
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Allotment } from "allotment"
import "allotment/dist/style.css"
import {
  Body1, Button, Card,
  CardHeader,
  Text,
  Toast,
  ToastTitle, ToastTrigger,
} from "@fluentui/react-components"
import ExistingPane from "./existing"
import { useTrackedIndexStore } from "../../store/useIndexStore"
import { HasError, Loading } from "./fallback"
import _ from "lodash"
import { labelText, updateRecord } from "../../utils/request"
import Tooltip from "../tooltip"
import { useTrackedLabelsStore } from "../../store/useLabelsStore"
import rangy from "rangy"
import "rangy/lib/rangy-textrange"
import { getColor, normalizationScore } from "../../utils/color"
import { processServerSection } from "../../utils/processServerSection"
import PopupEditor from "./popup";
import { useTrackedPopupStore } from "../../store/usePopupStore";

export default function Editor({ dispatchToast }: { dispatchToast: Function }) {
  const editorStore = useTrackedEditorStore()
  const taskStore = useTrackedTaskStore()
  const indexStore = useTrackedIndexStore()
  const labelsStore = useTrackedLabelsStore()
  const popUpStore = useTrackedPopupStore()

  const [isLoadingServerSection, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const isSuspendingSource = useMemo(() => {
    return isLoadingServerSection && editorStore.initiator === "summary"
  }, [isLoadingServerSection, editorStore.initiator])
  const isSuspendingSummary = useMemo(() => {
    return isLoadingServerSection && editorStore.initiator === "source"
  }, [isLoadingServerSection, editorStore.initiator])

  const debounceSetIsLoading = _.debounce(setIsLoading, 500)

  const onRestoreViewingHistory = useCallback(() => {
    editorStore.clearAllSelection()
    editorStore.setViewing(null)
  }, [])

  const onFetchTask = useCallback(async () => {
    setHasError(false)
    debounceSetIsLoading(true)
    try {
      await taskStore.fetch(indexStore.index)
    }
    catch (e) {
      setHasError(true)
    }
    debounceSetIsLoading(false)
  }, [indexStore.index])

  const onFetchServerSection = useCallback(async () => {
    try {
      await editorStore.fetchServerSection(indexStore.index)
    }
    catch (e) {
      dispatchToast(
          <Toast>
            <ToastTitle
                action={
                  <ToastTrigger>
                    <Button onClick={onFetchServerSection}>
                      Retry
                    </Button>
                  </ToastTrigger>
                }
            >
              Fail fetching server section
            </ToastTitle>
          </Toast>,
          { intent: "error" },
      )
    }
  }, [indexStore.index])

  const handleMouseUp = useCallback((target: "source" | "summary") => {
    if (typeof window === "undefined") return
    const selection = rangy.getSelection()
    if (!selection || selection.rangeCount <= 0) return
    if (!editorStore.editable) return
    const range = selection.getRangeAt(0)

    if (range.toString().trim() === "") {
      if (target === "source") {
        editorStore.clearSourceSelection()
      }
      else {
        editorStore.clearSummarySelection()
      }
      return
    }

    const element = document.getElementById(target)
    const { start, end } = range.toCharacterRange(element)

    if (target === "source") {
      editorStore.setSourceSelection(start, end)
    }
    else {
      editorStore.setSummarySelection(start, end)
    }

    if (editorStore.initiator === target || editorStore.initiator == null) {
      startTransition(async () => {
        await onFetchServerSection()
      })
    }
  }, [editorStore.initiator, editorStore.editable, onFetchServerSection])

  useEffect(() => {
    let ignore = false

    if (!ignore) {
      onFetchTask()
    }

    return () => {
      ignore = true
    }
  }, [indexStore.index])

  function renderHighlight(target: "source" | "summary") {
    const selection = target === "source" ? editorStore.sourceSelection : editorStore.summarySelection
    const text = target === "source" ? taskStore.current.doc : taskStore.current.sum
    if (selection.start === -1) return text

    const segments = []
    if (selection.start > 0) segments.push(text.slice(0, selection.start))
    if (editorStore.editable) {
      segments.push(
          <Tooltip
              start={selection.start}
              end={selection.end}
              key={`slice-${selection.start}-${selection.end}`}
              backgroundColor={editorStore.initiator === target ? "#79c5fb" : "#85e834"}
              textColor="black"
              text={text.slice(selection.start, selection.end)}
              score={editorStore.initiator === target ? null : 2}
              labels={labelsStore.labels}
              onLabel={async (label, note) => {
                await labelText(indexStore.index, {
                  source_start: editorStore.sourceSelection.start,
                  source_end: editorStore.sourceSelection.end,
                  summary_start: editorStore.summarySelection.start,
                  summary_end: editorStore.summarySelection.end,
                  consistent: label,
                  note: note,
                }, editorStore.initiator === target ? target : null)
                editorStore.updateHistory(indexStore.index).then(() => {
                  editorStore.clearAllSelection()
                })
              }}
              message="Check all types that apply below."
          />,
      )
    } else {
      segments.push(
      <span style={{
        backgroundColor: "#79c5fb"
      }}>
        {text.slice(selection.start, selection.end)}
      </span>
      )
    }
    if (selection.end < text.length) segments.push(text.slice(selection.end))
    return segments
  }

  function renderServerSection(target: "source" | "summary") {
    const toDoc = target === "source"
    const text = target === "source" ? taskStore.current.doc : taskStore.current.sum
    const processedServerSection = processServerSection(editorStore.serverSection, toDoc)

    const normalizedColors = normalizationScore(editorStore.serverSection.map(
        (section) => section.score,
    ))

    const segments = []
    let lastIndex = 0
    for (const section of processedServerSection) {
      if (section.offset > lastIndex) {
        segments.push(text.slice(lastIndex, section.offset))
      }

      const sectionStart = section.offset
      const sectionEnd = section.offset + section.len

      segments.push(
          <Tooltip
              start={sectionStart}
              end={sectionEnd}
              key={`slice-${sectionStart}-${sectionEnd}`}
              backgroundColor={getColor(normalizedColors[section.index])}
              textColor="black"
              text={text.slice(sectionStart, sectionEnd)}
              score={section.score}
              labels={labelsStore.labels}
              onLabel={async (label, note) => {
                await labelText(indexStore.index, {
                  source_start: editorStore.initiator === "source" ? editorStore.sourceSelection.start : sectionStart,
                  source_end: editorStore.initiator === "source" ? editorStore.sourceSelection.end : sectionEnd,
                  summary_start: editorStore.initiator === "summary" ? editorStore.summarySelection.start : sectionStart,
                  summary_end: editorStore.initiator === "summary" ? editorStore.summarySelection.end : sectionEnd,
                  consistent: label,
                  note: note,
                })
                editorStore.updateHistory(indexStore.index).then(() => {
                  editorStore.clearAllSelection()
                })
              }}
              message="Check all types that apply below."
          />,
      )
      lastIndex = section.offset + section.len
    }
    if (lastIndex < text.length) segments.push(text.slice(lastIndex))
    return segments
  }

  function render(target: "source" | "summary") {
    const selection = target === "source" ? editorStore.sourceSelection : editorStore.summarySelection
    if (selection.start !== -1 || editorStore.serverSection.length === 0) {
      return renderHighlight(target)
    }

    return renderServerSection(target)
  }

  return (
      <div
          style={{
            height: "80vh",
            margin: "auto",
          }}
      >
        {isLoading && <Loading />}
        {hasError && <HasError />}
        {!isLoading && !hasError && taskStore.current &&
          <Allotment>
            <Allotment.Pane>
              <PopupEditor
                  open={popUpStore.editingID !== null}
                  onEditedDone={async (state, labelData) => {
                    if (state) {
                      updateRecord(indexStore.index, popUpStore.editingID, labelData).then(() => {
                        popUpStore.clearAll()
                      }).then(() => {
                        editorStore.updateHistory(indexStore.index)
                      })
                    } else {
                      popUpStore.clearAll()
                    }
                  }}
                  labels={labelsStore.labels}
              />
              <div
                style={{
                  overflowY: "scroll",
                  height: "100%",
                }}
              >
                <Card
                  style={{
                    userSelect: isSuspendingSource ? "none" : "auto",
                    color: isSuspendingSource ? "gray" : "black",
                  }}
                >
                  <CardHeader
                    header={
                      <Body1>
                        <strong>Source</strong>
                      </Body1>
                    }
                  />
                  {(
                      isSuspendingSource ?
                          <SuspendText text={taskStore.current.doc} />
                          :
                          <Text
                              id="source"
                              as="p"
                              style={{
                                whiteSpace: "pre-wrap",
                              }}
                              onMouseUp={_ => {
                                handleMouseUp("source")
                              }}
                          >
                            {render("source")}
                          </Text>
                  )}
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
                      userSelect: isSuspendingSummary ? "none" : "auto",
                      color: isSuspendingSummary ? "gray" : "black",
                    }}
                  >
                    <CardHeader
                      header={
                        <Body1>
                          <strong>Summary</strong>
                        </Body1>
                      }
                    />
                    {
                      isSuspendingSummary ?
                          <SuspendText text={taskStore.current.sum} />
                          :
                          <Text
                              id="summary"
                              as="p"
                              style={{
                                whiteSpace: "pre-wrap",
                              }}
                              onMouseUp={_ => {
                                handleMouseUp("summary")
                              }}
                          >
                            {render("summary")}
                          </Text>
                    }
                  </Card>
                </div>
                <ExistingPane />
              </Allotment>
            </Allotment.Pane>
          </Allotment>
        }
      </div>
  )
}

function SuspendText({ text }: { text: string }) {
  return (
      <Text
          id="summary"
          as="p">
        {text}
      </Text>
  )
}
