# Safari On macOS 10.15 Compatibility Guide

## Target

- Runtime target: `Safari on Intel macOS 10.15 (system default)`
- Do not assume users manually upgraded Safari
- Compatibility priority: basic viewing, navigation, open, close, keyboard control

## Safe JS Syntax

These are generally safe to use as the default style in this project:

- `const` / `let`
- Arrow functions
- Template literals
- Default parameters
- Destructuring
- Rest parameters
- Spread syntax
- `class`
- `Map`, `Set`, `Promise`
- `async` / `await`
- `for...of`
- `Array.from`
- `Object.entries`
- `globalThis`
- `<script type="module">`

## Use With Care

These are not banned, but should be feature-detected or used only when clearly needed:

- Fullscreen API
  - Prefer checking both standard and `webkit` methods
  - Example: `document.fullscreenElement || document.webkitFullscreenElement`
- Pointer Events
  - Do not assume all interaction environments behave the same
  - Keep core click / keyboard behavior independent from advanced pointer gestures
- `fetch`
  - Usually available, but fallback strategy should be considered if Ajax content is not critical

## Avoid As Baseline

Do not use these as the project's default syntax baseline:

- Optional chaining: `obj?.prop`
- Optional call: `fn?.()`
- Nullish coalescing: `value ?? fallback`
- Logical assignment: `||=`, `&&=`, `??=`
- `String.prototype.replaceAll()`
- `Array.prototype.at()`
- Private class fields: `#value`
- Public class fields
- Top-level `await`

## Recommended Replacements

### Optional chaining

Avoid:

```js
const value = obj?.child?.name;
```

Prefer:

```js
const value = obj && obj.child ? obj.child.name : undefined;
```

### Optional method call

Avoid:

```js
handler?.(payload);
```

Prefer:

```js
if (typeof handler === "function") {
  handler(payload);
}
```

### Nullish coalescing

Avoid:

```js
const value = input ?? "default";
```

Prefer:

```js
const value = input == null ? "default" : input;
```

### Logical assignment

Avoid:

```js
config.title ||= "FantasyBox";
```

Prefer:

```js
if (!config.title) {
  config.title = "FantasyBox";
}
```

### replaceAll

Avoid:

```js
const slug = text.replaceAll(" ", "-");
```

Prefer:

```js
const slug = text.replace(/ /g, "-");
```

## Project Rules

- Keep modern syntax where it is clearly safe for the target baseline
- Prefer explicit checks over newer shorthand syntax when browser support is uncertain
- Advanced features may degrade, but basic image open / switch / close must remain stable
- When using browser APIs with version differences, add a small compatibility wrapper instead of scattering checks everywhere

## Quick Decision Rule

If you are not sure whether a syntax feature is safe:

1. If it is only shorter syntax sugar, do not use it
2. If it affects basic viewing or closing behavior, choose the conservative version
3. If it is an optional enhancement, gate it with feature detection

## Notes For `fantasybox.js`

- Keep the current conservative handling for fullscreen
- Do not reintroduce `?.`, `??`, or logical assignment operators into core runtime paths
- Core interactions should continue to work even if advanced gesture behavior is reduced
