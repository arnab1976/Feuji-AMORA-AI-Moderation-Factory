import { useEffect, useRef, useState } from 'react'
import type { LogLine } from '../api/client'

/** Streams agent log lines into the console for live run feedback. */
export function Terminal({ lines, animate = true }: { lines: LogLine[]; animate?: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : lines.length)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!animate) { setShown(lines.length); return }
    setShown(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setShown(i)
      if (i >= lines.length) clearInterval(t)
    }, 110)
    return () => clearInterval(t)
  }, [lines, animate])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [shown])

  return (
    <div className="term" ref={boxRef} role="log" aria-live="polite">
      {lines.slice(0, shown).map(([level, text], i) => (
        <span className={`l ${level}`} key={i}>{text}</span>
      ))}
    </div>
  )
}
