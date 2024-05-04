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
import { exportLabel, getSingleTask } from "../../utils/request"
import type { LabelData, Task } from "../../utils/types"

type TextPart = {
  text: string
  labeled: boolean
}

export default function Index() {
  const [history, setHistory] = useState<LabelData[]>([])
  const [taskIndex, setTaskIndex] = useState<number | null>(null)
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [taskData, setTaskData] = useState<(LabelData & Task) | null>(null)

  const [doc, setDoc] = useState<TextPart[] | null>(null)
  const [summary, setSummary] = useState<TextPart[] | null>(null)

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
        const rawDoc = data.doc
        const rawSummary = data.sum

        const docRange = [history[historyIndex].source_start, history[historyIndex].source_end]
        const summaryRange = [history[historyIndex].summary_start, history[historyIndex].summary_end]

        const docPart = rawDoc.split("").map((char, index) => {
          if (index >= docRange[0] && index < docRange[1]) {
            return { text: char, labeled: true }
          }
          return { text: char, labeled: false }
        })

        const summaryPart = rawSummary.split("").map((char, index) => {
          if (index >= summaryRange[0] && index < summaryRange[1]) {
            return { text: char, labeled: true }
          }
          return { text: char, labeled: false }
        })

        setDoc(docPart)
        setSummary(summaryPart)
      }
    })
  }, [taskIndex, historyIndex, history])

  return (
    <>
      <Title1>Mercury Labels</Title1>
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
                      marginRight: "1em",
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
                  <Card
                    style={{
                      flex: 1,
                      marginRight: "1em",
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
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
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
            key={`history-${label.task_id}-${index}`}
            size="large"
            style={{ marginBottom: "1rem", marginTop: "1rem" }}
          >
            <CardHeader
              header={
                <Body1>
                  <strong>Task ID: {label.task_id}</strong>
                </Body1>
              }
            />
            <Text as="p">
              <strong>Summary:</strong> {label.summary_start} - {label.summary_end}
              <br />
              <strong>Source:</strong> {label.source_start} - {label.source_end}
              <br />
              <strong>Consistent:</strong> {label.consistent ? "Yes" : "No"}
            </Text>
            <CardFooter>
              <Button
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
