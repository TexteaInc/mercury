import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import Actions from "./actions"

const meta: Meta<typeof Actions> = {
  component: Actions,
  argTypes: {
    type: {
      options: ["editing", "viewing"],
      control: { type: "radio" },
    },
  },
}

export default meta
type Story = StoryObj<typeof Actions>

export const EditingMode: Story = {
  args: {
    type: "editing",
    onSubmit: () => fn(),
    onDelete: () => fn(),
    onReset: () => fn(),
  },
}

export const ViewingMode: Story = {
  args: {
    type: "viewing",
    onReset: () => fn(),
  },
}
