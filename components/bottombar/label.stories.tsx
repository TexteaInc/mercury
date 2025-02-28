import type { Meta, StoryObj } from "@storybook/react"
import { useTrackedLabelsStore } from "@/store/useLabelsStore"
import { useState } from "react"
import Label from "./label"

function LabelWithState(args: any) {
  const [labelData, setLabelData] = useState<string[]>([])

  return (
    <div>
      <Label {...args} onResultChange={setLabelData} />
      <div className="mt-4">
        <h3>Selected Labels:</h3>
        <pre>{JSON.stringify(labelData, null, 2)}</pre>
      </div>
    </div>
  )
}

const meta: Meta<typeof Label> = {
  component: Label,
  render: LabelWithState,
  decorators: [
    (Story) => {
      const labelsStore = useTrackedLabelsStore()
      labelsStore.setCandidates([
        "Questionable",
        "Benign",
        {
          Unwanted: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
        {
          Unwanted1: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
        {
          Unwanted2: [
            "Extrinsic",
            "Instrinsic",
          ],
        },
      ])
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof Label>

export const Primary: Story = {
}
