import { expect, test } from "vitest";
import { overpass } from "../services/overpass";
import { OverpassOutput } from "../types/fetch";

const query = `
    [out:json];
    area["iata"="BOS"];
    (
      wr(area)["aeroway"="terminal"]["building"];
    );
    out body;
    >;
    out skel qt;
  `;

test("overpass - raw", async () => {
  const response = await overpass<OverpassOutput.Raw>(query);

  expect(response).toHaveProperty("elements");
  expect(response.elements).toBeInstanceOf(Array);
  expect(response.elements[0]).toHaveProperty("tags");
  expect(response.elements[0]?.tags).toEqual(expect.objectContaining({ building: "yes" }));
});

test("overpass - parsed", async () => {
  const response = await overpass<OverpassOutput.Parsed>(query, {
    output: OverpassOutput.Parsed,
  });

  expect(response).toHaveProperty("elements");
  expect(response.elements).toBeInstanceOf(Array);
  expect(response.elements[0]).toHaveProperty("tags");
  expect(response.elements[0]?.tags).toEqual(expect.objectContaining({ building: true }));
});

test("overpass - geojson", async () => {
  const response = await overpass<OverpassOutput.GeoJSON>(query, {
    output: OverpassOutput.GeoJSON,
  });

  expect(response).toHaveProperty("features");
  expect(response.features).toBeInstanceOf(Array);
  expect(response.features[0]).toHaveProperty("properties");
  expect(response.features[0]?.properties).toEqual(expect.objectContaining({ building: "yes" }));
});

test("overpass - parsed geojson", async () => {
  const response = await overpass<OverpassOutput.ParsedGeoJSON>(query, {
    output: OverpassOutput.ParsedGeoJSON,
  });

  expect(response).toHaveProperty("features");
  expect(response.features).toBeInstanceOf(Array);
  expect(response.features[0]).toHaveProperty("properties");
  expect(response.features[0]?.properties).toEqual(expect.objectContaining({ building: true }));
});
