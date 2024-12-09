import { deepMerge } from "../util/common";
import type { ParsedOverpassOSMElement } from "../util/parse";
import { isPolygonFeature } from "../util/polygon";
import { rewind } from "../util/rewind";
import {
  OverpassElementType,
  type OverpassNode,
  type OverpassOSMElement,
  type OverpassRelation,
  type OverpassWay,
} from "./../types/overpass";

function buildMetaInformation(object: OverpassOSMElement): Record<string, string> {
  const temp: Record<string, string | undefined> = {
    timestamp: object.timestamp,
    version: object.version,
    changeset: object.changeset,
    user: object.user,
    uid: object.uid,
  };

  const meta: Record<string, string> = {};

  Object.entries(temp).forEach(([key, value]) => {
    if (value !== undefined) {
      meta[key] = value;
    }
  });

  return meta;
}

function dedup<T extends OverpassOSMElement>(objectA: T, objectB: T): T {
  if ((objectA.version || objectB.version) && objectA.version !== objectB.version) {
    return +(objectA.version || 0) > +(objectB.version || 0) ? objectA : objectB;
  }
  return deepMerge({}, objectA, objectB) as T;
}

/**
 * osm2geojson - convert osm elements to GeoJSON
 *
 * @param props - overpass elements
 * @param props.nodes - overpass nodes
 * @param props.ways - overpass ways
 * @param props.rels - overpass relations
 */
export function osm2geojson(
  elements: OverpassOSMElement[] | ParsedOverpassOSMElement[]
): GeoJSON.FeatureCollection {
  const nodes = elements.filter(
    (element) => element.type === OverpassElementType.Node
  ) as OverpassNode[];
  const ways = elements.filter(
    (element) => element.type === OverpassElementType.Way
  ) as OverpassWay[];
  const rels = elements.filter(
    (element) => element.type === OverpassElementType.Relation
  ) as OverpassRelation[];

  const nodeIds: Record<string, OverpassNode> = {};

  for (let node of nodes) {
    if (nodeIds[node.id]) {
      node = dedup<OverpassNode>(node, nodeIds[node.id] as OverpassNode);
    }
    nodeIds[node.id] = node;
  }

  const wayIds: Record<string, OverpassWay> = {};
  const wayNodeIds: Record<string, boolean> = {};

  for (let way of ways) {
    if (wayIds[way.id] !== undefined) {
      way = dedup<OverpassWay>(way, wayIds[way.id] as OverpassWay);
    }
    wayIds[way.id] = way;

    for (const nodeId of way.nodes) {
      wayNodeIds[nodeId] = true;
    }
  }

  const pois: OverpassNode[] = [];
  for (const id in nodeIds) {
    const numId = Number(id);

    if (!wayNodeIds[numId]) {
      pois.push(nodeIds[numId] as OverpassNode);
    }
  }

  const relationIds: Record<string, OverpassRelation> = {};
  for (let rel of rels) {
    if (relationIds[rel.id]) {
      rel = dedup<OverpassRelation>(rel, relationIds[rel.id] as OverpassRelation);
    }
    relationIds[rel.id] = rel;
  }

  // Build relation member mappings
  const relsMap: Record<
    OverpassElementType,
    Record<
      number,
      Array<{
        role: string;
        rel: number;
        reltags?: Record<string, string>;
      }>
    >
  > = {
    [OverpassElementType.Node]: {},
    [OverpassElementType.Way]: {},
    [OverpassElementType.Relation]: {},
  };

  for (const rel of Object.values(relationIds)) {
    for (const member of rel.members) {
      const memberType = member.type;
      const memberRef = member.ref;

      if (!relsMap[memberType][memberRef]) {
        relsMap[memberType][memberRef] = [];
      }

      relsMap[memberType][memberRef].push({
        role: member.role,
        rel: rel.id,
        reltags: rel.tags,
      });
    }
  }

  const features: GeoJSON.Feature[] = [];

  for (const poi of pois) {
    const feature: GeoJSON.Feature = {
      type: "Feature",
      id: `${poi.type}/${poi.id}`,
      properties: {
        type: poi.type,
        id: poi.id,
        tags: poi.tags ?? {},
        relations: relsMap[OverpassElementType.Node][poi.id] ?? [],
        meta: buildMetaInformation(poi),
      },
      geometry: {
        type: "Point",
        coordinates: [poi.lon, poi.lat],
      },
    };

    features.push(feature);
  }

  for (const way of Object.values(wayIds)) {
    const coords: [number, number][] = [];

    // Use geometry if available, otherwise build from nodes
    if (way.geometry?.length) {
      for (const point of way.geometry) {
        coords.push([point.lon, point.lat] as [number, number]);
      }
    } else {
      for (const nodeId of way.nodes) {
        const node = nodeIds[nodeId];
        if (node) {
          coords.push([node.lon, node.lat]);
        }
      }
    }

    if (coords.length <= 1) continue;

    const first = coords?.[0];
    const last = coords?.[coords.length - 1];
    const isClosed = first?.[0] === last?.[0] && first?.[1] === last?.[1];

    const isPolygon = isClosed && way.tags && isPolygonFeature(way.tags);

    const baseFeature: Omit<GeoJSON.Feature, "geometry"> = {
      type: "Feature",
      id: `${way.type}/${way.id}`,
      properties: {
        type: way.type,
        id: way.id,
        tags: way.tags ?? {},
        relations: relsMap[OverpassElementType.Way][way.id] ?? [],
        meta: buildMetaInformation(way),
      },
    };

    const polygonFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
      ...baseFeature,
      geometry: {
        type: "Polygon",
        coordinates: [coords],
      },
    };

    const lineStringFeature: GeoJSON.Feature<GeoJSON.LineString> = {
      ...baseFeature,
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    };

    features.push(isPolygon ? polygonFeature : lineStringFeature);
  }

  const flattenedFeatures = features.map((feature) => ({
    ...feature,
    properties: deepMerge({}, feature.properties?.meta ?? {}, feature.properties?.tags ?? {}, {
      id: `${feature.properties?.type}/${feature.properties?.id}`,
    }),
  }));

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: flattenedFeatures,
  };

  // @ts-ignore
  return rewind(geojson);
}
