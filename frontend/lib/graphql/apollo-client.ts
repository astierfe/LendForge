import { HttpLink } from '@apollo/client';
import { ApolloClient, InMemoryCache } from '@apollo/experimental-nextjs-app-support';

/**
 * Client factory for ApolloNextAppProvider
 * Creates a new Apollo Client instance for each request
 * Compatible with Next.js 15 App Router SSR
 *
 * Cache configuration (ANO_009 fix):
 * - Cache completely disabled for simplicity (small project, 2-3 users)
 * - fetchPolicy: 'network-only' ensures always fresh data from subgraph
 * - No risk of data mixing between users
 */
export function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),  // Simple cache without typePolicies - disabled via network-only
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
