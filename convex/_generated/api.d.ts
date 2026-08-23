/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attachmentActions from "../attachmentActions.js";
import type * as attachments from "../attachments.js";
import type * as crons from "../crons.js";
import type * as delivery from "../delivery.js";
import type * as health from "../health.js";
import type * as letters from "../letters.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_letters from "../lib/letters.js";
import type * as lib_photoPolicy from "../lib/photoPolicy.js";
import type * as lib_validators from "../lib/validators.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attachmentActions: typeof attachmentActions;
  attachments: typeof attachments;
  crons: typeof crons;
  delivery: typeof delivery;
  health: typeof health;
  letters: typeof letters;
  "lib/auth": typeof lib_auth;
  "lib/authorization": typeof lib_authorization;
  "lib/letters": typeof lib_letters;
  "lib/photoPolicy": typeof lib_photoPolicy;
  "lib/validators": typeof lib_validators;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
};
