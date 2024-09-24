import Bun, { $ } from "bun";

const define = {
  "process.env.SCALEDRONE_SECRET": JSON.stringify(Bun.env.SCALEDRONE_SECRET!),
  "process.env.SCALEDRONE_CHANNEL_ID": JSON.stringify(Bun.env.SCALEDRONE_CHANNEL_ID!),
  "process.env.CONNECTION_QUERY": Bun.env.CONNECTION_QUERY ? JSON.stringify(Bun.env.CONNECTION_QUERY) : "undefined",
  "process.env.POSTGRES_URL": JSON.stringify(Bun.env.POSTGRES_URL!),
  "process.env.UPLOADTHING_SECRET": JSON.stringify(Bun.env.UPLOADTHING_SECRET!),
  "process.env.UPLOADTHING_APP_ID": JSON.stringify(Bun.env.UPLOADTHING_APP_ID!),
  "process.env.NEXTAUTH_URL": JSON.stringify(Bun.env.NEXTAUTH_URL || "https://localhost:3000"),
  "process.env.GOOGLE_CLIENT_ID": JSON.stringify(Bun.env.GOOGLE_CLIENT_ID || "---"),
  "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(Bun.env.GOOGLE_CLIENT_SECRET || "---"),
};

const result1_node = await Bun.build({
  entrypoints: ["./src/scripts/listen-load-data.ts"],
  target: "node",
  outdir: "./dist/scripts",
  define,
});

if (!result1_node.success) {
  console.error("Error building script: ", result1_node.logs);
  process.exit(1);
}
await $`mv dist/scripts/listen-load-data.js dist/scripts/listen-load-data.mjs`;

await replaceAllInFile("./dist/scripts/listen-load-data.mjs", '"process/"', '"process"');

const result1_bun = await Bun.build({
  entrypoints: ["./src/scripts/listen-load-data.ts"],
  target: "bun",
  outdir: "./dist/scripts/bun",
  define,
});

await $`bun build ./dist/scripts/bun/listen-load-data.js --compile --target bun --outfile dist/listen-load-data.exe`;

const result2_node = await Bun.build({
  entrypoints: ["./src/scripts/load-data.ts"],
  target: "node",
  outdir: "./dist/scripts",
  define,
});

if (!result1_node.success) {
  console.error("Error building script: ", result2_node.logs);
  process.exit(1);
}
await $`mv dist/scripts/load-data.js dist/scripts/load-data.mjs`;

await replaceAllInFile("./dist/scripts/load-data.mjs", '"process/"', '"process"');

const result2_bun = await Bun.build({
  entrypoints: ["./src/scripts/load-data.ts"],
  target: "bun",
  outdir: "./dist/scripts/bun",
  define,
});

await $`bun build ./dist/scripts/bun/load-data.js --compile --target bun --outfile dist/load-data.exe`;

async function replaceAllInFile(file: string, from: string, to: string) {
  const content = await Bun.file(file).text();
  await Bun.write(file, content.replace(new RegExp(from, "g"), to));
}
