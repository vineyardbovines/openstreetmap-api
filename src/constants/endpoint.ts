export const OverpassEndpoint = {
  Main: "https://overpass-api.de/api/interpreter",
  MainAlt1: "https://lz4.overpass-api.de/api/interpreter",
  MainAlt2: "https://z.overpass-api.de/api/interpreter",
  Kumi: "https://overpass.kumi.systems/api/interpreter",
  KumiAlt1: "https://bib.kumi.systems/api/interpreter",
  KumiAlt2: "https://willard.kumi.systems/api/interpreter",
  KumiAlt3: "https://dodonna.kumi.systems/api/interpreter",
  France: "https://overpass.openstreetmap.fr/api/interpreter",
  Switzerland: "https://overpass.osm.ch/api/interpreter",
  Russia: "https://overpass.openstreetmap.ru/api/interpreter",
  USMil: "https://osm-overpass.gs.mil/overpass/interpreter",
};

export type OverpassEndpointKey = keyof typeof OverpassEndpoint;
