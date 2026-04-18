"use client"

import { useEffect, useRef } from "react"
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface MapViewProps {
  lat: number
  lng: number
  onMapClick: (lat: number, lng: number) => void
  onMarkerDrag: (lat: number, lng: number) => void
}

function FlyToCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const prevRef = useRef(`${lat},${lng}`)

  useEffect(() => {
    const key = `${lat},${lng}`
    if (key !== prevRef.current) {
      map.flyTo([lat, lng], 15, { duration: 1 })
      prevRef.current = key
    }
  }, [lat, lng, map])

  return null
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function DraggableMarker({ lat, lng, onMarkerDrag }: { lat: number; lng: number; onMarkerDrag: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker) {
        const pos = marker.getLatLng()
        onMarkerDrag(pos.lat, pos.lng)
      }
    },
  }

  return (
    <Marker
      position={[lat, lng]}
      draggable
      eventHandlers={eventHandlers}
      ref={markerRef}
    />
  )
}

export function MapView({ lat, lng, onMapClick, onMarkerDrag }: MapViewProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      style={{ height: 400, width: "100%", borderRadius: 8 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToCenter lat={lat} lng={lng} />
      <ClickHandler onMapClick={onMapClick} />
      <DraggableMarker lat={lat} lng={lng} onMarkerDrag={onMarkerDrag} />
    </MapContainer>
  )
}