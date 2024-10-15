"use client";

import { Body1, Button, Card, CardHeader, Dialog, DialogBody, DialogSurface, DialogTitle, DialogTrigger, Dropdown, Field, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, Persona, ProgressBar, Option, Tag, TagGroup, Text, Title1, tokens, DialogContent, DialogActions } from "@fluentui/react-components";
import { ArrowLeftRegular, ArrowRightRegular, ArrowUploadRegular, DocumentArrowLeftRegular, DocumentArrowRightRegular, FilterRegular } from "@fluentui/react-icons";
import { Allotment } from "allotment";
import { useEffect, useState } from "react";
import "allotment/dist/style.css";

type Annotation = {
  annot_id: number
  sample_id: number
  annotator: string
  annotator_name?: string
  label: string[]
  note?: string
  summary_span?: string
  summary_start?: number
  summary_end?: number
  source_span?: string
  source_start?: number
  source_end?: number
}

type DumpSlice = {
  sample_id: number
  source: string
  summary: string
  annotations: Annotation[]
}

type DumpAnnotationSlice = {
  sample_id: number
  source: string
  summary: string
  annotation: Annotation
}

type UserInfo = {
  name?: string
  count: number
}

type Users = Record<string, UserInfo> // string means id

const useStyles = makeStyles({
  propsTable: {
    "& td:first-child": {
      fontWeight: tokens.fontWeightSemibold,
      paddingRight: "1rem",
    },
  },
});

const makeUsers = (slices: DumpSlice[]): Users => {
  const users: Users = {}
  for (const slice of slices) {
    for (const annotation of slice.annotations) {
      if (annotation.annotator in users) {
        users[annotation.annotator].count++
      } else {
        users[annotation.annotator] = {
          count: 1,
          name: annotation.annotator_name
        }
      }
    }
  }
  return users
}

const isNumber = (value: unknown) => {
  return typeof value === "number" && !Number.isNaN(value)
}

const TagGroups = (props: { tags: string[] }) => {
  return (
    <TagGroup role="list">
      {props.tags.map((tag, index) => (
        <Tag key={`tag-${tag}`} role="listitem">
          {tag}
        </Tag>
      ))}
    </TagGroup>
  )
}

const SliceText = (props: { text: string, start?: number, end?: number }) => {
  const { text, start, end } = props
  if (start === undefined || end === undefined) {
    return <Text as="p">{text}</Text>
  }
  return (
    <Text as="p">
      {text.slice(0, start)}
      <Text as="span" style={{
        backgroundColor: "#00a6ff",
        color: "white",
      }}>{text.slice(start, end)}</Text>
      {text.slice(end)}
    </Text>
  )
}

export default function Page() {
  const [sampleIndex, setSampleIndex] = useState(0)
  const [maxSample, setMaxSample] = useState(0)
  
  const [annotationIndex, setAnnotationIndex] = useState(0)
  const [maxAnnotation, setMaxAnnotation] = useState(0)
  
  const [currentSlice, setCurrentSlice] = useState<DumpAnnotationSlice | null>(null)
  
  const [fullSlices, setFullSlices] = useState<DumpSlice[] | null>(null)
  const [nowSlices, setNowSlices] = useState<DumpSlice[] | null>(null)
  const [filterUsers, setFilterUsers] = useState<string[]>([])
  const [users, setUsers] = useState<Users | null>(null)
  const styles = useStyles();
  
  useEffect(() => {
    if (nowSlices === null || nowSlices.length <= 0) {
      return
    }
    
    setCurrentSlice({
      sample_id: nowSlices[sampleIndex].sample_id,
      source: nowSlices[sampleIndex].source,
      summary: nowSlices[sampleIndex].summary,
      annotation: nowSlices[sampleIndex].annotations[annotationIndex]
    })
    
    setMaxAnnotation(nowSlices[sampleIndex].annotations.length)
  }, [annotationIndex, sampleIndex, nowSlices])
  
  useEffect(() => {
    if (fullSlices === null || fullSlices.length <= 0) {
      return
    }

    // Filter out samples with empty annotations
    const filteredSlices = fullSlices.filter(slice => slice.annotations.length > 0)

    if (filterUsers === null || filterUsers.length <= 0) {
      // setNowSlices(fullSlices)
      setNowSlices(filteredSlices)
      setMaxSample(filteredSlices.length)
      setSampleIndex(0)
      setAnnotationIndex(0)
      return
    }
    
    const newSlices: DumpSlice[] = []
    // for (const slice of fullSlices) {
      for (const slice of filteredSlices) {
      const annotations = slice.annotations.filter((annotation) => filterUsers.includes(annotation.annotator))
      if (annotations.length > 0) {
        newSlices.push({
          ...slice,
          annotations
        })
      }
    }
    
    setMaxSample(newSlices.length)
    // setMaxAnnotation(newSlices[0].annotations.length)
    setMaxAnnotation(newSlices[0]?.annotations.length || 0)
    setSampleIndex(0)
    setAnnotationIndex(0)
    setNowSlices(newSlices)
  }, [fullSlices, filterUsers])
  
  const LabelInfoPanel = (props: DumpAnnotationSlice) => {
    const annotator = props.annotation.annotator_name ?? props.annotation.annotator
    return (
      <div role="tabpanel">
        <table className={styles.propsTable}>
          <tbody>
            <tr>
              <td>Sample ID</td>
              <td>{props.sample_id + 1} (in current batch)</td>
            </tr>
            <tr>
              <td>Annotator</td>
              <td>{annotator}</td>
            </tr>
            <tr>
              <td>Labels</td>
              <td>
                <TagGroups tags={props.annotation.label} />
              </td>
            </tr>
            {props.annotation.note && (
              <tr>
                <td>Note</td>
                <td>{props.annotation.note}</td>
              </tr>
            )}
            <tr>
              <td>Annot ID</td>
              <td>{props.annotation.annot_id}</td>
            </tr>
            {(isNumber(props.annotation.source_end) && isNumber(props.annotation.source_start)) && (
              <tr>
                <td>Source Range</td>
                <td>
                  {`${props.annotation.source_start} - ${props.annotation.source_end}`}
                </td>
              </tr>
            )}
            {(isNumber(props.annotation.summary_start) && isNumber(props.annotation.summary_end)) && (
              <tr>
                <td>Summary Range</td>
                <td>
                  {`${props.annotation.summary_start} - ${props.annotation.summary_end}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }
    
  return (
    <>
      <Title1>Mercury Label Viewer</Title1>
      <br /><br />
      <div
        style={{
          display: "flex",
          gap: "1rem",
        }}
      >
        <Button
          appearance="primary"
          icon={<ArrowUploadRegular />}
          onClick={() => {
            const input = document.createElement("input")
            input.type = "file"
            input.accept = ".json"
            input.onchange = async () => {
              const file = input.files?.[0]
              if (file === undefined) {
                return
              }
              const text = await file.text()
              const slice: DumpSlice[] = JSON.parse(text)
                .filter((slice: DumpSlice) => slice.annotations.length > 0)
              setFilterUsers([])
              setUsers(makeUsers(slice))
              setFullSlices(slice)
              setNowSlices(slice)
              setMaxSample(slice.length)
              setSampleIndex(0)
              setMaxAnnotation(slice[0].annotations.length)
              setAnnotationIndex(0)
              input.remove()
            }
            input.click()
          }}
        >
          Upload
        </Button>
        <Dialog>
          <DialogTrigger disableButtonEnhancement>
            <Button icon={<FilterRegular />}>User Filter</Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Filter By Users</DialogTitle>
              <DialogContent>
                <Text as="p">
                  Find the labels by specific users. Select the users you want to filter.
                </Text>
                <br /><br />
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                }}>
                  <label id="user-filter">Users</label>
                  <Dropdown
                    aria-labelledby="user-filter"
                    multiselect
                    placeholder="Select users"
                    selectedOptions={filterUsers}
                    clearable
                    onOptionSelect={(e, data) => {
                      setFilterUsers(data.selectedOptions)
                    }}
                    value={
                      filterUsers
                        .map((user) => users[user].name ?? user)
                        .join(", ")
                    }
                  >
                    {
                      users === null ? null : Object.keys(users).map((user) => (
                        <Option text={users[user].name ?? user} key={user} value={user}>
                          <Persona 
                            avatar={{
                              color: "colorful",
                              "aria-hidden": true,
                            }}
                            name={users[user].name ?? user}
                            secondaryText={`${users[user].count} labels`}
                          />
                        </Option>
                      ))
                    }
                  </Dropdown>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button 
                    appearance="secondary"
                    onClick={() => {
                      setFilterUsers([])
                    }}
                  >
                    Reset
                  </Button>
                </DialogTrigger>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="primary">Apply</Button>
                </DialogTrigger>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
      <br /><br />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Button
          icon={<DocumentArrowLeftRegular />}
          disabled={sampleIndex <= 0}
          style={{
            width: "15%"
          }}
          onClick={() => {
            setSampleIndex(sampleIndex - 1)
            setAnnotationIndex(0)
          }}
        >
          Previous sample
        </Button>
        <Field 
          //  validationMessage={`Sample ${sampleIndex + 1} / ${maxSample}, ID in current batch: ${currentSlice ? currentSlice.sample_id + 1 : "N/A"}`} 
          validationMessage={`Sample ID in current batch: ${currentSlice ? currentSlice.sample_id + 1 : "N/A"}`} 
          // validationMessage={`Sample ${currentSlice.sample_id + 1} in current batch`} 
          // TODO: Please fix above 
          validationState="none"
          style={{
            flexGrow: 1
          }}
        >
          <ProgressBar 
            value={sampleIndex + 1} 
            max={maxSample} 
            thickness="large" 
          />
        </Field>
        <Button 
          icon={<DocumentArrowRightRegular />} 
          disabled={sampleIndex >= maxSample - 1} 
          iconPosition="after"
          style={{
            width: "15%"
          }}
          onClick={() => {
            setSampleIndex(sampleIndex + 1)
            setAnnotationIndex(0)
          }}
        >
          Next sample
        </Button>
      </div>
      <div
        style={{
          marginTop: ".75rem",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Button 
          icon={<ArrowLeftRegular />} 
          disabled={annotationIndex <= 0}
          style={{
            width: "15%"
          }}
          onClick={() => {
            setAnnotationIndex(annotationIndex - 1)
          }}
        >
          Previous annotation
        </Button>
        <Field
          // validationMessage={`Annotation ${annotationIndex + 1} / ${maxAnnotation}, ID: ${currentSlice ? currentSlice.annotation.annot_id : "N/A"}`}
          validationMessage={`Annotation ${annotationIndex + 1} / ${maxAnnotation} `}
          validationState="none"
          style={{
            flexGrow: 1
          }}
        >
          <ProgressBar 
            value={annotationIndex + 1} 
            max={maxAnnotation} 
            thickness="large" 
            color="success"
          />
        </Field>
        <Button 
          icon={<ArrowRightRegular />} 
          disabled={annotationIndex >= maxAnnotation - 1} 
          iconPosition="after"
          style={{
            width: "15%"
          }}
          onClick={() => {
            setAnnotationIndex(annotationIndex + 1)
          }}
        >
          Next annotation
        </Button>
      </div>
      <br /><br />
      {
        currentSlice === null ? (
          <MessageBar shape="square" intent="info">
            <MessageBarBody>
              <MessageBarTitle>No labels</MessageBarTitle>
              Please upload a json file to start.
            </MessageBarBody>
          </MessageBar>
        ) : (
          <div style={{
            height: "69vh",
            margin: "auto",
          }}>
            <Allotment>
              <Allotment.Pane>
                <div style={{
                  overflowY: "scroll",
                  height: "100%"
                }}>
                  <Card>
                    <CardHeader
                      header={
                        <Body1>
                          <strong>Source</strong>
                        </Body1>
                      }
                    />
                    <SliceText 
                      text={currentSlice.source} 
                      start={currentSlice.annotation.source_start} 
                      end={currentSlice.annotation.source_end}
                    />
                  </Card>
                </div>
              </Allotment.Pane>
              <Allotment.Pane>
                <Allotment vertical>
                  <div style={{
                    overflowY: "scroll",
                    height: "100%"
                  }}>
                    <Card>
                      <CardHeader
                        header={
                          <Body1>
                            <strong>Summary</strong>
                          </Body1>
                        }
                      />
                      <SliceText 
                        text={currentSlice.summary} 
                        start={currentSlice.annotation.summary_start} 
                        end={currentSlice.annotation.summary_end}
                      />
                    </Card>
                  </div>
                  <div style={{
                    overflowY: "scroll",
                    height: "100%"
                  }}>
                    <Card>
                      <CardHeader
                        header={
                          <Body1>
                            <strong>Info</strong>
                          </Body1>
                        }
                      />
                      <LabelInfoPanel {...currentSlice} />
                    </Card>
                  </div>
                </Allotment>
              </Allotment.Pane>
            </Allotment>
          </div>
        )
      }
    </>
  )
}
