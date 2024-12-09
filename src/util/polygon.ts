interface PolygonFeatureDefinition {
  key: string;
  polygon: "all" | "whitelist" | "blacklist";
  values: string[];
}

const osmPolygonFeatures: PolygonFeatureDefinition[] = [
  {
    key: "building",
    polygon: "all",
    values: [],
  },
  {
    key: "building:part",
    polygon: "all",
    values: [],
  },
  {
    key: "landuse",
    polygon: "all",
    values: [],
  },
  {
    key: "natural",
    polygon: "whitelist",
    values: [
      "wood",
      "forest",
      "scrub",
      "heath",
      "grassland",
      "fell",
      "bare_rock",
      "scree",
      "shingle",
      "sand",
      "mud",
      "water",
      "wetland",
      "glacier",
      "bay",
      "beach",
      "spring",
      "hot_spring",
      "rock",
      "stone",
      "sinkhole",
    ],
  },
  {
    key: "leisure",
    polygon: "whitelist",
    values: [
      "park",
      "garden",
      "pitch",
      "golf_course",
      "sports_centre",
      "stadium",
      "swimming_pool",
      "track",
      "playground",
      "common",
      "nature_reserve",
      "recreation_ground",
      "dog_park",
      "fitness_station",
    ],
  },
  {
    key: "amenity",
    polygon: "whitelist",
    values: [
      "parking",
      "school",
      "college",
      "university",
      "hospital",
      "kindergarten",
      "grave_yard",
      "marketplace",
      "fuel",
      "parking_space",
      "parking_entrance",
      "restaurant",
      "cafe",
      "fast_food",
      "bicycle_parking",
    ],
  },
  {
    key: "highway",
    polygon: "whitelist",
    values: ["pedestrian", "services", "rest_area", "platform"],
  },
  {
    key: "historic",
    polygon: "whitelist",
    values: [
      "archaeological_site",
      "ruins",
      "castle",
      "fort",
      "memorial",
      "monument",
      "battlefield",
    ],
  },
  {
    key: "water",
    polygon: "all",
    values: [],
  },
  {
    key: "waterway",
    polygon: "whitelist",
    values: ["riverbank", "dock", "boatyard", "dam", "waterfall"],
  },
  {
    key: "boundary",
    polygon: "all",
    values: [],
  },
  {
    key: "man_made",
    polygon: "whitelist",
    values: [
      "pier",
      "breakwater",
      "groyne",
      "reservoir_covered",
      "bridge",
      "tower",
      "lighthouse",
      "windmill",
      "works",
      "watermill",
      "wastewater_plant",
      "water_works",
      "storage_tank",
      "silo",
      "telescope",
    ],
  },
  {
    key: "military",
    polygon: "whitelist",
    values: [
      "airfield",
      "bunker",
      "barracks",
      "danger_area",
      "range",
      "naval_base",
      "training_area",
    ],
  },
  {
    key: "tourism",
    polygon: "whitelist",
    values: [
      "attraction",
      "camp_site",
      "caravan_site",
      "picnic_site",
      "theme_park",
      "zoo",
      "museum",
      "hotel",
      "motel",
      "guest_house",
      "hostel",
    ],
  },
  {
    key: "shop",
    polygon: "all",
    values: [],
  },
  {
    key: "aeroway",
    polygon: "whitelist",
    values: ["aerodrome", "heliport", "terminal", "hangar", "apron", "taxiway", "runway"],
  },
  {
    key: "place",
    polygon: "whitelist",
    values: ["city", "town", "village", "hamlet", "suburb", "neighbourhood", "island", "islet"],
  },
  {
    key: "power",
    polygon: "whitelist",
    values: ["plant", "substation", "generator", "transformer"],
  },
  {
    key: "public_transport",
    polygon: "whitelist",
    values: ["platform", "station"],
  },
  {
    key: "office",
    polygon: "all",
    values: [],
  },
  {
    key: "area",
    polygon: "all",
    values: [],
  },
];

/**
 * isPolygonFeature - check if a feature is a polygon
 *
 * @param tags - feature tags to check against
 */
export function isPolygonFeature(tags: Record<string, string>): boolean {
  if (tags.area === "no") return false;

  for (const key in tags) {
    const val = tags[key];
    // @ts-ignore
    const pfk = osmPolygonFeatures[key];

    if (typeof pfk === "undefined") continue;
    if (val === "no") continue;

    if (pfk === true) return true;
    if (pfk.included_values && pfk.included_values[val] === true) return true;
    if (pfk.excluded_values && pfk.excluded_values[val] !== true) return true;
  }

  return false;
}
