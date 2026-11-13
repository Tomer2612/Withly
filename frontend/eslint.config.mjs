import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
    }
  }
];

export default eslintConfig;
