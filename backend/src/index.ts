// createSchema combines our typeDefs (the API's shape) and resolvers (the
// actual behavior) into one executable thing GraphQL can run queries against.
// createYoga builds the actual HTTP server around that schema.

import { createYoga, createSchema } from "graphql-yoga";

import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { createContext } from "./context";

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  context: ({ request }) => createContext(request),
});

const port = Number(process.env.PORT ?? 4000);

// Bun's own built-in web server. We just need to tell it which port to use
// and what function should handle incoming requests — "yoga.fetch" is
// already built in exactly the shape Bun.serve expects (this works because
// both Bun and Yoga follow the same standard web "Fetch API" convention),
// so no extra adapter code is needed to connect them.
Bun.serve({
  port,
  fetch: yoga.fetch,
});

console.log(`GraphQL Yoga ready at http://localhost:${port}/graphql`);
