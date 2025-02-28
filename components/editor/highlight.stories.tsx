import type { Meta, StoryObj } from "@storybook/react"

import Highlight from "./highlight"

const meta: Meta<typeof Highlight> = {
  component: Highlight,
  decorators: [
    Story => (
      <div>
        <Story />
        <div className="mt-4">
          <h3>Original</h3>
          <div>Lorem ipsum odor amet, consectetuer adipiscing elit. Vitae auctor condimentum magnis massa bibendum imperdiet pellentesque. Ullamcorper sodales gravida blandit tellus; ornare leo fusce erat nisi. Bibendum ut dignissim amet neque eget cursus. Morbi ornare pharetra vel dapibus metus; mollis imperdiet nullam. Hac consectetur velit pretium turpis enim rutrum lorem.</div>
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Highlight>

export const Primary: Story = {
  args: {
    text: "Lorem ipsum odor amet, consectetuer adipiscing elit. Vitae auctor condimentum magnis massa bibendum imperdiet pellentesque. Ullamcorper sodales gravida blandit tellus; ornare leo fusce erat nisi. Bibendum ut dignissim amet neque eget cursus. Morbi ornare pharetra vel dapibus metus; mollis imperdiet nullam. Hac consectetur velit pretium turpis enim rutrum lorem.",
    highlights: [
      { start: 0, end: 10, color: "hsl(210, 70%, 50%)" },
      { start: 15, end: 25, color: "hsl(120, 40%, 60%)" },
      { start: 20, end: 30, color: "hsl(240, 40%, 60%)" },
      { start: 35, end: 50, color: "hsl(300, 40%, 60%)" },
      { start: 40, end: 55, color: "hsl(30, 40%, 60%)" },
      { start: 45, end: 60, color: "hsl(210, 70%, 50%)" },
    ],
  },
}
