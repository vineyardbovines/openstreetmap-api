# openstreetmap-api

Zero-dependency TypeScript package for working with [openstreetmap](https://www.openstreetmap.org) data via the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Features

- 🏗️ **Query Builder** - Build complex Overpass queries with a type-safe interface
- 🌐 **API Service** - Handle overpass API requests with automatic retries and fallbacks
- 🗺️ **GeoJSON Support** - Direct conversion to GeoJSON formats

<details>
<summary><bold>Table of Contents</bold></summary>

- [openstreetmap-api](#openstreetmap-api)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API Service](#api-service)
    - [Configuration Options](#configuration-options)
    - [Output Formats](#output-formats)
    - [Error Handling](#error-handling)
    - [Fallback Endpoints](#fallback-endpoints)
  - [Query Builder](#query-builder)
    - [Tag Matching](#tag-matching)
    - [Partial Key Matching](#partial-key-matching)
    - [Geographic Filters](#geographic-filters)
      - [Bounding Box](#bounding-box)
      - [Around](#around)
    - [Output Formats](#output-formats-1)
    - [Complex Queries](#complex-queries)
    - [Configuration](#configuration)
    - [Error Handling](#error-handling-1)
  - [Recipes](#recipes)
    - [Find Cafes Within Walking Distance](#find-cafes-within-walking-distance)
    - [Find Parks with Playgrounds and Water Features](#find-parks-with-playgrounds-and-water-features)
    - [Find Cycle-Friendly Routes](#find-cycle-friendly-routes)
    - [Find Historical Buildings by Age](#find-historical-buildings-by-age)
    - [Count Amenities by Type](#count-amenities-by-type)

</details>

## Installation

With your package manager of choice:

```bash
npm install @vineyardbovines/openstreetmap
yarn add @vineyardbovines/openstreetmap
pnpm add @vineyardbovines/openstreetmap
bun add @vineyardbovines/openstreetmap
```

## Quick Start

```typescript
import { OverpassQueryBuilder, overpass, OverpassOutput } from '@vineyardbovines/openstreetmap';

const query = new OverpassQueryBuilder()
  .setTimeout(25)
  .node()
  .withTags([
    { key: 'amenity', operator: '=', value: 'restaurant' },
    { key: 'cuisine', operator: '=', value: 'italian' }
  ])
  .bbox([-0.1, 51.5, 0.0, 51.6])
  .out('qt', true)
  .build();

const response = await overpass(query, {
  output: OverpassOutput.GeoJSON,
  verbose: true
});
```

## API Service

**Basic usage**:

```typescript
import { overpass, OverpassOutput } from '@vineyardbovines/openstreetmap-api';

// Simple query
const response = await overpass(
  '[out:json];node["amenity"="cafe"](51.5,-0.1,51.6,0.0);out;'
);

// With GeoJSON output
const geojson = await overpass(
  '[out:json];node["amenity"="cafe"](51.5,-0.1,51.6,0.0);out;',
  { output: OverpassOutput.GeoJSON }
);
```

### Configuration Options

```typescript
interface OverpassFetchOptions<T extends OverpassOutput> {
  endpoint?: string;                 // Primary endpoint to use
  fallbackEndpoints?: string[];      // Custom fallback endpoints
  verbose?: boolean;                 // Enable detailed logging
  userAgent?: string;                // Custom User-Agent header
  output?: T;                        // Output format
  retry?: {
    maxRetries: number;              // Maximum retry attempts
    initialDelay: number;            // Initial delay in ms
    maxDelay: number;                // Maximum delay in ms
    backoff: number;                 // Backoff multiplier
  };
}
```

**Default retry options:**

```typescript
{
  maxRetries: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  backoff: 2           // Exponential backoff multiplier
}
```

### Output Formats

The service supports multiple output formats through the `OverpassOutput` enum:

```typescript
enum OverpassOutput {
  Raw = 'raw',                   // Raw Overpass JSON response
  GeoJSON = 'geojson',          // Converted to GeoJSON format
  Parsed = 'parsed',            // Parsed element tags
  ParsedGeoJSON = 'parsedgeojson' // Parsed tags in GeoJSON format
}
```

'Parsed' converts string values to primitive values (string, number, boolean) when appropriate, i.e.

```typescript
{
  building: "yes",
  level: "1"
}
// becomes
{
  building: true,
  level: 1
}
```

### Error Handling

The API service uses `fetch`, so error handling is the same. There is a custom overpass error class to handle specific statuses.

```typescript
try {
    const response = await overpass(query, {
        verbose: true,
    retry: {
        maxRetries: 5,
      initialDelay: 2000
    }
  });
} catch (error) {
    if (error instanceof OverpassError) {
        // Handle Overpass-specific errors
    console.error('Overpass error:', error.message);
  } else {
      // Handle other errors
    console.error('Request failed:', error);
  }
}
```

Setting `verbose: true` enables console logging for development, and will log:

- Retry attempts
- Endpoint switches
- Error messages
- Delay durations

### Fallback Endpoints

The service automatically handles fallback endpoints based on the primary endpoint:

- Main endpoints: Falls back to MainAlt1 → MainAlt2
- Kumi endpoints: Falls back to KumiAlt1 → KumiAlt2 → KumiAlt3
- Others: Falls back to Main → Kumi → France

Custom fallback sequences can be specified:

```typescript
const response = await overpass(query, {
  endpoint: OverpassEndpoint.Main,
  fallbackEndpoints: ['CustomAlt1', 'CustomAlt2']
});
```

## Query Builder

**Basic usage**:

```typescript
import { OverpassQueryBuilder } from 'overpass-query-builder';

// Create a new builder instance
const builder = new OverpassQueryBuilder();

// Build a simple query for restaurants
const query = builder
  .node()
  .hasTag('amenity', 'restaurant')
  .out('qt')
  .build();
```

**Element types**:

- `node()`: Query nodes
- `way()`: Query ways
- `relation()`: Query relations

```typescript
// Query specific node by ID
builder.node('(123)');

// Query multiple nodes
builder.node('(123,456,789)');
```

### Tag Matching

```typescript
// Check tag existence
builder.hasTag('amenity');

// Match exact value
builder.hasTag('amenity', 'restaurant');

builder.withTag({
  key: 'name',
  operator: '~',
  value: 'cafe.*',
  regexModifier: 'case_insensitive'
});

// Numeric comparisons
builder.withTag({
  key: 'lanes',
  operator: '>=',
  value: 2
});
```

### Partial Key Matching

Useful for finding elements where the key contains, starts with, or ends with a specific string:

```typescript
// Match any key containing 'toilet'
builder.withPartialKey('toilet', 'contains');

// Combined exact and partial matching
builder.withTags([
  { key: 'amenity', operator: '=', value: 'toilets' },
  { key: 'toilets', keyMatchStrategy: 'contains' }
], false); // false for OR logic
```

### Geographic Filters

#### Bounding Box

Supports both GeoJSON format and object format:

```typescript
// GeoJSON format [west, south, east, north]
builder.bbox([-0.1, 51.5, 0.0, 51.6]);

// Object format
builder.bbox({
  south: 51.5,
  west: -0.1,
  north: 51.6,
  east: 0.0
});
```

#### Around

```typescript
// Search within radius (meters) of a point
builder.around(100, 51.5, -0.1);
```

### Output Formats

```typescript
// Default output
builder.out();

// Skeleton output (minimal data)
builder.out('skel');

// Quick output with tags
builder.out('qt');

// Include body
builder.out('qt', true);
```

### Complex Queries

```typescript
// Find Italian restaurants in London with outdoor seating
const restaurantQuery = new OverpassQueryBuilder()
  .setTimeout(30)
  .node()
  .withTags([
    { key: 'amenity', operator: '=', value: 'restaurant' },
    { key: 'cuisine', operator: '=', value: 'italian' },
    { key: 'outdoor_seating', operator: '=', value: 'yes' }
  ])
  .bbox([-0.1, 51.5, 0.0, 51.6])
  .out('qt', true)
  .build();

// Find all toilet facilities including partial matches
const toiletQuery = new OverpassQueryBuilder()
  .node()
  .withTags([
    { key: 'amenity', operator: '=', value: 'toilets' },
    { key: 'toilets', keyMatchStrategy: 'contains' }
  ], false)
  .around(100, 51.5, -0.1)
  .out('qt', true)
  .build();
```

### Configuration

You can set global options when creating the builder:

```typescript
const builder = new OverpassQueryBuilder({
  timeout: 30, // seconds
  maxsize: 536870912 // bytes (512MB)
});

// Or update them later
builder.setTimeout(25);
builder.setMaxSize(1000000);
```

### Error Handling

The builder methods use method chaining and return `this`, allowing you to catch any errors at the build stage:

```typescript
try {
  const query = builder
    .node()
    .hasTag('amenity', 'restaurant')
    .build();
} catch (error) {
  console.error('Failed to build query:', error);
}
```

## Recipes

Examples using the query builder with the API service.

### Find Cafes Within Walking Distance

```typescript
import { OverpassQueryBuilder, overpass, OverpassOutput } from '@vineyardbovines/openstreetmap-api';

async function findNearbyCafes(lat: number, lon: number, radius: number = 500) {
  const query = new OverpassQueryBuilder()
    .setTimeout(30)
    .node()
    .withTags([
      { key: 'amenity', operator: '=', value: 'cafe' },
      { key: 'opening_hours', existence: 'exists' }  // Only get cafes with opening hours
    ])
    .around(radius, lat, lon)
    .out('qt', true)
    .build();

  return await overpass(query, {
    output: OverpassOutput.ParsedGeoJSON,
    retry: {
      maxRetries: 3,
      initialDelay: 1000
    }
  });
}

// Usage
const cafes = await findNearbyCafes(51.5074, -0.1278);
```

### Find Parks with Playgrounds and Water Features

```typescript
async function findEquippedParks(bbox: [number, number, number, number]) {
  const query = new OverpassQueryBuilder()
    .way()
    .withTags([
      { key: 'leisure', operator: '=', value: 'park' },
      { key: 'playground', existence: 'exists' }
    ])
    .bbox(bbox)
    .out('qt')
    .recurse('down')  // Get all nodes making up the ways
    .out('qt')
    .build();

  return await overpass(query, {
    output: OverpassOutput.ParsedGeoJSON
  });
}
```

### Find Cycle-Friendly Routes

```typescript
async function findCycleRoutes(start: [number, number], radius: number) {
  const query = new OverpassQueryBuilder()
    .way()
    .withTags([
      { key: 'highway', existence: 'exists' },
      {
        key: 'bicycle',
        operator: '~',
        value: 'yes|designated',
        regexModifier: 'case_insensitive'
      }
    ])
    .around(radius, start[0], start[1])
    .out('body')
    .recurse('down')
    .out('skel')
    .build();

  return await overpass(query, {
    output: OverpassOutput.ParsedGeoJSON
  });
}
```

### Find Historical Buildings by Age

```typescript
async function findHistoricalBuildings(
  area: [number, number, number, number],
  minYear: number
) {
  const query = new OverpassQueryBuilder()
    .way()
    .withTags([
      { key: 'building', existence: 'exists' },
      { key: 'historic', existence: 'exists' },
      {
        key: 'start_date',
        operator: '<',
        value: minYear.toString()
      }
    ])
    .bbox(area)
    .out('body')
    .build();

  return await overpass(query, {
    output: OverpassOutput.ParsedGeoJSON
  });
}
```

### Count Amenities by Type

```typescript
async function countAmenitiesByType(bbox: [number, number, number, number]) {
  const query = new OverpassQueryBuilder()
    .node()
    .withTag({
      key: 'amenity',
      existence: 'exists'
    })
    .bbox(bbox)
    .out('qt', true)
    .build();

  const response = await overpass(query, {
    output: OverpassOutput.Parsed
  });

  // Group by amenity type
  return response.elements.reduce((acc, element) => {
    const type = element.tags?.amenity;
    if (type) {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
}
```
