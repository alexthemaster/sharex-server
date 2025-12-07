// @ts-check

import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    { ignores: ["docker/**", "dist/**"] }
);
