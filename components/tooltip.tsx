import {
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useClick,
  useClientPoint,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react"
import { Button, Checkbox, Dropdown, OptionGroup, Text, Title3 } from "@fluentui/react-components"
import { useState } from "react"

const Tooltip = (props: {
  backgroundColor: string
  text: string
  score: number
  labels: (string | object)[]
  onLabel: (label: string[]) => Promise<void>
  start: number
  end: number
  message: string
}) => {
  const [isOpen, setOpen] = useState(false)
  const [useEnable, setUseEnable] = useState(true)
  const [labelsStates, setLabelsStates] = useState({})
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setOpen,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    transform: false,
    strategy: "fixed",
    placement: "top",
  })
  const hover = useHover(context, { move: false, handleClose: safePolygon(), enabled: useEnable })
  const focus = useFocus(context)
  const click = useClick(context, { enabled: false })
  const dismiss = useDismiss(context)
  const role = useRole(context, {
    role: "dialog",
  })
  const clientPoint = useClientPoint(context, { axis: "x", enabled: !isOpen })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role, clientPoint, click])
  
  // I put this here, because I want to access the labelsStates for convenience
  const CustomOption = (props: { value: unknown, keys: string[] }) => {
    // is object and not array
    if (typeof props.value === "object" && !Array.isArray(props.value)) {
      const key = Object.keys(props.value)[0]
      const value = Object.values(props.value)[0]
      
      return <OptionGroup
        label={key}
        id={`label-${key}`}
        >
          <CustomOption value={value} keys={[...props.keys, key]} />
        </OptionGroup>
    }
    
    // is array
    if (Array.isArray(props.value)) {
      return props.value.map((value) => {
        return <CustomOption value={value} keys={props.keys} />
      })
    }
    
    // is string
    const value_: string = `${props.keys.join(".")}.${props.value}`
    return <Checkbox
      id={`label-${value_}`}
      checked={labelsStates[value_]}
      onChange={(checked) => setLabelsStates({
        ...labelsStates,
        [value_]: checked
      })}
      label={props.value}
    />
  }
  
  return (
    <>
      <Text
        as="span"
        style={{
          backgroundColor: props.backgroundColor,
        }}
        ref={refs.setReference}
        {...getReferenceProps()}
        data-mercury-label-start={props.start}
        data-mercury-label-end={props.end}
      >
        {props.text}
      </Text>
      {isOpen && (
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            userSelect: "none",
            backgroundColor: "white",
            padding: ".5rem",
            borderRadius: ".5rem",
            zIndex: 1000,
            border: "1px solid black",
          }}
          {...getFloatingProps()}
        >
          {props.score <= 50 ? <Title3>Matchness: {props.score}</Title3> : <Title3>Labeling</Title3>}
          <br />
          <Text as="p">{props.message}</Text>
          <br />
          <div style={{
            display: "flex",
            marginTop: "1rem",
            gap: "1rem",
            flexWrap: "wrap",
            // column
            flexDirection: "column",
          }}>
            {
              props.labels.map(label => {
                if (typeof label === "string") {
                  return <Checkbox
                      id={`label-${label}`}
                      key={label}
                      checked={labelsStates[label]}
                      onChange={(checked) => setLabelsStates({
                        ...labelsStates,
                        [label]: checked
                      })}
                      label={label}
                  />
                }
                
                const key = Object.keys(label)[0]
                return (
                  <div id={`label-${key}-box`} style={{
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    <label id={`label-${key}`}>{key}</label>
                    <Dropdown
                      aria-labelledby={`label-${key}`}
                      multiselect
                      placeholder="Select labels"
                      id={`label-${key}-dropdown`}
                      onOpenChange={(_, data) => {
                        setUseEnable(!data.open)
                      }}
                    >
                      <CustomOption value={Object.values(label)[0]} keys={[Object.keys(label)[0]]} />
                    </Dropdown>
                  </div>
                )
              })
            }
          </div>
          <br />
          <Button
              onMouseDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                props.onLabel(Object.keys(labelsStates).filter((label) => labelsStates[label])).then(() => setOpen(false))
              }}
          >
            Submit
          </Button>
        </div>
      )}
    </>
  )
}

export default Tooltip
