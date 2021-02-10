module.exports = {
  files: [
    '**/__tests__/**/*test*.mjs',
  ],
  failFast: true,
  verbose: true,
  failWithoutAssertions: false,
  require: [
    'ignore-styles',
    'esm',
  ],
}
