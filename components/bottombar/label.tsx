import { Checkbox } from "@/components/ui/checkbox"
import { Window } from "@/components/ui/window"
import { useTrackedLabelsStore } from "@/store/useLabelsStore"
import { produce } from "immer"
import { useEffect, useMemo, useState } from "react"

interface CandidateProps {
  candidate: Array<string>
  prefix: string | null
  initialData?: Array<string>
  onResultChange: (labelData: Array<string>) => void
  disabled?: boolean
}

function Candidate({ candidate, prefix, initialData, onResultChange, disabled = false }: CandidateProps) {
  const newLabels = Object.fromEntries(candidate.map(item => [item, false]))
  let hasPrefix = false

  if (initialData) {
    initialData.forEach((item) => {
      if (item.includes(".") && prefix) {
        const [_prefix, _candidate] = item.split(".")
        if (_prefix === prefix) {
          newLabels[_candidate] = true
          hasPrefix = true
        }
      } else if (item === prefix) {
        hasPrefix = true
      }
    })
  }

  const [labels, setLabels] = useState(newLabels)
  const [prefixSelected, setPrefixSelected] = useState(hasPrefix)

  function handleChange(item: string, value: boolean | "indeterminate") {
    if (value === "indeterminate") {
      return
    }

    setLabels(produce(labels, (draft) => {
      draft[item] = value
    }))
  }

  function handlePrefixChange(value: boolean | "indeterminate") {
    if (value === "indeterminate") {
      return
    }

    if (!value) {
      setLabels({} as Record<string, boolean>)
    }
    setPrefixSelected(value)
  }

  const result = useMemo(() => {
    if (prefix) {
      const memo = Object.entries(labels).filter(([_, value]) => value).map(([key, _]) => `${prefix}.${key}`)
      if (memo.length > 0) {
        return memo
      }
      if (prefixSelected) {
        return [prefix]
      }
      return []
    }

    return Object.entries(labels).filter(([_, value]) => value).map(([key, _]) => key)
  }, [labels, prefix, prefixSelected])

  useEffect(() => {
    onResultChange(result)
  }, [result, onResultChange])

  return (
    <div>
      { prefix && (
        <div className="flex items-center space-x-2">
          <Checkbox id={prefix} checked={prefixSelected} onCheckedChange={handlePrefixChange} disabled={disabled} />
          <label htmlFor={prefix} className="font-bold">{prefix}</label>
        </div>
      )}
      {(prefixSelected || !prefix) && (
        <div className="flex flex-col gap-2">
          {candidate.map(item => (
            <div className="flex items-center space-x-2" key={item}>
              <Checkbox id={item} checked={labels[item]} onCheckedChange={value => handleChange(item, value)} disabled={disabled} />
              <label
                htmlFor={item}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {item}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface LabelProps {
  initialData?: Array<string>
  onResultChange: (labelData: Array<string>) => void
  disabled?: boolean
}

export default function Label({ initialData, onResultChange, disabled = false }: LabelProps) {
  const labelsStore = useTrackedLabelsStore()
  const outerCandidate = labelsStore.candidates.filter(item => typeof item === "string")
  const innerCandidate = (labelsStore.candidates.filter(item => typeof item === "object")).reduce((acc, obj) => {
    return { ...acc, ...obj }
  }, {})

  const outerInitial = initialData ? initialData.filter(item => outerCandidate.includes(item)) : []
  const [outerResult, setOuterResult] = useState<string[]>(outerInitial)

  const innerInitial = Object.entries(innerCandidate).reduce((acc, [prefix]) => ({
    ...acc,
    [prefix]: initialData ? initialData.filter(item => item.startsWith(`${prefix}.`)) : [],
  }), {} as Record<string, string[]>)
  const [innerResult, setInnerResult] = useState(innerInitial)

  const handleInnerResultChange = (key: string, result: string[]) => {
    setInnerResult(produce(innerResult, (draft) => {
      draft[key] = result
    }))
  }

  useEffect(() => {
    const result = [...outerResult, ...Object.values(innerResult).flat()]
    onResultChange(result)
  }, [outerResult, innerResult, onResultChange])

  return (
    <Window name="Label">
      <div>
        <Candidate candidate={outerCandidate} initialData={outerInitial} onResultChange={setOuterResult} prefix={null} disabled={disabled} />
        {Object.entries(innerCandidate).map(([key, value]) => (
          <Candidate
            candidate={value}
            initialData={innerInitial[key]}
            onResultChange={result => handleInnerResultChange(key, result)}
            prefix={key}
            key={key}
            disabled={disabled}
          />
        ))}
      </div>
    </Window>
  )
}
