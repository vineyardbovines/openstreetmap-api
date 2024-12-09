import type { OverpassElement } from "../types/overpass";

export type ParsedOverpassOSMElement = Omit<OverpassElement, "tags"> & {
  tags?: Record<string, string | number | boolean>;
};

/**
 * parseElementTags - parse tags of an overpass element to primitives when possible
 *
 * @param element - overpass element to parse
 */
export function parseElementTags(element: OverpassElement): ParsedOverpassOSMElement {
  if (!element?.tags) return element;

  const tags = element.tags;
  const parsedTags = {} as Record<string, string | number | boolean>;

  const isBoolean = (value: string) => {
    return value === "yes" || value === "no";
  };

  const isNumber = (value: string) => {
    return !Number.isNaN(Number.parseFloat(value));
  };

  for (const key in tags) {
    if (isBoolean(tags[key] as string)) {
      parsedTags[key] = tags[key] === "yes";
    } else if (isNumber(tags[key] as string)) {
      parsedTags[key] = Number.parseFloat(tags[key] as string);
    } else {
      parsedTags[key] = tags[key] as string;
    }
  }

  return {
    ...element,
    tags: parsedTags,
  };
}
