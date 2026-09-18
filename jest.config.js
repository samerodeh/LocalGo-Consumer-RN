/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  testMatch: ['<rootDir>/test/frontend/**/*.test.ts', '<rootDir>/test/frontend/**/*.test.tsx'],
  clearMocks: true,
};
