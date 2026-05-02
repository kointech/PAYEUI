import { createContext } from 'react';

/**
 * Allows child components (e.g. SolanaPanel) to update the endpoint that
 * is fed into ConnectionProvider so that Phantom always sees the correct
 * network when the user switches clusters.
 */
export const SolanaEndpointContext = createContext<(url: string) => void>(() => {});
