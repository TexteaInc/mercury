import type { Meta, StoryObj } from "@storybook/react"
import { useTrackedLabelsStore } from "@/store/useLabelsStore"
import Editor from "./index"

const meta: Meta<typeof Editor> = {
  component: Editor,
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
      return (
        <div className="h-full">
          <Story />
        </div>
      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof Editor>

export const Primary: Story = {
}
