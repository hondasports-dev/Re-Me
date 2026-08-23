/// <reference types="vite/client" />
import { convexTest } from 'convex-test'

import schema from '../../convex/schema'

export const modules = import.meta.glob('../../convex/**/*.ts')

export function testConvex() {
  return convexTest(schema, modules)
}
