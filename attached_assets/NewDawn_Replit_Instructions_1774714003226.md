# Replit Instructions: Full Website Update — New Dawn Franchising
### newdawnfranchising.com

> **Do not change any design, layout, colors, fonts, or images. Only update text/copy and fix functionality as described below.**

---

## ⚠️ CRITICAL FIXES (Do These First)

---

### 1. FIX CITY NAME — Live Error on Homepage

**Find:** "Fort Worth, Texas" (appears in the homepage hero area)

**Replace with:** "El Paso, Texas"

---

### 2. REPLACE "AI Powered" — Do Not Delete, Reframe It

**Find:** "AI Powered" / "AI-powered" / "AI powered" (any variation, anywhere on the site)

**Replace with:** "Proprietary Technology. Built Exclusively for New Dawn Franchisees."

---

## HOME PAGE — Copy Updates

---

### 3. Hero Headline & Subheadline

**Find any variation of:**
- "Hands-off property management franchise"
- "You own the business, we manage the operations"
- "Hands-off"

**Replace headline with:**
> You Own It. You Direct It. We Run It.

**Replace subheadline with:**
> New Dawn Franchising is a property management franchise built specifically for E-2 visa investors. You maintain full control of your bank accounts and all business decisions — while our team handles the daily operational workload so you can focus on leading and growing your enterprise, exactly as the E-2 visa requires.

---

### 4. Remove or Rephrase Passive Language

**Find and remove any of the following wherever they appear on any page:**
- "passive income"
- "hands-free"
- "sit back"
- "fully managed"
- "we do everything"

**Replace each instance** with language that emphasizes the investor is the business director and decision-maker, with New Dawn providing operational support infrastructure.

---

### 5. Add Two Audience CTA Buttons

**Above the existing contact/inquiry button, add a small label:**
> Who are you?

**Replace the single CTA button with two side-by-side buttons:**
- Button 1: "I'm an Investor" — links to contact/inquiry form
- Button 2: "I'm an Immigration Attorney" — links to the same form, but pre-selects the "Immigration Attorney / Advisor" option in the dropdown (see Item 10)

---

### 6. Add FDD Credibility Line

**In the hero section below the CTA buttons (or in the footer), add:**
> Franchise Disclosure Document (FDD) available upon request. New Dawn Franchising is a registered franchisor.

---

### 7. Add AI Technology Section

**Add a new section approximately one-third of the way down the homepage, between the hero section and the "how it works" section. Title it:**

> Technology Built for Your Business

**Section body copy:**
> Every New Dawn franchisee benefits from proprietary AI-driven tools built exclusively for our system — from automated tenant communications and leasing workflows to marketing that works around the clock. This isn't off-the-shelf software. It's infrastructure we designed specifically for the E-2 property management model, so your business runs with the efficiency of a seasoned operation from day one.

**Below the paragraph, add three short bullet points (icons optional):**
- Automated tenant communication & follow-up
- AI-assisted leasing and property marketing
- Operational dashboards so you always know what's happening in your business

---

## SPANISH CONTENT — Rephrase to Match New Messaging

---

### 8. Update Spanish Subheadline

**Find the existing Spanish tagline** (currently something like: "Franchise de administración de propiedades para inversionistas con visa E-2" or "Usted es el dueño del negocio, nosotros manejamos las operaciones")

**Replace with:**
> Usted es el dueño y director del negocio. Usted controla su cuenta bancaria y todas las decisiones clave. Nosotros nos encargamos de las operaciones del día a día para que usted pueda enfocarse en liderar y hacer crecer su empresa — tal como lo exige la visa E-2.

**Also translate and add the AI technology section (Item 7) in Spanish wherever Spanish content appears:**
> Cada franquiciado de New Dawn tiene acceso a herramientas de inteligencia artificial desarrolladas exclusivamente para nuestro sistema — desde comunicaciones automatizadas con inquilinos hasta marketing que trabaja por usted las 24 horas. No es software genérico. Es infraestructura diseñada específicamente para el modelo de administración de propiedades con visa E-2.

---

## TEAM PAGE — Updates

---

### 9. Add Leadership Description

**If the team page has placeholder bios or is sparse, add the following block above the team member listings:**
> Our leadership team brings deep expertise in property management operations, U.S. franchise law, and E-2 visa business compliance. New Dawn was built by founders who have lived this model firsthand — and who understand what it takes to build a business that satisfies both visa requirements and long-term financial goals.

---

## CONTACT FORM — New Fields

---

### 10. Add Two Fields to the Contact/Inquiry Form

**Field 1 — Add a dropdown labeled:** "I am a..."

Options:
- Prospective Investor
- Immigration Attorney / Advisor
- Franchise Broker
- Other

**Field 2 — Add a dropdown labeled:** "Country of Residence"

Include a full country list. This is important for E-2 eligibility screening, as investors must be nationals of a U.S. treaty country. Place this field directly below the "I am a..." dropdown.

---

## NAVIGATION & FUNCTIONALITY — QA Checklist

---

### 11. Check All Navigation Links

**Check every link in the top navigation menu and footer:**
- If any link points to # (a placeholder anchor) or leads to a 404 error page, either fix the link or remove it
- Specifically verify these pages load correctly:
  - Home (/)
  - Team (/team)
  - Contact or inquiry page
  - Any Spanish-language version of any page

---

### 12. Verify Language Toggle Button

**If a language toggle exists (EN / ES):**
- Confirm it switches the page language correctly and does not error out or reload to a 404
- Confirm the Spanish version of the page reflects the updated copy from Item 8 above

---

### 13. Verify All CTA Buttons

**Check every button on every page:**
- Confirm each button navigates to the correct destination (no buttons should do nothing when clicked)
- Confirm the contact/inquiry form actually submits and shows a confirmation message
- Confirm no buttons scroll to the wrong section of the page or to a blank anchor

---

### 14. Fix All Contact & Email Buttons — Link Directly to Contact Form

**Find every button, link, or clickable element on the site that uses any of the following labels:**
- "Contact Us"
- "Email Us"
- "Get in Touch"
- "Reach Out"
- "Send Us a Message"
- "Request Information"
- "Learn More" (if it currently opens an email client)
- Any button whose link begins with "mailto:"

**For every instance found, do the following:**
- Remove the "mailto:" link entirely
- Replace it with a direct link to the contact/inquiry form page (e.g. /contact or the relevant page anchor such as #contact-form)
- The user should never be taken to their email application — they should always land on the website's own contact form

**If no dedicated contact page exists yet, create a simple /contact page that contains the inquiry form described in Item 10, and point all of the above buttons to it.**

---

## SEO — Meta Tags

---

### 15. Update Meta Description Tag

**In the HTML head, find the meta name="description" tag.**

**Replace its content value with:**
New Dawn Franchising is a property management franchise built for E-2 visa investors. You direct the business and control your finances — we handle daily operations. Proprietary technology built exclusively for our franchisees. FDD available upon request.

---

### 16. Update Page Title Tag

**In the HTML head, find the title tag.**

**Replace with:**
New Dawn Franchising | E-2 Visa Property Management Franchise | El Paso, TX

---

## SUMMARY — Pages to Apply All Changes

| Page                     | Items That Apply                          |
|--------------------------|-------------------------------------------|
| Homepage (/)             | 1, 2, 3, 4, 5, 6, 7, 11, 13, 14, 15, 16  |
| Homepage Spanish version | 8 (Spanish copy updates)                  |
| Team page (/team)        | 9, 11, 13, 14                             |
| Contact / Inquiry page   | 10, 11, 13, 14                            |
| Footer (all pages)       | 6, 11, 14                                 |
| All pages                | 2 (AI language), 4 (passive language), 14 (contact buttons) |
