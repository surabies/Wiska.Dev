// apps/mobile/eslint.config.mjs — Penegakan otomatis Kontrak UI (UiContract.md bagian 8)
export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Larang Dimensions.get; pakai useBreakpoint() dari ~/lib/layout
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Dimensions'],
              message: 'Pakai useBreakpoint() dari ~/lib/layout atau @/lib/layout.',
            },
          ],
        },
      ],
    },
  },
];
