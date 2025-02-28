import { Button } from "@/components/ui/button"

import { ButtonGroup } from "@/components/ui/button-group"

export default function Menu() {
  return (
    <div>
      <ButtonGroup>
        <Button variant="outline">Reset highlight</Button>
        <Button variant="outline">Export labels</Button>
        <Button variant="outline">Share</Button>
      </ButtonGroup>
    </div>
  )
}
