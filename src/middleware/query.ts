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
  | { type: "key"; key: string; value: string }
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
  private inGroup = false;
  private options = {
    timeout: 25,
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
      const [west, south, east, north] = bounds;
      this.query[this.query.length - 1] +=
        `(${this.formatCoordinate(south)},${this.formatCoordinate(west)},${this.formatCoordinate(north)},${this.formatCoordinate(east)})`;
    } else {
      this.query[this.query.length - 1] +=
        `(${this.formatCoordinate(bounds.south)},${this.formatCoordinate(bounds.west)},${this.formatCoordinate(bounds.north)},${this.formatCoordinate(bounds.east)})`;
    }
    return this;
  }

  public node(conditions?: string): this {
    this.query.push(`node${conditions ? `(${conditions})` : ""}`);
    return this;
  }

  public way(conditions?: string): this {
    this.query.push(`way${conditions ? `(${conditions})` : ""}`);
    return this;
  }

  public relation(conditions?: string): this {
    this.query.push(`relation${conditions ? `(${conditions})` : ""}`);
    return this;
  }

  public group(): this {
    this.inGroup = true;
    this.query.push("(");
    return this;
  }

  public endGroup(): this {
    if (this.inGroup) {
      this.query.push(")");
      this.inGroup = false;
    }
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

    this.query.push(`area${areaFilter}`);
    this.hasAreaSearch = true;
    return this;
  }

  public waysInArea(): this {
    this.validateAreaSearch();
    if (!this.inGroup) {
      this.group();
    }
    this.query.push(`  way(area)`);
    return this;
  }

  public nodesInArea(): this {
    this.validateAreaSearch();
    if (!this.inGroup) {
      this.group();
    }
    this.query.push(`  node(area)`);
    return this;
  }

  public relationsInArea(): this {
    this.validateAreaSearch();
    if (!this.inGroup) {
      this.group();
    }
    this.query.push(`  relation(area)`);
    return this;
  }

  public hasTag(key: string, value?: string | number): this {
    if (value !== undefined) {
      const formattedValue = this.formatTagValue(value);
      this.query[this.query.length - 1] += `["${key}"="${formattedValue}"]`;
    } else {
      this.query[this.query.length - 1] += `["${key}"]`;
    }
    return this;
  }

  public withTag(filter: AdvancedTagFilter): this {
    if (filter.keyMatchStrategy && filter.keyMatchStrategy !== "exact") {
      const keyRegex = this.buildKeyRegex(filter.key, filter.keyMatchStrategy);
      if (filter.value !== undefined) {
        let formattedValue = this.formatTagValue(filter.value);
        if (filter.operator === "~" || filter.operator === "!~") {
          formattedValue =
            filter.regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
        }
        this.query[this.query.length - 1] +=
          `[~"${keyRegex}"${filter.operator || "="}"${formattedValue}"]`;
      } else {
        this.query[this.query.length - 1] += `[~"${keyRegex}"~".*"]`;
      }
      return this;
    }

    this.query[this.query.length - 1] += this.buildTagFilter(filter);
    return this;
  }

  public withTags(filters: AdvancedTagFilter[], matchAll = true): this {
    if (filters.length === 0) return this;

    const tagFilters = filters.map((filter) => this.buildTagFilter(filter)).join("");
    if (this.query.length > 0) {
      this.query[this.query.length - 1] += tagFilters;
    }
    return this;
  }

  public withTagOneOf(key: string, values: (string | number)[]): this {
    if (values.length === 0) return this;

    const formattedValues = values.map((v) => this.formatTagValue(v)).join("|");
    this.query[this.query.length - 1] += `["${key}"~"^(${formattedValues})$"]`;
    return this;
  }

  public around(radius: number, lat: number, lon: number): this {
    if (!this.inGroup) {
      this.group();
    }
    this.query.push(`  (around:${radius},${lat},${lon})`);
    return this;
  }

  public union(): this {
    if (this.inGroup) {
      this.query.push(`  ->`);
    }
    return this;
  }

  public difference(): this {
    if (this.inGroup) {
      this.query.push(`  ->-`);
    }
    return this;
  }

  public recurse(mode: RecurseMode = "down"): this {
    switch (mode) {
      case "down":
        this.query.push(">");
        break;
      case "up":
        this.query.push("<");
        break;
      case "updown":
        this.query.push(">>");
        break;
      case "none":
        break;
    }
    return this;
  }

  public out(format: OutputFormat = "default", addBody: boolean = false): this {
    let outString = "out";
    if (format !== "default") outString += ` ${format}`;
    if (addBody) outString += " body";
    this.query.push(outString);
    return this;
  }

  public build(): string {
    const settings = "[out:json];";

    // Find the first 'out' statement index
    const firstOutIndex = this.query.findIndex((part) => part.startsWith("out"));

    // Create the formatted parts
    const queryParts = [...this.query];

    // If we're in a group and have an out statement, insert the closing parenthesis before it
    if (this.inGroup && firstOutIndex !== -1) {
      queryParts.splice(firstOutIndex, 0, ");");
      this.inGroup = false;
    } else if (this.inGroup) {
      queryParts.push(");");
    }

    // Format each part
    const formattedParts = queryParts.map((part) => {
      if (part === "(") return part;
      if (part === ");") return part;
      return part + ";";
    });

    return `${settings}\n${formattedParts.join("\n")}`;
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
    if (filter.existence === "exists") {
      return `["${filter.key}"]`;
    }

    if (filter.existence === "not_exists") {
      return `[!"${filter.key}"]`;
    }

    if (filter.operator && filter.value !== undefined) {
      let formattedValue = this.formatTagValue(filter.value);
      if (filter.operator === "~" || filter.operator === "!~") {
        formattedValue =
          filter.regexModifier === "case_insensitive" ? `(?i)${formattedValue}` : formattedValue;
      }
      return `["${filter.key}"${filter.operator}"${formattedValue}"]`;
    }

    return `["${filter.key}"]`;
  }

  private formatCoordinate(num: number): string {
    const str = num.toString();
    return str.includes(".") ? str : `${str}.0`;
  }

  private validateAreaSearch(): void {
    if (!this.hasAreaSearch) {
      throw new Error("No area has been defined. Call area() first.");
    }
  }
}
