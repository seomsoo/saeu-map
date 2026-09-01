import type { Checkin, Place, PlaceTag, Review } from "./types";

import placesJson from "./mock/places.json";
import checkinsJson from "./mock/checkins.json";
import reviewsJson from "./mock/reviews.json";

const places = placesJson as Place[];
const checkins = checkinsJson as Checkin[];
const reviews = reviewsJson as Review[];

export interface PlaceFilter {
  tag?: PlaceTag;
  gu?: string;
  isNew?: boolean;
  query?: string;
}

export function getPlaces(filter?: PlaceFilter): Place[] {
  if (!filter) return places;

  return places.filter((p) => {
    if (filter.tag && !p.tags.includes(filter.tag)) return false;
    if (filter.gu && p.gu !== filter.gu) return false;
    if (filter.isNew !== undefined && p.isNew !== filter.isNew) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.gu.includes(q))
        return false;
    }
    return true;
  });
}

export function getPlaceById(id: string): Place | undefined {
  return places.find((p) => p.id === id);
}

export function getCheckins(placeId?: string): Checkin[] {
  if (!placeId) return checkins;
  return checkins.filter((c) => c.placeId === placeId);
}

export function getReviews(placeId?: string): Review[] {
  if (!placeId) return reviews;
  return reviews.filter((r) => r.placeId === placeId);
}
