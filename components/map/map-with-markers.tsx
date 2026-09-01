"use client";

import { Container, Marker, NaverMap, useNavermaps } from "react-naver-maps";
import type { Place } from "@/lib/types";

const MARKER_COLORS = {
  grill: "#F0885C",
  raw: "#14957B",
} as const;

function getMarkerColor(tags: Place["tags"]): string {
  if (tags.includes("grill")) return MARKER_COLORS.grill;
  return MARKER_COLORS.raw;
}

function CircleMarkerIcon(color: string, isNew: boolean) {
  const stroke = isNew
    ? `stroke-dasharray="3 2" stroke="${color}"`
    : `stroke="${color}"`;
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5.5" fill="${color}" ${stroke} stroke-width="1.5" fill-opacity="0.9"/></svg>`,
  )}`;
}

function PlaceMarkers({ places }: { places: Place[] }) {
  const navermaps = useNavermaps();

  return (
    <>
      {places.map((place) => {
        const color = getMarkerColor(place.tags);
        return (
          <Marker
            key={place.id}
            position={new navermaps.LatLng(place.lat, place.lng)}
            title={place.name}
            icon={{
              url: CircleMarkerIcon(color, place.isNew),
              size: new navermaps.Size(14, 14),
              anchor: new navermaps.Point(7, 7),
            }}
          />
        );
      })}
    </>
  );
}

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

export default function MapWithMarkers({ places }: { places: Place[] }) {
  return (
    <Container
      style={{
        width: "100%",
        height: "100dvh",
      }}
    >
      <NaverMap
        defaultCenter={SEOUL_CENTER}
        defaultZoom={12}
        minZoom={10}
        maxZoom={19}
        scaleControl={false}
        mapDataControl={false}
      >
        <PlaceMarkers places={places} />
      </NaverMap>
    </Container>
  );
}
