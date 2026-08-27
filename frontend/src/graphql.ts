// Vite exposes any env var prefixed VITE_ on import.meta.env, replacing it
// with a literal string at build time — so this is baked into the build,
// not read at runtime. Locally, no .env file means it's undefined and we
// fall back to the local backend; in production (Vercel), VITE_GRAPHQL_ENDPOINT
// is set to the deployed Render backend's URL instead.
const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "http://localhost:4000/graphql";

// A generic helper: T is a placeholder for "whatever shape of data this
// particular call expects back" — TypeScript fills that in differently
// each time this function gets called, based on what we ask for.
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  // If we have a saved login token, attach it. If there's no token, this
  // stays undefined and we simply don't send an Authorization header,
  // which is fine for public queries like the leaderboard.
  const token = localStorage.getItem("token");

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Only include the Authorization header at all if we actually have
      // a token — spreading an empty object adds nothing.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Every GraphQL request, whether a query or mutation, is just a POST
    // with a JSON body containing the query text and any variables it needs.
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  // GraphQL has an unusual quirk: even a "failed" request usually still
  // returns HTTP 200, with the actual error information inside the JSON
  // body's "errors" field instead of using HTTP status codes. So we check
  // for that explicitly rather than relying on response.ok.
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  return result.data as T;
}
