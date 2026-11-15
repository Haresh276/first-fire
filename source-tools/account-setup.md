# Google and GitHub sign-in for FIRST FIRE

Sign-in lets visitors identify themselves on the account page. The research workspace and its public tools are available to guests. Google and GitHub identities are separate, even when they share an email address.

## Register the production callbacks

Use `https://first-fire-lunar-lab.vercel.app` as the production origin. Enter the callback URLs below exactly, including the provider name.

| Provider | Authorized callback URL |
| --- | --- |
| Google | `https://first-fire-lunar-lab.vercel.app/api/auth/callback/google` |
| GitHub | `https://first-fire-lunar-lab.vercel.app/api/auth/callback/github` |

**Google.** In the project's Google Cloud console, open **Google Auth Platform**. Set the app branding and support contact, choose **External** for public sign-in, and configure the basic `openid`, `email` and `profile` scopes. Under **Clients**, create a **Web application** OAuth client. Add the Google callback above under **Authorized redirect URIs**. Save the client ID and secret. While testing, add test accounts under **Audience**. Publish the app for the intended audience when ready. [Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent) · [Google web client setup](https://developers.google.com/identity/protocols/oauth2/web-server)

**GitHub.** In the owning account or organization's **Settings → Developer settings → OAuth apps**, create a **New OAuth App**. Enter FIRST FIRE as the application name, the production origin as **Homepage URL**, and the GitHub callback above as **Authorization callback URL**. Register the app, copy its client ID, and generate a client secret. The sign-in flow requests profile and email access only. [GitHub OAuth app setup](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

## Set the server environment

Open the Vercel project's **Settings → Environment Variables** and select **Production**. Keep credentials server-side and enter them directly in Vercel. Exclude them from chat, screenshots, logs, source control and files served from `public/`. [Vercel Config and Secret settings](https://vercel.com/docs/environment-variables/sensitive-environment-variables)

| Name | Value | Vercel type |
| --- | --- | --- |
| `AUTH_URL` | `https://first-fire-lunar-lab.vercel.app` | Config |
| `AUTH_SECRET` | A fresh session encryption secret generated privately with `openssl rand -base64 32` | Secret |
| `AUTH_GOOGLE_ID` | Google web client ID | Config |
| `AUTH_GOOGLE_SECRET` | Google web client secret | Secret |
| `AUTH_GITHUB_ID` | GitHub OAuth app client ID | Config |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app client secret | Secret |

Redeploy to apply saved variables. Keep the session secret stable across deployments. Replacing it makes existing FIRST FIRE sessions unreadable.

For staging, assign a stable HTTPS origin to the staging branch or environment. Register separate test clients with that origin and the same callback paths. Scope the staging `AUTH_URL`, provider credentials and a fresh session secret to that environment. Start sign-in on the registered origin.

## Verify both providers in a browser

1. Open `/account/` on the configured deployment in a private browser window. Check that both provider buttons are available.
2. Choose **Google**, complete sign-in on Google's site with a test account that has a verified email, and follow the redirect back to `/account/`. Check the displayed identity against the account you selected. Refresh and confirm the identity persists.
3. Choose **Sign out**. Refresh the account page and confirm the provider choices return. In the same browser, `/api/auth/session` should now return `null`. FIRST FIRE uses a stateless session cookie. Signing out clears this browser's FIRST FIRE session. Other browsers and the Google or GitHub session have their own sign-out controls.
4. Repeat steps 2 and 3 with **GitHub**, completing authorization on GitHub. As a guest, open `/research-workspace/` and confirm the public tools still load.

If a button stays unavailable, check the provider's ID and secret, the session secret and the deployed environment. For a redirect mismatch, compare the browser origin, `AUTH_URL` and the registered callback character for character. A provider's appearance in `/api/auth/providers` confirms configuration was detected. A successful sign-in, return and sign-out with each real provider verifies the full flow.
