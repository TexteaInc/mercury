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
import { Button, Text, Title3, ToggleButton } from "@fluentui/react-components"
import { useState } from "react"

const Tooltip = (props: {
  backgroundColor: string
  text: string
  score: number
  labels: string[]
  onLabel: (label: string[]) => Promise<void>
  start: number
  end: number
  message: string
}) => {
  const [isOpen, setOpen] = useState(false)
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
  const hover = useHover(context, { move: false, handleClose: safePolygon() })
  const focus = useFocus(context)
  const click = useClick(context, { enabled: false })
  const dismiss = useDismiss(context)
  const role = useRole(context, {
    role: "dialog",
  })
  const clientPoint = useClientPoint(context, { axis: "x", enabled: !isOpen })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role, clientPoint, click])
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
          }}>
            {
              props.labels.map((label, index) => (
                <ToggleButton
                  id={`label-${label}-${index}-${props.start}`}
                  checked={labelsStates[label]}
                  onChange={(event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    console.log(event)
                    setLabelsStates({ ...labelsStates, [label]: event.target.checked })
                  }}
                >
                  {label}
                </ToggleButton>
              ))
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
