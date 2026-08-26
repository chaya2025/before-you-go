/**
 * @byg/engine — the rules of "Before You Go".
 *
 * This package is the product. Everything else (the website, the server) is a
 * way to reach it. It is deliberately pure: it never touches the network, the
 * file system, or a screen. Give it a profile, get back a result.
 *
 * These exports are also the API contract. apps/api and apps/web both import
 * from here, so the two sides cannot drift apart.
 */

export * from './certainty';
export * from './profile';
export * from './condition';
export * from './domain';
export * from './data';
