import type { Meta, StoryObj } from "@storybook/react"

import { Window } from "./window"

const meta: Meta<typeof Window> = {
  component: Window,
}

export default meta
type Story = StoryObj<typeof Window>

export const Primary: Story = {
  args: {
    name: "Window",
    children: <div>Hello</div>,
    action: <div>Action Button</div>,
  },
}
