import { useEffect, useState } from 'react'

import { msUntilNextCalendarDay } from './inbox'

export function useCalendarClock(timeZone: string): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const wait = msUntilNextCalendarDay(now, timeZone)
    const timer = window.setTimeout(() => {
      setNow(Date.now())
    }, wait)

    return () => {
      window.clearTimeout(timer)
    }
  }, [now, timeZone])

  return now
}
