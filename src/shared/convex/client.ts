import { ConvexReactClient } from 'convex/react'

export function createConvexClient(url: string): ConvexReactClient {
  return new ConvexReactClient(url)
}
