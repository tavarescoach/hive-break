import next from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "node_modules/**", "public/mediapipe/**", "next-env.d.ts"] },
  ...next,
];

export default config;
