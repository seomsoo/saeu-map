import { getPlaces } from "@/lib/data";
import NaverMapProvider from "@/components/map/naver-map-provider";
import MapWithMarkers from "@/components/map/map-with-markers";

export default function HomePage() {
  const places = getPlaces();

  return (
    <main className="h-dvh w-full">
      <NaverMapProvider>
        <MapWithMarkers places={places} />
      </NaverMapProvider>
    </main>
  );
}
