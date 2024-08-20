import {
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useClientPoint,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Button, Text, Title3 } from "@fluentui/react-components";
import { useState } from "react";

const Tooltip = (props: {
  backgroundColor: string;
  text: string;
  score: number;
  onYes: () => Promise<void>;
  onNo: () => Promise<void>;
  start: number;
  end: number;
}) => {
  const [isOpen, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setOpen,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    transform: false,
    strategy: "fixed",
    placement: "top",
  });
  const hover = useHover(context, { move: false, handleClose: safePolygon() });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, {
    role: "dialog",
  });
  const clientPoint = useClientPoint(context, { axis: "x", enabled: !isOpen });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
    clientPoint,
  ]);
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
          {props.score <= 1 ? (
            <Title3>Matchness: {props.score}</Title3>
          ) : (
            <Title3>Labeling</Title3>
          )}
          <br />
          <Text as="p">Are the two texts consistent?</Text>
          <br />
          <div>
            <Button
              id="yesButton"
              onClick={(event) => {
                event.stopPropagation();
                props.onYes().then(() => setOpen(false));
              }}
              style={{ marginRight: ".5rem" }}
            >
              Yes
            </Button>
            <Button
              id="noButton"
              onClick={(event) => {
                event.stopPropagation();
                props.onNo().then(() => setOpen(false));
              }}
            >
              No
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default Tooltip;
