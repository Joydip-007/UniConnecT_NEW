/**
 * Design-system preview support — not part of the app, and not dead code.
 *
 * `/design-sync` builds its bundle from a synthesized entry that `export *`s
 * every `.tsx` under the configured source roots, reaching them through the
 * `apps/web/node_modules/web` symlink. `@/`-alias imports inside those files
 * resolve against the same prefix, so everything shares one module record.
 *
 * `extraEntries` does NOT: esbuild realpaths those to `apps/web/src/...`, which
 * is a textually different path for the same file, so the store gets
 * instantiated a second time and seeding the exported copy has no effect on the
 * one components actually read. Re-exporting from here — inside the synth
 * entry's own file set — is what makes `window.UniConnecT.useAuthStore` the
 * same store `CreatePost`, `CreateEventForm` and `EditProfileModal` subscribe to.
 *
 * Preview files seed it with `useAuthStore.setState({ user, isLoading: false })`
 * rather than `setAuth()`, which writes localStorage and opens a socket.
 *
 * The file is `.tsx` on purpose: the synth entry only picks up `.tsx`/`.jsx`.
 */
export { useAuthStore } from '@/stores/authStore'
