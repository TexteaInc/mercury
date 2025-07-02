import antfu from "@antfu/eslint-config"

export default antfu({
  react: true,
  stylistic: {
    quotes: "double",
  },
  ignores: ["**/*.md"],
  rules: {
    "node/prefer-global/process": "off",
    "ts/ban-ts-comment": "off",
    "style/brace-style": ["warn", "1tbs", { allowSingleLine: true }],
    "unused-imports/no-unused-vars": "warn",
  },
})
