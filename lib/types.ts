export interface Menu {
  raw: string;
  name: string;
  price: number | null;
  unit: "kg" | "g" | "pan" | "count" | "size" | "serving" | "none";
  unit_raw: string | null;
}

export interface Sides {
  headButter: boolean;
  ramen: boolean;
  friedRice: boolean;
}

export type PlaceTag = "grill" | "raw";

export interface Place {
  id: string;
  name: string;
  gu: string;
  addressRoad: string;
  addressJibun: string | null;
  lat: number;
  lng: number;
  tags: PlaceTag[];
  specialist: boolean;
  naverPlaceUrl: string | null;
  menus: Menu[];
  sides: Sides;
  source: "seed" | "report";
  needsReview: boolean;
  lastCheckedAt: string;
  checkCount: number;
  isNew: boolean;
  createdAt?: string;
}

export interface Checkin {
  placeId: string;
  type: "visited" | "menu_verified";
  at: string;
  actor: string;
}

export interface Review {
  placeId: string;
  rating: number;
  text: string;
  nickname: string;
  at: string;
}
