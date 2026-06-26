/**
 * WaterParty Theme Tokens
 *
 * Re-exports all values from the TypeScript theme source (theme.ts).
 * This file exists for modules that import .js instead of .ts
 * (e.g., server-side or bundler contexts that don't resolve TypeScript).
 *
 * All brand values — colors, fonts, font sizes, spacing, radii, shadows,
 * gradients, and Tailwind class helpers — are defined in theme.ts.
 */
export * from './theme.ts';
