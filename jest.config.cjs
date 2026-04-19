/** @type {import('jest').Config} */
module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.spec.json',
            },
        ],
    },
};
