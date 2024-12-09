import { overpass, OverpassQueryBuilder } from "./src";
import { overpassJson } from "overpass-ts";

const query = new OverpassQueryBuilder()
  .area({ type: "key", key: "iata", value: "BOS" })
  .waysInArea()
  .withTags([
    { key: "aeroway", operator: "=", value: "terminal" },
    { key: "building", existence: "exists" },
  ])
  .out("body")
  .recurse("down") // This will add the >; statement
  .out("skel qt")
  .build();

const queryStr = `
  [out:json];
  area["iata"="BOS"];
  (
    way(area)["aeroway"="terminal"]["building"];
  );
  out body;
  >;
  out skel qt;
  `;

`
  [out:json];
  area["iata"="BOS"]->.searchArea;
  (
    way(area:a)(["aeroway"="terminal"]["building"]);
  out body;
  >;
  out skel body;
    );`;

async function main() {
  const result = await overpass(query, {
    output: "geojson",
  });

  console.log(result);
}

// console.log(query);
main();
