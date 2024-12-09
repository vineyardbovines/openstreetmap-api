import type { OverpassEndpoint, OverpassEndpointKey } from "../constants/endpoint";
import type { ParsedOverpassOSMElement } from "../util/parse";
import type { OverpassElement } from "./overpass";

export interface OverpassFetchRetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoff: number;
}

export interface OverpassFetchOptions<T extends OverpassOutput> {
  endpoint?: (typeof OverpassEndpoint)[OverpassEndpointKey];
  verbose?: boolean;
  userAgent?: string;
  retry?: OverpassFetchRetryOptions;
  fallbackEndpoints?: OverpassEndpointKey[];
  output?: T;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  osm2s: {
    timestamp_osm_base: string;
    timestamp_areas_base?: string;
    copyright: string;
  };
  elements: OverpassElement[] | ParsedOverpassOSMElement[];
  remark?: string;
}

export enum OverpassOutput {
  Raw = "raw",
  Parsed = "parsed",
  GeoJSON = "geojson",
  ParsedGeoJSON = "parsed-geojson",
}
