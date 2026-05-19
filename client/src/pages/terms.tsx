export default function TermsPage() {
  const effectiveDate = "April 8, 2026";
  const company = "New Dawn Franchising LLC";
  const address = "2601 N Zaragoza Rd, El Paso, TX 79938";
  const email = "franchising@newdawnfranchising.com";

  return (
    <div className="nh-container py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-10">Effective date: {effectiveDate}</p>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">

        <section>
          <p>
            Please read these Terms &amp; Conditions ("Terms") carefully before using the website
            located at <strong>newdawnfranchising.com</strong> (the "Site"), operated by{" "}
            {company} ("New Dawn Franchising," "we," "us," or "our"). By accessing or using
            the Site, you agree to be bound by these Terms. If you do not agree, please do not
            use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Nature of This Website — Not an Offer</h2>
          <p>
            The information on this Site is provided for general informational purposes only and
            does not constitute an offer to sell a franchise. A franchise may be offered and sold
            only through a Franchise Disclosure Document (FDD) that complies with applicable
            federal and state franchise laws. New Dawn Franchising will only offer franchises in
            states where we are registered or exempt from registration requirements.
          </p>
          <p className="mt-2">
            Submission of a contact form or inquiry on this Site does not create any contractual
            obligation on the part of New Dawn Franchising to offer or grant a franchise.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. No Legal, Immigration, or Investment Advice</h2>
          <p>
            Nothing on this Site constitutes legal advice, immigration advice, tax advice, or
            financial investment advice. Information about the E-2 visa program is provided for
            general educational purposes only. You should consult a qualified immigration attorney,
            tax professional, and financial advisor before making any investment or visa-related
            decisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Intellectual Property</h2>
          <p>
            All content on this Site — including text, graphics, logos, images, page layouts, and
            proprietary technology descriptions — is the property of {company} or its licensors
            and is protected by applicable copyright, trademark, and other intellectual property
            laws.
          </p>
          <p className="mt-2">
            "New Dawn Franchising," "New Dawn Franchising Group of Companies™," and related marks
            are trademarks or trade names of {company}. You may not use any of our marks without
            our prior written permission.
          </p>
          <p className="mt-2">
            You may view and print materials from this Site for your personal, non-commercial use
            only. Any other reproduction, distribution, or use requires our written consent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Accuracy of Information</h2>
          <p>
            We strive to keep the information on this Site current and accurate. However, we make
            no warranties or representations — express or implied — as to the completeness,
            accuracy, or reliability of any information on this Site. Laws, regulations, and
            franchise terms may change, and information may become outdated.
          </p>
          <p className="mt-2">
            Blog posts and articles published on this Site may be generated or assisted by
            proprietary technology. They are for informational purposes only and do not
            constitute professional advice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Referral Partner Portal</h2>
          <p>
            Access to the Referral Partner Portal is granted only to authorized registered
            partners. Registered partners agree to use portal access solely for its intended
            purpose — tracking referrals and accessing materials for presenting our franchise
            opportunity to prospective investors. Unauthorized access or misuse of the portal
            is strictly prohibited and may result in immediate termination of access and legal
            action.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Disclaimer of Warranties</h2>
          <p>
            This Site and all content are provided on an "as is" and "as available" basis without
            warranty of any kind, express or implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, non-infringement, or that the Site
            will be uninterrupted, error-free, or free of viruses or other harmful components.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, {company} and its officers,
            directors, employees, agents, and affiliates shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out of or related to
            your use of this Site or the information contained herein, even if we have been
            advised of the possibility of such damages.
          </p>
          <p className="mt-2">
            Our total liability to you for any claim arising out of or relating to these Terms or
            your use of the Site shall not exceed one hundred U.S. dollars ($100).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Third-Party Links</h2>
          <p>
            This Site may contain links to third-party websites, including immigration law
            resources, government agencies, and business references. These links are provided
            for your convenience only. We do not endorse, control, or assume responsibility for
            the content or practices of any third-party site. Accessing third-party links is at
            your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to its
            conflict of law principles. Any dispute arising out of or related to these Terms or
            your use of this Site shall be brought exclusively in the state or federal courts
            located in El Paso County, Texas, and you consent to the personal jurisdiction of
            those courts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Changes to These Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be effective
            upon posting to the Site with an updated effective date. Your continued use of the
            Site after any changes constitutes your acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Contact</h2>
          <p>If you have questions about these Terms, please contact us:</p>
          <address className="not-italic mt-2 space-y-0.5">
            <p className="font-semibold">{company}</p>
            <p>{address}</p>
            <p>
              <a href={`mailto:${email}`} className="text-primary underline">{email}</a>
            </p>
          </address>
        </section>

      </div>
    </div>
  );
}
