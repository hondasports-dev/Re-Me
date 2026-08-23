/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import r2Test from '@convex-dev/r2/test'

import schema from '../../convex/schema'

export const modules = import.meta.glob('../../convex/**/*.ts')

export function testConvex() {
  const test = convexTest(schema, modules)
  r2Test.register(test)
  return test
}
