import type { Meta, StoryObj } from "@storybook/react"

import EditorPanel from "./panel"

const meta: Meta<typeof EditorPanel> = {
  component: EditorPanel,
}

export default meta
type Story = StoryObj<typeof EditorPanel>

export const Primary: Story = {
  args: {
    docType: "summary",
    type: "editing",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
}
