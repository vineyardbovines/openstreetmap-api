import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

/**
 * Rewinds GeoJSON rings to follow the right-hand rule
 * @param gj GeoJSON object to rewind
 * @param outer direction for outer rings (true = clockwise)
 * @returns rewound GeoJSON object
 */
export function rewind(gj: GeoJSON, outer = true): GeoJSON {
  const type = gj?.type;

  switch (type) {
    case "FeatureCollection": {
      const featureCollection = gj as FeatureCollection;
      for (let i = 0; i < featureCollection.features.length; i++) {
        rewind(featureCollection.features[i] as Feature, outer);
      }
      break;
    }

    case "GeometryCollection": {
      const geometryCollection = gj as GeometryCollection;
      for (let i = 0; i < geometryCollection.geometries.length; i++) {
        rewind(geometryCollection.geometries[i] as Geometry, outer);
      }
      break;
    }

    case "Feature": {
      const feature = gj as Feature;
      rewind(feature.geometry, outer);
      break;
    }

    case "Polygon": {
      const polygon = gj as Polygon;
      rewindRings(polygon.coordinates, outer);
      break;
    }

    case "MultiPolygon": {
      const multiPolygon = gj as MultiPolygon;
      for (let i = 0; i < multiPolygon.coordinates.length; i++) {
        rewindRings(multiPolygon.coordinates[i] as Position[][], outer);
      }
      break;
    }
  }

  return gj;
}

/**
 * Rewinds all rings in a polygon
 * @param rings array of rings (arrays of coordinates)
 * @param outer direction for outer ring (true = clockwise)
 */
function rewindRings(rings: Position[][], outer: boolean): void {
  if (rings.length === 0) return;

  // Rewind outer ring clockwise
  rewindRing(rings[0] as Position[], outer);

  // Rewind inner rings counterclockwise
  for (let i = 1; i < rings.length; i++) {
    rewindRing(rings[i] as Position[], !outer);
  }
}

/**
 * Rewinds a single ring based on shoelace formula area
 * @param ring array of coordinates
 * @param dir desired direction (true = clockwise)
 */
function rewindRing(ring: Position[], dir: boolean): void {
  let area = 0;
  let err = 0;

  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];

    const k = (xi - xj) * (yj + yi);
    const m = area + k;
    err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
    area = m;
  }

  if (area + err >= 0 !== !!dir) {
    ring.reverse();
  }
}
