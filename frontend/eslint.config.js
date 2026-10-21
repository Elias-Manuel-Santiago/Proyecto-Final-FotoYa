/**
 * @file
 * Configura análisis estático y exclusiones del frontend. Se ejecuta con npm run lint como
 * parte de npm run check.
 */
const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  { ignores: ['dist/**', '.expo/**', 'src101026/**'] },
  expo,
  prettier,
]);
