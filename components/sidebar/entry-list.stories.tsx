import type { Meta, StoryObj } from "@storybook/react"

import { useTrackedEditorStore } from "@/store/useEditorStore"
import EntryList from "./entry-list"

const meta: Meta<typeof EntryList> = {
  component: EntryList,
  decorators: [
    (Story) => {
      const editorStore = useTrackedEditorStore()
      editorStore.setHistory([
        {
          record_id: 3,
          sample_id: "mercury_0",
          summary_start: -1,
          summary_end: -1,
          source_start: 600,
          source_end: 1375,
          consistent: [
            "Unwanted",
            "Unwanted.Extrinsic",
          ],
          task_index: 0,
          user_id: "8bd7efa3d49244df9e15fc61ff614c77",
          note: "",
          username: "Nanami",
        },
        {
          record_id: 4,
          sample_id: "mercury_0",
          summary_start: 143,
          summary_end: 326,
          source_start: 802,
          source_end: 1496,
          consistent: [
            "Benign",
          ],
          task_index: 0,
          user_id: "8bd7efa3d49244df9e15fc61ff614c77",
          note: "",
          username: "Nanami",
        },
      ])
      return (<Story />

      )
    },
  ],
}

export default meta
type Story = StoryObj<typeof EntryList>

export const Primary: Story = {
}
