export function writeGuard(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") ?? new URL(request.url).host;
      if (
        source.host !== host ||
        !["http:", "https:"].includes(source.protocol)
      )
        return Response.json(
          { error: "Cross-origin writes are not supported." },
          { status: 403 },
        );
    } catch {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  }
  if (
    request.method !== "DELETE" &&
    !request.headers.get("content-type")?.includes("application/json")
  )
    return Response.json(
      { error: "Expected a JSON request." },
      { status: 415 },
    );
  return null;
}
export function storageError(error: unknown) {
  console.error(
    "Mindcheck database request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "The database is unavailable. Start PostgreSQL and try again." },
    { status: 503 },
  );
}
export const invalid = () =>
  Response.json(
    {
      error:
        "Some fields could not be read. Check the date and numeric values.",
    },
    { status: 400 },
  );
