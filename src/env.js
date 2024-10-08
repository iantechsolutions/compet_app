import { createEnv } from "@t3-oss/env-nextjs";
// import { configDotenv } from "dotenv";
import { z } from "zod";

export const stringAsBoolean = z
  .union([z.string(), z.boolean()])
  .nullable()
  .optional()
  .transform((value) => {
    if (
      (typeof value === "string" && value.toLowerCase() === "verdadero") ||
      (typeof value === "string" && value.toLowerCase() === "si")
    ) {
      return true;
    }
    if (
      (typeof value === "string" && value.toLowerCase() === "falso") ||
      (typeof value === "string" && value.toLowerCase() === "no")
    ) {
      return false;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (!value || value == "") {
      return false;
    }
  })
  .refine((value) => typeof value === "boolean", {
    message: "Caracteres incorrectos en columna:",
  });

if (!process.env.NODE_ENV) {
  // configDotenv()
}

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    POSTGRES_URL: z
      .string()
      .url()
      .refine((str) => !str.includes("YOUR_POSTGRES_URL_HERE"), "You forgot to change the default URL"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXTAUTH_SECRET: process.env.NODE_ENV === "production" ? z.string() : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      (str) => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    // Add ` on ID and SECRET if you want to make sure they're not empty
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    UPLOADTHING_SECRET: z.string(),
    UPLOADTHING_APP_ID: z.string(),
    DB_DIRECT_CONNECTION: stringAsBoolean.default(false),
    SCALEDRONE_CHANNEL_ID: z.string().optional(),
    SCALEDRONE_SECRET: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    POSTGRES_URL: process.env.POSTGRES_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
    UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID,
    SCALEDRONE_CHANNEL_ID: process.env.SCALEDRONE_CHANNEL_ID,
    SCALEDRONE_SECRET: process.env.SCALEDRONE_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    DB_DIRECT_CONNECTION: process.env.DB_DIRECT_CONNECTION
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
