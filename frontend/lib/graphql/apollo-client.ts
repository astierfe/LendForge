import { HttpLink } from '@apollo/client';
import { ApolloClient, InMemoryCache } from '@apollo/experimental-nextjs-app-support';

/**
 * Client factory for ApolloNextAppProvider
 * Creates a new Apollo Client instance for each request
 * Compatible with Next.js 15 App Router SSR
 *
 * Cache configuration:
 * - User queries are keyed by userId to prevent cross-user data contamination
 * - Each User entity is uniquely identified by their address (id field)
 */
export function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Ensure User queries are cached separately per userId
            user: {
              // Cache key includes the userId argument
              keyArgs: ['id'],
              read(existing, { args }) {
                // Return cached data only if it matches the requested userId
                return existing;
              },
            },
          },
        },
        User: {
          // Use the address (id) as the unique identifier for User entities
          keyFields: ['id'],
        },
      },
    }),
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
      fetchOptions: { cache: 'no-store' }, // Disable Next.js fetch cache for GraphQL
    }),
    // Default fetch policy: always fetch from network to ensure fresh data
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'network-only',
      },
      query: {
        fetchPolicy: 'network-only',
      },
    },
  });
}
