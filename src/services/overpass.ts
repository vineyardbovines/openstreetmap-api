import type { FeatureCollection } from "geojson";
import { OverpassEndpoint, type OverpassEndpointKey } from "../constants/endpoint";
import {
  type OverpassFetchOptions,
  type OverpassFetchRetryOptions,
  OverpassOutput,
  type OverpassResponse,
} from "../types/fetch";
import { OverpassError, getStatusError } from "../util/error";
import { log } from "../util/log";
import { parseElementTags } from "../util/parse";
import { osm2geojson } from "./geojson";

const defaultRetryOptions: OverpassFetchRetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoff: 2,
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getDefaultFallbacks = (primary: OverpassEndpointKey): OverpassEndpointKey[] => {
  if (primary.startsWith("Main")) {
    return ["MainAlt1", "MainAlt2"];
  }

  if (primary.startsWith("Kumi")) {
    return ["KumiAlt1", "KumiAlt2", "KumiAlt3"];
  }

  return ["Main", "Kumi", "France"];
};

type OverpassReturn<T> = T extends OverpassOutput.GeoJSON | OverpassOutput.ParsedGeoJSON
  ? FeatureCollection
  : OverpassResponse;

/**
 * overpass - query the overpass API
 *
 * @param query - overpass query
 * @param OverpassFetchOptions - overpass fetch options
 */
export async function overpass<T extends OverpassOutput = OverpassOutput.Raw>(
  query: string,
  OverpassFetchOptions?: OverpassFetchOptions<T>
): Promise<OverpassReturn<T>> {
  const opts = {
    endpoint: OverpassEndpoint.Main,
    verbose: false,
    userAgent: "overpass",
    retry: defaultRetryOptions,
    ...OverpassFetchOptions,
  };

  const primaryEndpoint = (Object.entries(OverpassEndpoint).find(
    ([_, value]) => value === opts.endpoint
  )?.[0] || "Main") as OverpassEndpointKey;

  const fallbackEndpoints = opts.fallbackEndpoints ?? getDefaultFallbacks(primaryEndpoint);
  let currentEndpointIndex = -1;

  let delay = opts.retry.initialDelay;

  for (let i = 0; i <= opts.retry.maxRetries; i++) {
    const currentEndpoint =
      currentEndpointIndex === -1
        ? opts.endpoint
        : OverpassEndpoint[fallbackEndpoints[currentEndpointIndex] as OverpassEndpointKey];

    try {
      if (opts.verbose) {
        log(`Attempt ${i + 1}: Querying ${opts.endpoint}`);
      }

      const fetchOptions: RequestInit = {
        body: `data=${encodeURIComponent(query)}`,
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: {
          Accept: "*",
          "Cache-control": "no-cache",
          Pragma: "no-cache",
          "User-Agent": opts.userAgent,
        },
      };

      const response = await fetch(currentEndpoint, fetchOptions);

      if (response.ok) {
        const json = (await response.json()) as OverpassResponse;

        if (typeof json === "object" && json !== null && "remark" in json) {
          throw new OverpassError(json.remark as string);
        }

        // @ts-ignore
        const parsedJsonElements = json.elements.map(parseElementTags);

        switch (opts.output) {
          case OverpassOutput.GeoJSON:
            return osm2geojson(json.elements) as OverpassReturn<T>;
          case OverpassOutput.Parsed:
            return {
              ...json,
              elements: parsedJsonElements,
            } as OverpassReturn<T>;
          case OverpassOutput.ParsedGeoJSON:
            return osm2geojson(parsedJsonElements) as OverpassReturn<T>;
          case OverpassOutput.Raw:
          default:
            return json as OverpassReturn<T>;
        }
      }

      if ((response.status === 429 || response.status >= 500) && i < opts.retry.maxRetries) {
        const err = await getStatusError({ status: response.status, query, response });
        if (opts.verbose) {
          log(`Request failed: ${err.message}. Retrying in ${delay}ms...`);
        }

        if (currentEndpointIndex < fallbackEndpoints.length - 1) {
          currentEndpointIndex++;
          if (opts.verbose) {
            log(`Switching to fallback endpoint: ${fallbackEndpoints[currentEndpointIndex]}`);
          }
        } else {
          if (opts.verbose) {
            log(`All endpoints attempted, waiting ${delay}ms before retry`);
          }
          await sleep(delay);
          delay = Math.min(delay * opts.retry.backoff, opts.retry.maxDelay);
          currentEndpointIndex = -1;
        }
        continue;
      }

      const err = await getStatusError({ status: response.status, query, response });

      throw err;
    } catch (error) {
      if (i === opts.retry.maxRetries) throw error;

      if (error instanceof Error && opts.verbose) {
        log(`Request failed: ${error.message}`);
      }

      if (currentEndpointIndex < fallbackEndpoints.length - 1) {
        currentEndpointIndex++;
        if (opts.verbose) {
          log(`Switching to fallback endpoint: ${fallbackEndpoints[currentEndpointIndex]}`);
        }
      } else {
        if (opts.verbose) {
          log(`All endpoints attempted, waiting ${delay}ms before retry`);
        }
        await sleep(delay);
        delay = Math.min(delay * opts.retry.backoff, opts.retry.maxDelay);
        currentEndpointIndex = -1;
      }
    }
  }

  throw new Error("Maximum retries exceeded");
}
