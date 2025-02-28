import type { Meta, StoryObj } from "@storybook/react"

import { useTrackedUserStore } from "@/store/useUserStore"
import { generateUserColor } from "@/utils/color"
import { fn } from "@storybook/test"
import Entry from "./entry"

const meta: Meta<typeof Entry> = {
  component: Entry,
  decorators: [
    (Story) => {
      const userStore = useTrackedUserStore()
      userStore.user = { name: "John Doe", id: "1", email: "john.doe@example.com" }
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof Entry>

export const Primary: Story = {
  args: {
    username: "john.doe",
    hslColor: generateUserColor("8bd7efa3d49244df9e15fc61ff614c77", 114514),
    onStateChange: fn(),
    onSelect: fn(),
  },
}
