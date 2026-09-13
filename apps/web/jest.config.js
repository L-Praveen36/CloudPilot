module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@cloudpilot/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
};
