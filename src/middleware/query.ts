type OutputFormat = "default" | "skel" | "qt" | "ids";
type RecurseMode = "down" | "up" | "updown" | "none";
type TagOperator = "=" | "!=" | "~" | "!~" | ">" | "<" | ">=" | "<=";
type TagExistence = "exists" | "not_exists";
type RegexModifier = "case_sensitive" | "case_insensitive";

type KeyMatchStrategy = "exact" | "contains" | "startsWith" | "endsWith";

interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

type AreaIdentifier =
  | { type: "id"; id: number }
  | { type: "name"; name: string }
  | { type: "key"; key: string; value: string } // For IATA, ISO codes etc
  | { type: "tags"; tags: AdvancedTagFilter[] };

interface AdvancedTagFilter extends TagFilter {
  keyMatchStrategy?: KeyMatchStrategy;
}

interface QueryOptions {
  timeout?: number;
  maxsize?: number;
}

interface TagFilter {
  key: string;
  operator?: TagOperator;
  value?: string | number;
  existence?: TagExistence;
  regexModifier?: RegexModifier;
}

export class OverpassQueryBuilder {
  private query: string[] = [];
  private hasAreaSearch = false;
  private options = {
    timeout: 25,
    maxsize: 536870912,
  };

  constructor(options?: QueryOptions) {
    if (options) {
      this.options = {
        ...this.options,
        ...options,
      };
    }
  }

  public setTimeout(seconds: number): this {
    this.options.timeout = seconds;
    return this;
  }

  public setMaxSize(bytes: number): this {
    this.options.maxsize = bytes;
    return this;
  }

  public bbox(bounds: GeoJSON.BBox | BoundingBox): this {
    if (Array.isArray(bounds)) {
      // GeoJSON format [west, south, east, north]
      const [west, south, east, north] = bounds;
      this.query[this.query.length - 1] +=
        `(${this.formatCoordinate(south)},${this.formatCoordinate(west)},${this.formatCoordinate(north)},${this.formatCoordinate(east)})`;
    } else {
      // Legacy format
      this.query[this.query.length - 1] +=
        `(${this.formatCoordinate(bounds.south)},${this.formatCoordinate(bounds.west)},${this.formatCoordinate(bounds.north)},${this.formatCoordinate(bounds.east)})`;
    }
    return this;
  }

  public node(conditions?: string): this {
    this.query.push(`node${conditions ? conditions : ""}`);
    return this;
  }

  public way(conditions?: string): this {
    this.query.push(`way${conditions ? conditions : ""}`);
    return this;
  }

  public relation(conditions?: string): this {
    this.query.push(`relation${conditions ? conditions : ""}`);
    return this;
  }

  public hasExactTag(key: string, value?: string | number): this {
    if (value !== undefined) {
      const formattedValue = this.formatTagValue(value);
      this.query[this.query.length - 1] += `["${key}"="${formattedValue}"]`;
    } else {
      this.query[this.query.length - 1] += `["${key}"]`;
    }
    return this;
  }

  public withTag(filter: AdvancedTagFilter): this {
    const { key, operator, value, existence, regexModifier, keyMatchStrategy } = filter;

    // Handle key matching strategy
    if (keyMatchStrategy && keyMatchStrategy !== "exact") {
      const keyRegex = this.buildKeyRegex(key, keyMatchStrategy);

      if (value !== undefined) {
        let formattedValue = this.formatTagValue(value);
        if (operator === "~" || operator === "!~") {
          formattedValue =
            regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
        }
        this.query[this.query.length - 1] +=
          `[~"${keyRegex}"${operator || "="}"${formattedValue}"]`;
      } else {
        this.query[this.query.length - 1] += `[~"${keyRegex}"~".*"]`;
      }
      return this;
    }

    if (existence === "exists") {
      this.query[this.query.length - 1] += `["${key}"]`;
      return this;
    }

    if (existence === "not_exists") {
      this.query[this.query.length - 1] += `[!"${key}"]`;
      return this;
    }

    if (operator && value !== undefined) {
      let formattedValue = this.formatTagValue(value);
      if (operator === "~" || operator === "!~") {
        formattedValue =
          regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
      }
      this.query[this.query.length - 1] += `["${key}"${operator}"${formattedValue}"]`;
    }

    return this;
  }

  // New convenience method for partial key matching
  public withPartialKey(key: string, strategy: KeyMatchStrategy = "contains"): this {
    return this.withTag({ key, keyMatchStrategy: strategy });
  }

  public withTags(filters: AdvancedTagFilter[], matchAll = true): this {
    if (filters.length === 0) return this;

    const separator = matchAll ? "" : "|";
    const tagFilters = filters.map((filter) => this.buildTagFilter(filter));
    const tagGroup = `(${tagFilters.join(separator)})`;

    this.query[this.query.length - 1] += tagGroup;
    return this;
  }

  public withTagInRange(key: string, min: number, max: number): this {
    this.query[this.query.length - 1] += `["${key}">="${min}"]["${key}"<="${max}"]`;
    return this;
  }

  public withTagOneOf(key: string, values: (string | number)[]): this {
    if (values.length === 0) return this;

    const formattedValues = values.map((v) => this.formatTagValue(v)).join("|");
    this.query.push(`["${key}"~"^(${formattedValues})$"]`);
    return this;
  }

  public area(identifier: AreaIdentifier): this {
    let areaFilter: string;
    switch (identifier.type) {
      case "id":
        areaFilter = `${identifier.id}`;
        break;
      case "name":
        areaFilter = `["name"="${this.formatTagValue(identifier.name)}"]`;
        break;
      case "key":
        areaFilter = `["${identifier.key}"="${this.formatTagValue(identifier.value)}"]`;
        break;
      case "tags":
        areaFilter = identifier.tags.map((filter) => this.buildTagFilter(filter)).join("");
        break;
    }

    // Create area search followed by area assignment
    this.query.push(`area${areaFilter}->.searchArea`);
    this.hasAreaSearch = true;
    return this;
  }

  nodesInArea(): this {
    this.validateAreaSearch();
    this.query.push("node(area:searchArea)");
    return this;
  }

  waysInArea(): this {
    this.validateAreaSearch();
    this.query.push("way(area:searchArea)");
    return this;
  }

  relationsInArea(): this {
    this.validateAreaSearch();
    this.query.push("relation(area:searchArea)");
    return this;
  }

  public around(radius: number, lat: number, lon: number): this {
    this.query.push(`(around:${radius},${lat},${lon})`);
    return this;
  }

  public union(): this {
    this.query.push("->.");
    return this;
  }

  public difference(): this {
    this.query.push("->-");
    return this;
  }

  public recurse(mode: RecurseMode = "down"): this {
    switch (mode) {
      case "down":
        this.query.push(">;");
        break;
      case "up":
        this.query.push("<;");
        break;
      case "updown":
        this.query.push(">>;");
        break;
      case "none":
        break;
    }
    return this;
  }

  public out(format: OutputFormat = "default", addBody = false): this {
    let outString = "out";
    if (format !== "default") outString += ` ${format}`;
    if (addBody) outString += " body";
    outString += ";";
    this.query.push(outString);
    return this;
  }

  public build(): string {
    const settings = `[out:json][timeout:${this.options.timeout}][maxsize:${this.options.maxsize}];`;
    return `${settings}\n${this.query.join(" ")};\n`;
  }

  private formatTagValue(value: string | number): string {
    if (typeof value === "string") {
      return value.replace(/["\\]/g, "\\$&");
    }
    return value.toString();
  }

  private buildKeyRegex(key: string, strategy: KeyMatchStrategy = "exact"): string {
    switch (strategy) {
      case "contains":
        return `.*${key}.*`;
      case "startsWith":
        return `^${key}.*`;
      case "endsWith":
        return `.*${key}$`;
      default:
        return `^${key}$`;
    }
  }

  private buildTagFilter(filter: AdvancedTagFilter): string {
    const { key, operator, value, existence, regexModifier, keyMatchStrategy } = filter;

    if (keyMatchStrategy && keyMatchStrategy !== "exact") {
      const keyRegex = this.buildKeyRegex(key, keyMatchStrategy);
      if (value !== undefined) {
        let formattedValue = this.formatTagValue(value);
        if (operator === "~" || operator === "!~") {
          formattedValue =
            regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
        }
        return `[~"${keyRegex}"${operator || "="}"${formattedValue}"]`;
      }
      return `[~"${keyRegex}"~".*"]`;
    }

    if (existence === "exists") {
      return `["${key}"]`;
    }

    if (existence === "not_exists") {
      return `[!"${key}"]`;
    }

    if (operator && value !== undefined) {
      let formattedValue = this.formatTagValue(value);
      if (operator === "~" || operator === "!~") {
        formattedValue =
          regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
      }
      return `["${key}"${operator}"${formattedValue}"]`;
    }

    return `["${key}"]`;
  }

  private formatCoordinate(num: number): string {
    const str = num.toString();
    return str.includes(".") ? str : `${str}.0`;
  }

  private validateAreaSearch(): void {
    if (!this.hasAreaSearch) {
      throw new Error("No area has been defined. Call areaQuery() first.");
    }
  }
}
