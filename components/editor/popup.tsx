// A popup window to edit an existing annotation record selected

"use client"

import {
  Body1,
  Card, CardHeader,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  makeStyles, DialogActions, Button, shorthands, Textarea, DialogTrigger
} from "@fluentui/react-components";
import { useTrackedTaskStore } from "../../store/useTaskStore";
import { useTrackedPopupStore } from "../../store/usePopupStore";
import CustomOption from "../customOption";
import type { LabelData } from "../../utils/types";
import { useTrackedIndexStore } from "../../store/useIndexStore";
import { useReducer, useState } from "react";
import { deleteRecord } from "../../utils/request";
import { useTrackedEditorStore } from "../../store/useEditorStore";

type PopupEditorProps = {
  onEditedDone: (changed: boolean, labelData?: LabelData) => Promise<void>,
  open: boolean,
  labels: (string|object)[]
}

const useStyles = makeStyles({
  card: {
    backgroundColor: "#f0f0f0",
    boxShadow: "rgba(0, 0, 0, 0.1) 0px 4px 12px",
    ...shorthands.padding("1rem", "1rem"),
    ...shorthands.flex(1)
  },
  dangerButton: {
    backgroundColor: "#f44336",
    color: "white",
    "&:hover": {
      backgroundColor: "#d32f2f",
      color: "white",
    }
  },
  largeSurface: {
    maxWidth: "98vw",
  }
})

type SimpleSelectionProps = {
  text: string,
  onSelectChange: (range: [number, number]) => void
}

const SimpleSelection = (props: SimpleSelectionProps) => {
  const [select, setSelect] = useState(false)
  return (
    <Text
      as="p"
      style={{
        whiteSpace: "pre-wrap"
      }}
      ref={(el) => {
        if (!el) return;

        el.addEventListener("mousedown", () => {
          setSelect(true)
        })
        el.addEventListener("mouseup", () => {
          if (!select) return;
          const selection = window.getSelection()
          if (!selection || selection.rangeCount <= 0) return;
          const range = selection.getRangeAt(0);
          props.onSelectChange([range.startOffset, range.endOffset])
          setSelect(false)
        })
      }}
    >
      {props.text}
    </Text>
  )
}

type SimpleSelectionShowProps = {
  text: string,
  range: [number, number]
}

const SimpleSelectionShow = (props: SimpleSelectionShowProps) => {
  return (
    <Text
      as="p"
      style={{
        whiteSpace: "pre-wrap"
      }}
    >
      {props.text.slice(0, props.range[0])}
      <span style={{
        backgroundColor: "#ffbb55"
      }}>
        {props.text.slice(props.range[0], props.range[1])}
      </span>
      {props.text.slice(props.range[1])}
    </Text>
  )
}

const PopupEditor = (props: PopupEditorProps) => {
  const [forceUpdateKey, forceUpdate] = useReducer(x => x + 1, 0);
  const popUpStore = useTrackedPopupStore()
  const taskStore = useTrackedTaskStore()
  const styles = useStyles()
  const indexStore = useTrackedIndexStore()
  const editorStore = useTrackedEditorStore()

  return (
    <Dialog open={props.open} >
      <DialogSurface className={styles.largeSurface}>
        <DialogBody>
          <DialogTitle
            action={
              <div style={{
                display: "flex",
                gap: 4,
              }}>
                <Dialog modalType="non-modal">
                  <DialogTrigger disableButtonEnhancement>
                    <Button className={styles.dangerButton}>
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogBody>
                      <DialogTitle>Delete this record?</DialogTitle>
                      <DialogContent>
                        <Text as="p">
                          Are you sure you want to delete this record? This action cannot be undone.
                        </Text>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={async () => {
                            await deleteRecord(popUpStore.editingID)
                            if (editorStore.viewingID === popUpStore.editingID) {
                              editorStore.setViewing(null)
                            }
                            await editorStore.updateHistory(indexStore.index)
                            popUpStore.clearAll()
                          }}
                          className={styles.dangerButton}
                        >
                          Delete
                        </Button>
                        <Button>Cancel</Button>
                      </DialogActions>
                    </DialogBody>
                  </DialogSurface>
                </Dialog>
                <Button
                  className={styles.dangerButton}
                  onClick={() => {
                    if (popUpStore.restore !== null) {
                      popUpStore.setLabelData(popUpStore.restore)
                      forceUpdate()
                    }
                  }}
                  disabled={popUpStore.restore === null}
                >
                  Restore
                </Button>
                <Button
                  onClick={async () => {
                    await props.onEditedDone(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await props.onEditedDone(true, {
                      record_id: popUpStore.editingID,
                      sample_id: indexStore.index.toString(),
                      summary_start: popUpStore.summarySelectionRange[0],
                      summary_end: popUpStore.summarySelectionRange[1],
                      source_start: popUpStore.sourceSelectionRange[0],
                      source_end: popUpStore.sourceSelectionRange[1],
                      consistent: popUpStore.consistent,
                      task_index: indexStore.index,
                      user_id: "",
                      note: popUpStore.note
                    })
                  }}
                  appearance="primary"
                >
                  Save
                </Button>
              </div>
            }
          >
            Editing
          </DialogTitle>
          <DialogContent>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 16,
              }}
            >
              <Card className={styles.card}>
                <CardHeader
                  header={
                    <Body1>
                      <strong>Source</strong>
                    </Body1>
                  }
                  action={popUpStore.sourceSelectionRange[0] > 0 &&
                    <Button
                      onClick={() => {
                        popUpStore.setSourceSelectionRange([-1, -1])
                      }}
                    >
                      Clear highlight
                    </Button>
                  }
                />
                {
                  popUpStore.editingID && (popUpStore.sourceSelectionRange[1] > 0 ? (
                    <SimpleSelectionShow
                      text={taskStore.current.doc}
                      range={popUpStore.sourceSelectionRange}
                    />
                  ) : (
                    <SimpleSelection
                      text={taskStore.current.doc}
                      onSelectChange={(range) => {
                        popUpStore.setSourceSelectionRange(range)
                      }}
                    />
                  ))
                }
              </Card>

              <Card className={styles.card}>
                <CardHeader
                  header={
                    <Body1>
                      <strong>Summary</strong>
                    </Body1>
                  }
                  action={popUpStore.summarySelectionRange[0] > 0 &&
                      <Button
                          onClick={() => {
                            popUpStore.setSummarySelectionRange([-1, -1])
                          }}
                      >
                          Clear highlight
                      </Button>
                  }
                />
                {
                  popUpStore.editingID && (popUpStore.summarySelectionRange[1] > 0 ? (
                    <SimpleSelectionShow
                      text={taskStore.current.sum}
                      range={popUpStore.summarySelectionRange}
                    />
                  ) : (
                    <SimpleSelection
                      text={taskStore.current.sum}
                      onSelectChange={(range) => {
                        popUpStore.setSummarySelectionRange(range)
                      }}
                    />
                  ))
                }
              </Card>
            </div>
          </DialogContent>

          <DialogActions position="start">
            <CustomOption
              labels={props.labels}
              syncLabels={(labels) => {
                popUpStore.setConsistent(Object.keys(labels).filter((label) => labels[label]))
              }}
              initialLabels={popUpStore.consistent}
              style={{
                width: "fit-content"
              }}
              key={forceUpdateKey}
            />
          </DialogActions>

          <DialogActions position="end">
            <Textarea
              resize="both"
              style={{
                width: "25vw",
              }}
              placeholder="Add an optional note"
              value={popUpStore.note}
              onChange={(_, data) => popUpStore.setNote(data.value)}
            />
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export default PopupEditor;
