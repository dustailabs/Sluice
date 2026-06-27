module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: { sourceType: 'module', ecmaVersion: 2019 },
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	env: { node: true, es2019: true },
	rules: {
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
	},
	ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
