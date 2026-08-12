import { useMemo, useState } from 'react'
import type { InputField } from '../api/client'

interface Props {
  fields: InputField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  variant?: 'default' | 'dash'
}

function FieldControl({
  f,
  values,
  onChange,
  dash,
}: {
  f: InputField
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  dash: boolean
}) {
  if (f.type === 'select') {
    const opts = (f.options ?? []) as string[][]
    if (dash) {
      return (
        <div className="fld dash-fld">
          <label>{f.label}</label>
          {f.hint && <p className="fh">{f.hint}</p>}
          <div className="dash-pills">
            {opts.map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={`dash-pill${values[f.key] === v ? ' on' : ''}`}
                onClick={() => onChange(f.key, v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="fld">
        <label htmlFor={f.key}>{f.label}</label>
        {f.hint && <p className="fh">{f.hint}</p>}
        <select
          id={f.key}
          value={(values[f.key] as string) ?? opts[0]?.[0] ?? ''}
          onChange={(e) => onChange(f.key, e.target.value)}
        >
          {opts.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    )
  }
  if (f.type === 'text') {
    return (
      <div className={`fld${dash ? ' dash-fld' : ''}`}>
        <label htmlFor={f.key}>{f.label}</label>
        {f.hint && <p className="fh">{f.hint}</p>}
        <input
          id={f.key}
          type="text"
          value={(values[f.key] as string) ?? (f.default as string) ?? ''}
          onChange={(e) => onChange(f.key, e.target.value)}
        />
      </div>
    )
  }
  const opts = (f.options ?? []) as string[][]
  const current = (values[f.key] as string[]) ?? (f.default as string[]) ?? []
  return (
    <div className={`fld${dash ? ' dash-fld' : ''}`}>
      <label>{f.label}</label>
      {f.hint && <p className="fh">{f.hint}</p>}
      {opts.map(([v, l, note]) => (
        <label className={`ck${dash ? ' dash-ck' : ''}`} key={v}>
          <input
            type="checkbox"
            checked={current.includes(v)}
            onChange={(e) =>
              onChange(
                f.key,
                e.target.checked ? [...current, v] : current.filter((x) => x !== v),
              )
            }
          />
          <span>
            {l}
            {note && <small>{note}</small>}
          </span>
        </label>
      ))}
    </div>
  )
}

function groupFields(fields: InputField[]): { category: string | null; fields: InputField[] }[] {
  const groups: { category: string | null; fields: InputField[] }[] = []
  for (const f of fields) {
    const cat = f.category ?? null
    const last = groups[groups.length - 1]
    if (last && last.category === cat) last.fields.push(f)
    else groups.push({ category: cat, fields: [f] })
  }
  return groups
}

export function InputForm({ fields, values, onChange, variant = 'default' }: Props) {
  const dash = variant === 'dash'
  const { pinned, groups } = useMemo(() => {
    const pinnedFields = fields.filter((f) => !f.category)
    const categorized = fields.filter((f) => f.category)
    return { pinned: pinnedFields, groups: groupFields(categorized) }
  }, [fields])
  const hasCategories = groups.some((g) => g.category)
  const [active, setActive] = useState(0)

  if (!hasCategories) {
    return (
      <>
        {fields.map((f) => (
          <FieldControl key={f.key} f={f} values={values} onChange={onChange} dash={dash} />
        ))}
      </>
    )
  }

  const current = groups[Math.min(active, groups.length - 1)]

  return (
    <div className={dash ? 'dash-intake' : 'intake-groups'}>
      {pinned.length > 0 && (
        <div className="dash-intake-pinned">
          {pinned.map((f) => (
            <FieldControl key={f.key} f={f} values={values} onChange={onChange} dash={dash} />
          ))}
        </div>
      )}
      <p className="dash-intake-banner">
        {groups.length} intake categories · fill each, then run the agent
      </p>
      <div className="dash-cat-nav" role="tablist" aria-label="Intake categories">
        {groups.map((g, i) => (
          <button
            key={g.category ?? `g-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={`dash-cat-tab${i === active ? ' on' : ''}`}
            onClick={() => setActive(i)}
          >
            {g.category ?? `Section ${i + 1}`}
          </button>
        ))}
      </div>
      {current && (
        <section className="dash-cat-panel" aria-label={current.category ?? 'Inputs'}>
          <h5 className="dash-cat-heading">{current.category ?? 'Inputs'}</h5>
          <div className="dash-cat-body">
            {current.fields.map((f) => (
              <FieldControl key={f.key} f={f} values={values} onChange={onChange} dash={dash} />
            ))}
          </div>
          <div className="dash-cat-pager">
            <button
              type="button"
              className="dash-pill"
              disabled={active <= 0}
              onClick={() => setActive((n) => Math.max(0, n - 1))}
            >
              ← Previous
            </button>
            <span>
              {active + 1} / {groups.length}
            </span>
            <button
              type="button"
              className="dash-pill"
              disabled={active >= groups.length - 1}
              onClick={() => setActive((n) => Math.min(groups.length - 1, n + 1))}
            >
              Next →
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
