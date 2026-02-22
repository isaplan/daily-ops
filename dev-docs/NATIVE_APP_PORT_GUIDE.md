# Porting Nuxt App to iPhone/Android (Business-Only Stores)

**Goal:** Same Nuxt app in App Store / Play Store with native capabilities: image/video/document upload and push notifications.

**Approach:** [Capacitor](https://capacitorjs.com/) — wrap your built Nuxt app in a native shell and add plugins for camera, files, and notifications. One codebase → iOS + Android.

---

## 1. Prerequisites

- **Apple:** Apple Developer account (required for App Store / TestFlight). For business-only: no extra program.
- **Android:** Google Play Developer account. For business-only: use a **private track** or **managed Google Play** (organization).
- **Local:** Xcode (Mac, for iOS), Android Studio (for Android builds/signing).

---

## 2. Make Nuxt Build Compatible with Capacitor

Capacitor loads your app as a **static site** from the build output. You have two options.

### Option A: Static export (simplest)

Your app must be buildable as a static SPA (no server-side rendering at runtime). If you use `useFetch`/`useAsyncData` with server routes, you’ll either:

- Point them to a **deployed API** (same backend your web app uses), or  
- Keep a small API and have the native app open a URL that’s your **hosted** Nuxt/API (less common for “native” UX).

**In `nuxt.config.ts`:**

```ts
export default defineNuxtConfig({
  // ... existing config
  ssr: false,  // SPA mode so Capacitor can load dist as static files
  // OR keep ssr: true and use nitro.preset: 'static' + generate at build time
})
```

For a notes/todos app that talks to your own API, **SPA mode (`ssr: false`)** is usually enough: build → `output: 'dist'` (or default) → Capacitor points to that.

### Option B: Hybrid (SSR with static generate)

If you want pre-rendered static pages:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'static',  // generate static at build
  },
})
```

Then run `nuxt generate`. Capacitor will use the generated static output.

**Recommendation:** Start with `ssr: false` and `nuxt build` so `dist/` (or `.output/public` depending on Nitro) is a single SPA. Easiest for Capacitor.

---

## 3. Add Capacitor to the Nuxt App

All commands from the **Nuxt app root** (e.g. `nuxt-app/`).

```bash
cd nuxt-app
npm install @capacitor/core @capacitor/cli
npx cap init "Daily Ops" "com.yourcompany.dailyops"
```

- **App name:** "Daily Ops" (or your product name).  
- **Bundle ID:** e.g. `com.yourcompany.dailyops` — must be unique and match your Apple/Google accounts.

Set Capacitor’s web asset directory to your Nuxt output. For Nuxt 3/4, the build often goes to `.output/public` when using `nuxt build`, or `dist` if you’ve set that. Check after first build:

```bash
npm run build
```

If the built files are in `.output/public`, set that in `capacitor.config.ts` (see below). If in `dist`, use `dist`.

Create/update `capacitor.config.ts` in the app root:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yourcompany.dailyops',
  appName: 'Daily Ops',
  webDir: '.output/public',   // or 'dist' — must match Nuxt build output
  server: {
    // Only for dev: point to your Nuxt dev server
    // url: 'http://localhost:8080',
    // cleartext: true,
  },
}
export default config
```

Add native platforms:

```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

Copy the built app into the native projects and open IDEs:

```bash
npm run build
npx cap sync
npx cap open ios
npx cap open android
```

You can now run the app in simulator/emulator. It’s your Nuxt app inside a native WebView.

---

## 4. Native Features You Need

### 4.1 Image upload (camera + gallery)

```bash
npm install @capacitor/camera
```

Use in a composable or component (e.g. when attaching an image to a note/todo):

```ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export function useNativeCamera() {
  const takePicture = async () => {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,  // or Uri for file path
      source: CameraSource.Camera,           // or CameraSource.Photos for gallery
    })
    return image
  }
  const pickFromGallery = async () => {
    const image = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    })
    return image
  }
  return { takePicture, pickFromGallery }
}
```

You can send `DataUrl` (base64) to your API or use `Filesystem` to write to a temp file and upload as multipart.

### 4.2 Video upload

Same `Camera` plugin can return video if you use `resultType: CameraResultType.Uri` and allow video in the picker. For a dedicated “pick video” flow, use the **Media** plugin or **Filesystem** + a file picker. Capacitor doesn’t ship a single “document picker” for all types; common approach:

- **Camera** for photo/video from camera or gallery.  
- **Filesystem** + **no built-in doc picker**: use a small in-app file list or a community/custom picker.  
- **Alternative:** use a web file input when running inside the WebView (works on Android; iOS has limits). For full control, consider `capawesome/capacitor-file-picker` or similar community plugin for “pick any file”.

### 4.3 Document upload

- **Android:** You can use `<input type="file" accept="...">` in the WebView and it will open the system picker.  
- **iOS:** More limited. For a robust solution, use a Capacitor file-picker plugin, e.g.  
  - [capawesome/capacitor-file-picker](https://github.com/capawesome-team/capacitor-file-picker) (supports multiple files and types).

Example (after installing a file-picker plugin):

```ts
import { FilePicker } from '@capawesome/capacitor-file-picker'

const pickDocuments = async () => {
  const { files } = await FilePicker.pickFiles({ types: ['application/pdf', 'image/*', 'video/*'] })
  return files  // array of { path, name, ... }
}
```

Then read with `@capacitor/filesystem` and upload to your API (e.g. multipart).

### 4.4 Notifications

- **Local notifications** (reminders, in-app):  
  `@capacitor/local-notifications`  
- **Push notifications** (remote):  
  `@capacitor/push-notifications`  
  - **iOS:** Configure in Apple Developer (APNs, capabilities).  
  - **Android:** Firebase Cloud Messaging (FCM).

Install:

```bash
npm install @capacitor/local-notifications @capacitor/push-notifications
npx cap sync
```

Request permission and handle tokens in a composable; send the token to your backend so you can target the device for push.  
For a todo/notes app, local notifications are enough for reminders; add push if you need server-triggered alerts.

---

## 5. Detecting Native vs Web

So that upload/notifications use native APIs only in the app:

```ts
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()
```

Use `isNative` to branch: e.g. on web use `<input type="file">` and your existing API; in the app use Camera/Filesystem/FilePicker and the same API with multipart uploads.

---

## 6. Business-Only Distribution

### Apple (App Store)

- **Custom Apps (B2B):** You can distribute only to specific organizations via [Apple Business Manager](https://business.apple.com/) and the App Store’s custom app offering. Not all developers qualify; typically for volume and business agreements.  
- **Public App Store with “business” positioning:** Publish as a normal app; you can state “for business use” and use login/organization checks so only your customers use it. No special program required.  
- **TestFlight:** Use for internal/beta testers before release.

### Google (Play Store)

- **Internal testing / Closed track:** Invite testers by email.  
- **Private track (managed Google Play):** Organization enrolls devices in managed Google Play; you publish the app to a private track and only that org can install. Good for “business only.”  
- **Public Play Store:** Same as Apple — publish normally and restrict access in-app (e.g. login, tenant ID).

So: “Business only” can mean (a) **private/organization-only** (Apple B2B / Google managed Play) or (b) **public app that only your business customers use**. (a) requires enrollment/agreements; (b) is “normal” store + your own access control.

---

## 7. Checklist (High Level)

| Step | Action |
|------|--------|
| 1 | Set `ssr: false` (or static generate), confirm build output dir |
| 2 | `npx cap init`, set `webDir` in `capacitor.config.ts` |
| 3 | `npx cap add ios` and `add android`, then `npm run build && npx cap sync` |
| 4 | Implement image (and optionally video) with `@capacitor/camera` |
| 5 | Add document picker (e.g. `capawesome/capacitor-file-picker`) and upload to your API |
| 6 | Add `@capacitor/local-notifications` (and push if needed) |
| 7 | Use `Capacitor.isNativePlatform()` so web keeps using your current upload flow |
| 8 | Configure signing (iOS: Xcode, Android: keystore) and submit to App Store / Play Store (public or business-only as above) |

---

## 8. Suggested Order in This Repo

1. **Nuxt:** Add `ssr: false` (or static preset), ensure `npm run build` produces the folder you set as `webDir`.  
2. **Capacitor:** Add `@capacitor/core`, `@capacitor/cli`, init, add `ios` and `android`, set `webDir`, then `build` → `cap sync` → `cap open ios` / `cap open android`.  
3. **Upload:** Implement one “attach image” flow with `@capacitor/camera` and your existing (or new) upload API; then extend to video and documents with a file picker.  
4. **Notifications:** Implement local notifications for todo/note reminders; add push later if required.  
5. **Distribution:** Create app records in App Store Connect and Play Console, configure signing, then upload builds (Xcode Archive → Connect; Android bundle → Play Console).

If you tell me your preferred bundle ID and whether you want to start with iOS or Android, the next step can be a minimal `capacitor.config.ts` and a single “attach image” composable wired to your notes API.
