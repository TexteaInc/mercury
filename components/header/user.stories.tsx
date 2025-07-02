import type { Meta, StoryObj } from "@storybook/react"

import { useTrackedUserStore } from "@/store/useUserStore"
import User from "./user"

const meta: Meta<typeof User> = {
  component: User,
  decorators: [
    (Story) => {
      const userStore = useTrackedUserStore()
      userStore.user = { name: "John Doe", id: "1", email: "john.doe@example.com" }
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof User>

export const Primary: Story = {

}
