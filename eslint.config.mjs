import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
                $: 'readonly',
                jQuery: 'readonly',
            },
        },
        rules: {
            'no-eval': 'error',
            'no-implicit-globals': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: 'error',
            'no-unused-vars': 'error',
            'no-undef': 'error',
            semi: ['error', 'always'],
        },
    },
    {
        ignores: ['jquery/'],
    },
];
