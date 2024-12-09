export const matchAll = (regex: RegExp, string: string) => {
  const match: RegExpExecArray | null = regex.exec(string);
  const matches = [];

  while (match) matches.push(match[1]);

  return matches;
};

export class OverpassError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`Overpass Error: ${message}`, { cause });
  }
}

export class OverpassApiStatusError extends OverpassError {
  constructor(message: string, cause: number) {
    super(`Overpass API Error: ${message}`, { cause });
  }
}

/**
 * getStatusError - get an error from an overpass API status
 *
 * @param props - error properties
 * @param props.status - status code
 * @param props.query - query that caused the error
 * @param props.response - response that caused the error
 */
export async function getStatusError({
  status,
  query,
  response,
}: {
  status: number;
  query: string;
  response: Response;
}): Promise<OverpassApiStatusError> {
  const responseText = await response.text();

  const errors = responseText
    ? matchAll(/<\/strong>: ([^<]+) <\/p>/g, responseText).map((error) =>
        error?.replace(/&quot;/g, '"')
      )
    : [];
  const error = errors.length ? errors.join("\n") : "Unknown error";

  switch (status) {
    case 400:
      return new Error(
        `HTTP error: ${response.status}\nErrors:\n${error}\nQuery:\n${query.replace(/\n/g, "\n  ")}`
      );
    case 429:
      return new OverpassApiStatusError("Rate limit exceeded", 429);
    case 500:
      return new OverpassApiStatusError("Internal server error", 500);
    case 504:
      return new OverpassApiStatusError("Gateway timeout", 504);
    default:
      return new OverpassApiStatusError(
        errors.length
          ? `Errors:\n${error}\nQuery:\n${query.replace(/\n/g, "\n  ")}`
          : "Unknown error",
        status
      );
  }
}
