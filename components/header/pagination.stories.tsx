import type { Meta, StoryObj } from "@storybook/react"

import { useTrackedIndexStore } from "@/store/useIndexStore"
import Pagination from "./pagination"

const meta: Meta<typeof Pagination> = {
  component: Pagination,
  decorators: [
    (Story) => {
      const indexStore = useTrackedIndexStore()
      indexStore.setMax(10)
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof Pagination>

export const Primary: Story = {

}
