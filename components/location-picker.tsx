"use client"

import { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { MapPinIcon, LocateIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { useReverseGeocode } from "@/hooks/use-reverse-geocode"

const MapView = dynamic(
  () => import("@/components/map-view").then((mod) => ({ default: mod.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted text-muted-foreground">
        Loading map…
      </div>
    ),
  }
)

export interface LocationValue {
  lat: number
  lng: number
  label: string
}

interface LocationPickerProps {
  onConfirm: (location: LocationValue) => void
  defaultLocation?: { lat: number; lng: number }
}

const DEFAULT_CENTER = { lat: 36.7538, lng: 3.0588 }

function truncateLabel(label: string, max = 40) {
  return label.length > max ? label.slice(0, max) + "…" : label
}

export function LocationPicker({ onConfirm, defaultLocation }: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState<{ lat: number; lng: number }>(
    defaultLocation ?? DEFAULT_CENTER
  )
  const [confirmedLabel, setConfirmedLabel] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const { label: pinLabel, loading: geoLoading } = useReverseGeocode(pin.lat, pin.lng)

  const handleMyLocation = useCallback(() => {
    setGeoError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      (err) => {
        setGeoError(err.message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPin({ lat, lng })
  }, [])

  const handleMarkerDrag = useCallback((lat: number, lng: number) => {
    setPin({ lat, lng })
  }, [])

  const handleConfirm = useCallback(() => {
    const finalLabel = pinLabel || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
    setConfirmedLabel(finalLabel)
    onConfirm({ lat: pin.lat, lng: pin.lng, label: finalLabel })
    setOpen(false)
  }, [pin, pinLabel, onConfirm])

  const triggerLabel = confirmedLabel ? truncateLabel(confirmedLabel) : "Set location"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" className="gap-2" />}
      >
        <MapPinIcon />
        {triggerLabel}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick a location</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="self-start gap-2"
            onClick={handleMyLocation}
            disabled={locating}
          >
            {locating ? <Loader2Icon className="animate-spin" /> : <LocateIcon />}
            {locating ? "Detecting…" : "Use my location"}
          </Button>

          {geoError && (
            <Badge variant="destructive" className="self-start">
              {geoError}
            </Badge>
          )}

          <MapView
            lat={pin.lat}
            lng={pin.lng}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              {geoLoading && " — resolving address…"}
            </div>

            <DialogClose
              render={<Button size="sm" onClick={handleConfirm} />}
            >
              Confirm location
            </DialogClose>
          </div>

          {pinLabel && !geoLoading && (
            <p className="text-xs text-muted-foreground line-clamp-2">{pinLabel}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}