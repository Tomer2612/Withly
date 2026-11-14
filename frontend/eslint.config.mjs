import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // `next lint` skipped these by itself; plain `eslint .` needs telling.
  // public/ holds the static /info landing page export (not our code).
  globalIgnores([".next/**", "out/**", "build/**", "public/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      // Plain <img> is deliberate here. Nearly every image is user-uploaded
      // (avatars, covers, post and gallery images, lesson images) served from
      // the R2 CDN with unknown dimensions, and next/image would run each one
      // through the optimizer on the app server. Revisit per image if a
      // specific one needs optimizing.
      "@next/next/no-img-element": "off",
      // The React hook rules from eslint-config-next 16 (set-state-in-effect,
      // refs, immutability) run at their default severity, error. Where an
      // effect legitimately sets state (browser-only reads, one-time URL
      // handling, data loading), the line carries an eslint-disable comment
      // giving the reason.
    }
  }
]);
