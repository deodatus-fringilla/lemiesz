# Vendored inlang plugin

`plugin-message-format-4.6.0.js` is `dist/index.js` from the npm package
`@inlang/plugin-message-format@4.6.0` (MIT, see `LICENSE-plugin-message-format`).
It reads `messages/{locale}.json` for paraglide.

It is committed here so that `pnpm paraglide`, `pnpm check` and the tests work offline and in
sandboxes/CI: before, `project.inlang/settings.json` loaded it from cdn.jsdelivr.net on every compile,
and without internet the translations silently failed to build (`m.something is not a function`).

sha256: e075989468c5ce0820ac0030044a645a3c979987348b1657b8af6d716b6ad704

To upgrade: `npm pack @inlang/plugin-message-format@<version>`, copy `package/dist/index.js` here under
the new version's name, update the path in `project.inlang/settings.json` and the hash above.
