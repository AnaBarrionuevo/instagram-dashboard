export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

        <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              1. Information We Collect
            </h2>
            <p>
              This application collects Instagram Direct Messages that you send to our bot account.
              We collect:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Message content and metadata</li>
              <li>Sender information (Instagram user ID)</li>
              <li>Timestamp of messages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              2. How We Use Your Information
            </h2>
            <p>
              We use the collected information solely to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Respond to your messages</li>
              <li>Improve our bot's functionality</li>
              <li>Debug and maintain the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              3. Data Storage
            </h2>
            <p>
              Messages are logged for debugging purposes. We do not permanently store message data
              in a database beyond what is necessary for operational purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              4. Third-Party Sharing
            </h2>
            <p>
              We do not share your data with third parties. Messages are only processed by this
              application to generate automated responses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              5. Data Security
            </h2>
            <p>
              We take reasonable measures to protect your data. However, no method of transmission
              over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              6. Your Rights
            </h2>
            <p>
              You can stop using this service at any time. To request deletion of your data,
              please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy at any time. Continued use of this service
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              8. Contact
            </h2>
            <p>
              For questions about this privacy policy, please contact us through Instagram DM.
            </p>
          </section>

          <p className="text-gray-500 text-sm mt-12">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
