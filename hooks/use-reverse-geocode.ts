"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ReverseGeocodeResult {
  label: string
  loading: boolean
  error: string | null
}

export function useReverseGeocode(lat: number | null, lng: number | null): ReverseGeocodeResult {
  const [label, setLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchLabel = useCallback(async (lat: number, lng: number) => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          signal: controller.signal,
          headers: { "User-Agent": "DesArtBarberShop/1.0" },
        }
      )
      if (!res.ok) throw new Error(`Geocode failed: ${res.status}`)
      const data = await res.json()
      setLabel(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Geocode failed")
      setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (lat === null || lng === null) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchLabel(lat, lng)
    }, 600)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [lat, lng, fetchLabel])

  return { label, loading, error }
}