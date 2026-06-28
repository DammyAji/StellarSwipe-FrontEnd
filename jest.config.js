/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  // Accessibility tests that render components need jsdom — use
  // @jest-environment jsdom at the top of those files to opt in per-file.
  // MSW lifecycle (listen/reset/close) is wired up for all tests below.
  setupFilesAfterEnv: ["<rootDir>/src/mocks/jest.setup.ts"],
  // Allow Jest to transform MSW and @mswjs ESM packages
  transformIgnorePatterns: ["node_modules/(?!(msw|@mswjs)/)"],
};

module.exports = config;
