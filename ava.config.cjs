module.exports = {
  files: [
    '**/__tests__/**/*test*.js',
  ],
  failFast: true,
  verbose: true,
  failWithoutAssertions: false,
  require: [
    'ignore-styles',
    'esm',
  ],
}
