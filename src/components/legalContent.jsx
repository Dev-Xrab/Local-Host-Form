// Policy text. Every statement about data handling was checked against the app and cloud-server
// source: scopes in cloud-server/auth/google.js, stored fields in cloud-server/db.js, and the
// local server in server/. Update this file whenever either of those changes.

export function PrivacyContent({ contact }) {
  return (
    <>
      <section>
        <h2>Summary</h2>
        <ul>
          <li>Self Host Form runs on your own computer. Forms, responses and uploaded files are stored on that computer, not on our servers.</li>
          <li>Connecting a Google account is optional. If you do, the app reads your Google profile and, read-only, your Google Forms. It never writes to your Google Drive or Forms.</li>
          <li>We do not sell personal data, show ads, or use your data to train advertising or AI models.</li>
        </ul>
      </section>

      <section>
        <h2>Who we are</h2>
        <p>
          Self Host Form ("the app", "we") is an independent software project. This policy covers the app, this website,
          and the optional cloud service used for Google sign-in and sync. You can reach us at{" "}
          <a className="link" href={`mailto:${contact}`}>{contact}</a>.
        </p>
      </section>

      <section>
        <h2>This website</h2>
        <p>
          The website does not use cookies, advertising trackers or analytics, and it does not ask you for personal
          information. Like any web host, our hosting provider may keep standard server logs, such as IP address and
          requested pages, for security and operations.
        </p>
      </section>

      <section>
        <h2>Data kept on your computer (the local app)</h2>
        <p>The desktop and phone app run their own server on the device that hosts them. That device stores:</p>
        <ul>
          <li>Forms, questions, answer keys and session settings you create.</li>
          <li>Responses people submit, including the name, email or "N/A" they type to join, their answers, scores, and any files they upload.</li>
          <li>Your host password, stored as a hash rather than as readable text, and an optional recovery question and answer.</li>
          <li>A random device identifier in each respondent's browser, used so a person can resume or view their own response.</li>
        </ul>
        <p>
          This data stays on the host device unless you choose to sync it (see below) or export it. We do not receive
          it. If you host the app, you control it and are responsible for how you use it.
        </p>
      </section>

      <section>
        <h2>If you respond to a form</h2>
        <p>
          Responses go to the person or organisation running the session (the host), not to us. The host decides what
          to collect and how long to keep it. Contact the host about access, correction or deletion of your response. We
          only see responses if the host has chosen to sync them to the cloud service described below.
        </p>
      </section>

      <section id="google">
        <h2>Optional Google account connection</h2>
        <p>
          If you choose "Sign in with Google" in the app, the cloud service asks Google for the following permissions.
          Each is requested only to provide the feature described.
        </p>
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Permission</th>
              <th scope="col">What it lets us read</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Profile (openid, email, profile)</td>
              <td>Your Google account ID, email address, name and profile picture.</td>
              <td>To sign you in and show which account is connected.</td>
            </tr>
            <tr>
              <td>Drive metadata, read-only</td>
              <td>The names and IDs of the Google Forms files in your Drive. Not the contents of other files.</td>
              <td>To list your Google Forms so you can choose which to import.</td>
            </tr>
            <tr>
              <td>Forms body, read-only</td>
              <td>The questions and settings of a Google Form you choose to import.</td>
              <td>To recreate that form in the app.</td>
            </tr>
            <tr>
              <td>Forms responses, read-only</td>
              <td>The submitted responses of a Google Form you choose to import.</td>
              <td>To import or refresh responses when you ask.</td>
            </tr>
          </tbody>
        </table>
        <p>We never create, edit or delete anything in your Google Drive or Google Forms.</p>

        <h3>What the cloud service stores</h3>
        <ul>
          <li>Your Google account ID, email, name and profile picture URL.</li>
          <li>A Google refresh token, so the service can read your Google Forms on your request without asking you to sign in each time.</li>
          <li>Forms and responses that you publish or sync, in a database owned by your account and not shared with other users.</li>
          <li>The names and identifiers of the devices you sign in from, and hashed session tokens.</li>
        </ul>

        <h3>How we use it</h3>
        <p>
          Only to sign you in, import Google Forms you select, and publish or sync your own forms between your devices.
          We do not use it for advertising, we do not sell it, and no one at the project reads your forms or responses
          except where needed to keep the service secure, investigate abuse, or comply with the law.
        </p>

        <h3>Google API Services User Data Policy</h3>
        <p>
          Self Host Form's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
          <a className="link" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h3>Sharing</h3>
        <p>
          We do not share your data with third parties, other than infrastructure providers that host the cloud
          database on our behalf and process data only to run the service, or when the law requires it.
        </p>

        <h3>Retention and deletion</h3>
        <ul>
          <li><strong>Disconnect Google:</strong> remove the app's access at any time at <a className="link" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>. Signing out in the app also ends the app's cloud session.</li>
          <li><strong>Delete synced forms:</strong> deleting a published form in the app removes that form and its responses from the cloud service. This cannot be undone.</li>
          <li><strong>Delete your account:</strong> email <a className="link" href={`mailto:${contact}`}>{contact}</a> from the address on your Google account and we will delete your account record, refresh token and all data tied to it.</li>
          <li>Data on your own computer is not affected by the above. Delete it by removing the forms or the app's data folder.</li>
        </ul>
        <p>The Google sign-in and sync service is in beta and available to a limited number of users.</p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          The local app limits repeated login attempts, restricts first-time setup to the host computer, and does not
          expose the host login through the optional public link. The cloud service stores session tokens only as hashes,
          rotates refresh tokens on every use, and limits request rates. No system is completely secure, so keep your host
          password private and keep your computer up to date.
        </p>
      </section>

      <section>
        <h2>Children and minors</h2>
        <p>
          The app is not directed at children. If you host a form for minors, for example in a school, you are responsible
          for having any permissions required by law and by your institution.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You can access, export and delete your data from within the app, and ask us to delete cloud data using the
          contact above. Depending on where you live you may have additional rights; contact us and we will help where we can.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          If we change how data is handled, we will update this page and its effective date before the change takes effect.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or requests: <a className="link" href={`mailto:${contact}`}>{contact}</a>.
        </p>
      </section>
    </>
  );
}

export function TermsContent({ contact }) {
  return (
    <>
      <section>
        <h2>Agreement</h2>
        <p>
          By downloading, installing or using Self Host Form ("the app") or visiting this website, you agree to these terms
          and to our <a className="link" href="/privacy">Privacy Policy</a>. If you do not agree, do not use them.
        </p>
      </section>

      <section>
        <h2>License and permitted use</h2>
        <p>
          The app is source-available, not open source. You may, free of charge, view and study the source code, and
          download, install and run the app for personal, educational, or internal classroom and institutional use. You may
          modify it for your own use or to prepare contributions to the official repository.
        </p>
        <p>Without prior written permission you may not:</p>
        <ul>
          <li>Distribute, publish or sublicense the app or any modified version, except as GitHub's terms allow for forks made to submit contributions.</li>
          <li>Sell, rent, lease or otherwise commercialise the app or a modified version, including offering it as a paid or hosted service to others.</li>
          <li>Remove or change copyright, license or attribution notices.</li>
        </ul>
        <p>
          To ask about commercial use or redistribution, email <a className="link" href={`mailto:${contact}`}>{contact}</a>.
          Your rights end automatically if you break these terms.
        </p>
      </section>

      <section>
        <h2>Your responsibilities as a host</h2>
        <ul>
          <li>You decide what information your forms collect and you are responsible for it, including telling respondents how it will be used and keeping it secure.</li>
          <li>Follow the laws and institutional rules that apply to the data you collect, especially about minors and sensitive information.</li>
          <li>Keep your host password private. You are responsible for activity under your host account.</li>
          <li>Do not use the app to collect information unlawfully, harass people, or deceive respondents.</li>
          <li>Exam integrity features such as fullscreen, tab-switch locks and copy restrictions are deterrents only. They do not guarantee that a test cannot be cheated.</li>
        </ul>
      </section>

      <section>
        <h2>Google account features</h2>
        <p>
          Connecting a Google account is optional and uses read-only access to your Google Forms as described in the Privacy
          Policy. Your use of Google services remains subject to Google's own terms. You can disconnect at any time in your
          Google account permissions.
        </p>
      </section>

      <section>
        <h2>Experimental and beta features</h2>
        <p>
          The Android build and the cloud sign-in and sync service are experimental or in beta, and may change, have limited
          availability, or be withdrawn. Windows installers are not code-signed yet, so your system may show a warning on first launch.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          The app is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for
          a particular purpose and non-infringement. We do not promise that it will be uninterrupted, error-free or that data
          will never be lost. Back up anything important.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the extent the law allows, the authors and copyright holders are not liable for any claim, damages or other
          liability arising from the app or its use, including loss of data or of grades and results.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the effective date at the top shows the latest version, and continued use means you accept
          the update. Questions: <a className="link" href={`mailto:${contact}`}>{contact}</a>.
        </p>
      </section>
    </>
  );
}
