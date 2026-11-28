# Releasing Azkar

## One-time setup

1. Generate the update-signing key. Run this once and choose a password:

       npx tauri signer generate -w ~/.tauri/azkar.key

   It prints a **public key**. Paste it into `src-tauri/tauri.conf.json` as
   `plugins.updater.pubkey`, replacing `PASTE_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE`.
   The app will not start until this is done.

2. Put your GitHub username and repository name into the updater endpoint in
   `tauri.conf.json` (replace `YOUR_GITHUB_USERNAME/YOUR_REPO`). The repository must
   be public so the app can download `latest.json` and the installer.

3. In the GitHub repository settings, add two secrets under Actions:
   - `TAURI_SIGNING_PRIVATE_KEY`: the full contents of `~/.tauri/azkar.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password you chose

Keep the private key backed up somewhere safe. If it is lost, installed copies can
no longer be updated and users have to reinstall.

## Publishing a new version

1. Raise the version in all three places (it must be higher than the last release):
   `src-tauri/tauri.conf.json`, `package.json`, and `src-tauri/Cargo.toml`.
2. Commit, then tag and push:

       git tag v0.4.13
       git push origin v0.4.13

3. GitHub Actions builds the installer, signs it, and publishes the installer,
   signature, and `latest.json` to the same tagged release. The repository must be
   public so installed copies can read the updater feed. On app start (or within six
   hours while running), Azkar checks for the newer version and shows the update card.

The file to share with new users is the `Azkar_<version>_x64-setup.exe` attached to
the release. It is one installer that includes the app.

## Building locally

Local builds also need the signing key, because updater artifacts are created:

    set TAURI_SIGNING_PRIVATE_KEY=C:\Users\<you>\.tauri\azkar.key
    set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your password>
    npm run tauri build

The installer is written to `src-tauri\target\release\bundle\nsis\`.

## Note for the current 0.4.8 install

Copies installed from the zip do not have the updater. Install the first signed
release once manually. After that, updates arrive in the app.
