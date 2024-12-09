import { describe, it, expect } from "vitest";
import { OverpassQueryBuilder } from "../middleware/query";

describe("OverpassQueryBuilder", () => {
  describe("initialization", () => {
    it("should initialize with default settings", () => {
      const builder = new OverpassQueryBuilder();
      expect(builder.build()).toContain("[out:json][timeout:25][maxsize:536870912];");
    });

    it("should accept custom settings", () => {
      const builder = new OverpassQueryBuilder({ timeout: 30, maxsize: 1000000 });
      expect(builder.build()).toContain("[timeout:30][maxsize:1000000]");
    });

    it("should allow timeout modification after initialization", () => {
      const builder = new OverpassQueryBuilder().setTimeout(40);
      expect(builder.build()).toContain("[timeout:40]");
    });

    it("should allow maxsize modification after initialization", () => {
      const builder = new OverpassQueryBuilder().setMaxSize(2000000);
      expect(builder.build()).toContain("[maxsize:2000000]");
    });
  });

  describe("element types", () => {
    it("should create node query", () => {
      const builder = new OverpassQueryBuilder().node();
      expect(builder.build()).toContain("node");
    });

    it("should create way query", () => {
      const builder = new OverpassQueryBuilder().way();
      expect(builder.build()).toContain("way");
    });

    it("should create relation query", () => {
      const builder = new OverpassQueryBuilder().relation();
      expect(builder.build()).toContain("relation");
    });

    it("should handle multiple element IDs", () => {
      const builder = new OverpassQueryBuilder().node("(123,456,789)");
      const query = builder.build();
      expect(query).toContain("node(123,456,789)");
    });
  });

  describe("basic tag operations", () => {
    it("should check for tag existence", () => {
      const builder = new OverpassQueryBuilder().node().hasExactTag("amenity");
      expect(builder.build()).toContain('node["amenity"]');
    });

    it("should check for tag value", () => {
      const builder = new OverpassQueryBuilder().node().hasExactTag("amenity", "restaurant");
      expect(builder.build()).toContain('node["amenity"="restaurant"]');
    });

    it("should escape special characters", () => {
      const builder = new OverpassQueryBuilder().node().hasExactTag("name", 'Joe\'s "Pizza"');
      expect(builder.build()).toContain('node["name"="Joe\'s \\"Pizza\\""]');
    });
  });

  describe("advanced tag operations", () => {
    it("should handle explicit existence check", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .withTag({ key: "name", existence: "exists" });
      expect(builder.build()).toContain('node["name"]');
    });

    it("should handle non-existence check", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .withTag({ key: "name", existence: "not_exists" });
      expect(builder.build()).toContain('node[!"name"]');
    });

    it("should handle regex matching", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .withTag({ key: "name", operator: "~", value: "cafe.*" });
      expect(builder.build()).toContain('node["name"~"cafe.*"]');
    });

    it("should handle case-insensitive regex", () => {
      const builder = new OverpassQueryBuilder().node().withTag({
        key: "name",
        operator: "~",
        value: "cafe",
        regexModifier: "case_insensitive",
      });
      expect(builder.build()).toContain('node["name"~"(?i)cafe"]');
    });

    it("should handle numeric comparisons", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .withTag({ key: "lanes", operator: ">=", value: 2 });
      expect(builder.build()).toContain('node["lanes">="2"]');
    });
  });

  describe("partial key matching", () => {
    it("should match keys containing a string", () => {
      const builder = new OverpassQueryBuilder().node().withPartialKey("toilets");
      expect(builder.build()).toContain('[~".*toilets.*"~".*"]');
    });

    it("should match keys starting with a string", () => {
      const builder = new OverpassQueryBuilder().node().withPartialKey("toilets", "startsWith");
      expect(builder.build()).toContain('[~"^toilets.*"~".*"]');
    });

    it("should match keys ending with a string", () => {
      const builder = new OverpassQueryBuilder().node().withPartialKey("toilets", "endsWith");
      expect(builder.build()).toContain('[~".*toilets$"~".*"]');
    });

    it("should match partial key with specific value", () => {
      const builder = new OverpassQueryBuilder().node().withTag({
        key: "toilets",
        keyMatchStrategy: "contains",
        operator: "=",
        value: "yes",
      });
      expect(builder.build()).toContain('[~".*toilets.*"="yes"]');
    });

    it("should combine exact and partial matches with OR logic", () => {
      const builder = new OverpassQueryBuilder().node().withTags(
        [
          { key: "amenity", operator: "=", value: "toilets" },
          { key: "toilets", keyMatchStrategy: "contains" },
        ],
        false
      );

      const query = builder.build();
      expect(query).toContain('(["amenity"="toilets"]|[~".*toilets.*"~".*"])');
    });
  });

  describe("multiple tag operations", () => {
    it("should combine tags with AND logic", () => {
      const builder = new OverpassQueryBuilder().node().withTags(
        [
          { key: "amenity", operator: "=", value: "cafe" },
          { key: "cuisine", operator: "=", value: "coffee_shop" },
        ],
        true
      );
      expect(builder.build()).toContain('(["amenity"="cafe"]["cuisine"="coffee_shop"])');
    });

    it("should combine tags with OR logic", () => {
      const builder = new OverpassQueryBuilder().node().withTags(
        [
          { key: "cuisine", operator: "=", value: "italian" },
          { key: "cuisine", operator: "=", value: "pizza" },
        ],
        false
      );
      expect(builder.build()).toContain('(["cuisine"="italian"]|["cuisine"="pizza"])');
    });
  });

  describe("range operations", () => {
    it("should create numeric range query", () => {
      const builder = new OverpassQueryBuilder().node().withTagInRange("lanes", 2, 4);
      expect(builder.build()).toContain('node["lanes">="2"]["lanes"<="4"]');
    });

    it("should handle decimal values in range", () => {
      const builder = new OverpassQueryBuilder().node().withTagInRange("width", 3.5, 4.5);
      expect(builder.build()).toContain('node["width">="3.5"]["width"<="4.5"]');
    });
  });

  describe("geographic operations", () => {
    it("should create bounding box query using GeoJSON format", () => {
      const builder = new OverpassQueryBuilder().node().bbox([-0.1, 51.5, 0.0, 51.6]);
      expect(builder.build()).toContain("node(51.5,-0.1,51.6,0.0)");
    });

    it("should create bounding box query using legacy format", () => {
      const builder = new OverpassQueryBuilder().node().bbox({
        south: 51.5,
        west: -0.1,
        north: 51.6,
        east: 0.0,
      });
      expect(builder.build()).toContain("node(51.5,-0.1,51.6,0.0)");
    });

    it("should handle decimal precision in bbox", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .bbox([-0.123456, 51.123456, 0.123456, 51.987654]);
      expect(builder.build()).toContain("node(51.123456,-0.123456,51.987654,0.123456)");
    });

    it("should create around query", () => {
      const builder = new OverpassQueryBuilder().node().around(100, 51.5, -0.1);
      expect(builder.build()).toContain("(around:100,51.5,-0.1)");
    });
  });

  describe("output formats", () => {
    it("should create default output", () => {
      const builder = new OverpassQueryBuilder().node().out();
      expect(builder.build()).toContain("out;");
    });

    it("should create skeleton output", () => {
      const builder = new OverpassQueryBuilder().node().out("skel");
      expect(builder.build()).toContain("out skel;");
    });

    it("should create quick output with tags", () => {
      const builder = new OverpassQueryBuilder().node().out("qt");
      expect(builder.build()).toContain("out qt;");
    });

    it("should create output with body", () => {
      const builder = new OverpassQueryBuilder().node().out("qt", true);
      expect(builder.build()).toContain("out qt body;");
    });
  });

  describe("complex queries", () => {
    it("should build complete restaurant query", () => {
      const builder = new OverpassQueryBuilder()
        .setTimeout(30)
        .node()
        .withTags([
          { key: "amenity", operator: "=", value: "restaurant" },
          {
            key: "cuisine",
            operator: "~",
            value: "italian|french",
            regexModifier: "case_insensitive",
          },
        ])
        .bbox({
          south: 51.5,
          west: -0.1,
          north: 51.6,
          east: 0.0,
        })
        .out("qt", true);

      const query = builder.build();
      expect(query).toContain("[timeout:30]");
      expect(query).toContain("node");
      expect(query).toContain('["amenity"="restaurant"]');
      expect(query).toContain('["cuisine"~"(?i)italian|french"]');
      expect(query).toContain("(51.5,-0.1,51.6,0.0)");
      expect(query).toContain("out qt body;");
    });

    it("should build toilet query with partial matching", () => {
      const builder = new OverpassQueryBuilder()
        .node()
        .withTags(
          [
            { key: "amenity", operator: "=", value: "toilets" },
            { key: "toilets", keyMatchStrategy: "contains" },
          ],
          false
        )
        .around(100, 51.5, -0.1)
        .out("qt", true);

      const query = builder.build();
      expect(query).toContain("node");
      expect(query).toContain('(["amenity"="toilets"]|[~".*toilets.*"~".*"])');
      expect(query).toContain("(around:100,51.5,-0.1)");
      expect(query).toContain("out qt body;");
    });

    it("should build complex way query with relations", () => {
      const builder = new OverpassQueryBuilder()
        .way()
        .withTags([
          { key: "highway", operator: "=", value: "residential" },
          { key: "maxspeed", operator: "<=", value: 30 },
        ])
        .bbox({
          south: 51.5,
          west: -0.1,
          north: 51.6,
          east: 0.0,
        })
        .out("skel");

      const query = builder.build();
      expect(query).toContain("way");
      expect(query).toContain('["highway"="residential"]');
      expect(query).toContain('["maxspeed"<="30"]');
      expect(query).toContain("(51.5,-0.1,51.6,0.0)");
      expect(query).toContain("out skel;");
    });
  });
});
