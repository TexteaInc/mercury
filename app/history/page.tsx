"use client"

import {
  Body1,
  Button,
  Card,
  CardFooter,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
  Title1,
} from "@fluentui/react-components"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { type HistorySlice, historyTextToSlice } from "../../utils/mergeArray"
import { exportLabel, getSingleTask, deleteRecord } from "../../utils/request"
import type { LabelData, Task } from "../../utils/types"
import { DeleteRegular, DismissRegular, EyeRegular } from "@fluentui/react-icons";

export default function Page() {
  const [history, setHistory] = useState<LabelData[]>([])
  const [taskIndex, setTaskIndex] = useState<number | null>(null)
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [taskData, setTaskData] = useState<(LabelData & Task) | null>(null)

  const [doc, setDoc] = useState<HistorySlice[] | null>(null)
  const [summary, setSummary] = useState<HistorySlice[] | null>(null)

  const queryDone = useRef(false)

  useEffect(() => {
    if (queryDone.current) return
    exportLabel().then(data => {
      setHistory(data)
      queryDone.current = true
    })
  }, [])

  useEffect(() => {
    if (taskIndex === null || historyIndex === null) return
    if (history.length === 0) return
    if (historyIndex < 0 || historyIndex >= history.length) return
    getSingleTask(taskIndex).then(data => {
      if ("doc" in data) {
        setTaskData({ ...history[historyIndex], ...data })
        const consistent = history[historyIndex].consistent
        const rawDoc = data.doc
        const rawSummary = data.sum

        const docPart: HistorySlice[] = historyTextToSlice(
          rawDoc,
          history[historyIndex].source_start,
          history[historyIndex].source_end,
          consistent,
        )
        const summaryPart: HistorySlice[] = historyTextToSlice(
          rawSummary,
          history[historyIndex].summary_start,
          history[historyIndex].summary_end,
          consistent,
        )
        setDoc(docPart)
        setSummary(summaryPart)
      }
    })
  }, [taskIndex, historyIndex, history])

  return (
    <>
      <Title1>Mercury Label History</Title1>
      <Dialog open={dialogOpen}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Preview</DialogTitle>
            <DialogContent>
              {taskData === null || doc === null || summary === null ? (
                <MessageBar shape="square">
                  <MessageBarBody>
                    <MessageBarTitle>Loading...</MessageBarTitle>
                    Please wait while the data is being fetched.
                  </MessageBarBody>
                </MessageBar>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "baseline",
                  }}
                >
                  <Card
                    style={{
                      flex: 1,
                      alignSelf: "stretch",
                    }}
                  >
                    <CardHeader
                      header={
                        <Body1>
                          <strong>Source</strong>
                        </Body1>
                      }
                    />
                    <Text as="p">
                      {doc.map((part, index) => (
                        <span
                          key={`doc-${part.labeled}-${index}`}
                          style={{ background: part.labeled ? "#00a6ff" : "none" }}
                        >
                          {part.text}
                        </span>
                      ))}
                    </Text>
                  </Card>
                  <Card style={{
                    marginLeft: ".5rem",
                    marginRight: ".5rem",
                    alignSelf: "center",
                  }}>
                    <Text as="span">
                      <strong>{taskData.consistent ? "Consistent" : "Not Consistent"}</strong>
                    </Text>
                  </Card>
                  <Card
                    style={{
                      flex: 1,
                      alignSelf: "stretch",
                    }}
                  >
                    <CardHeader
                      header={
                        <Body1>
                          <strong>Summary</strong>
                        </Body1>
                      }
                    />
                    <Text as="p">
                      {summary.map((part, index) => (
                        <span
                          key={`summary-${part.labeled}-${index}`}
                          style={{ background: part.labeled ? "#00a6ff" : "none" }}
                        >
                          {part.text}
                        </span>
                      ))}
                    </Text>
                  </Card>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button icon={<DeleteRegular />} onClick={() => {
                deleteRecord(taskData.record_id).then(() => {
                  setDialogOpen(false)
                  setHistory(history.filter((_, index) => index !== historyIndex))
                })
              }}>Delete</Button>
              <Button icon={<DismissRegular />} onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <br />
      {history.length === 0 ? (
        <MessageBar shape="square">
          <MessageBarBody>
            <MessageBarTitle>No history</MessageBarTitle>
            There is no history to display. Go to the <Link href="/">home</Link> page to start labeling.
          </MessageBarBody>
        </MessageBar>
      ) : (
        history.map((label, index) => (
          <Card
            key={`history-${label.sample_id}-${index}`}
            size="large"
            style={{ marginBottom: "1rem", marginTop: "1rem" }}
          >
            <CardHeader
              header={
                <Body1>
                  <strong>Record ID:</strong> {label.record_id}
                </Body1>
              }
            />
            <Text as="p">
              <strong>Task Index:</strong> {label.task_index}
              <br />
              <strong>Summary:</strong> {label.summary_start} - {label.summary_end}
              <br />
              <strong>Source:</strong> {label.source_start} - {label.source_end}
              <br />
              <strong>Consistent:</strong> {label.consistent ? "Yes" : "No"}
            </Text>
            <CardFooter>
              <Button
                icon={<EyeRegular />}
                onClick={() => {
                  setTaskIndex(label.task_index)
                  setHistoryIndex(index)
                  setDialogOpen(true)
                }}
              >
                View
              </Button>
            </CardFooter>
          </Card>
        ))
      )}
    </>
  )
}
