# New Dawn Franchising Website

## Overview
This project is a marketing website for New Dawn Franchising LLC, aiming to attract E-2 visa investors. It showcases franchise opportunities, E-2 visa suitability, and available territories in Texas. The platform includes a lead capture system, an AI-powered blog, and a dedicated portal for referring brokers. A comprehensive CRM manages leads, clients, and prospects, featuring an advanced prospect finder, electronic signature capabilities, and integrated communication tools. Additionally, it offers a Franchisee Training Portal with extensive modules and a Franchisee Marketing Portal providing territory-scoped homeowner lead pipelines. The overarching goal is to streamline operations, enhance lead generation, and improve client management for the franchise business.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### SEO Architecture
The website implements server-side HTML injection for core content, dynamic meta tag generation per page, canonical URLs, JSON-LD structured data for `LocalBusiness` schema, and dynamically served sitemap and `robots.txt` for optimal search engine indexing.

### Frontend
Developed with React 18 and TypeScript, utilizing Wouter for routing and Tailwind CSS v4 for styling with custom themes. It integrates shadcn/ui (new-york style) components built on Radix UI primitives. State management is handled by TanStack React Query, and animations are powered by Framer Motion. Google Fonts (DM Sans, Libre Baskerville) are used for typography. Vite is the build tool, supporting path aliases.

### Backend
The backend runs on Node.js with Express 5 and TypeScript. It provides REST API endpoints for various functionalities, including lead capture, blog management, broker authentication, CRM operations, and administrative tasks. Key features include scheduled blog post generation via OpenAI's GPT models, session-based broker authentication with bcrypt and PostgreSQL, and request validation using Zod schemas. The Vite dev server is integrated as Express middleware for development.

### Database
PostgreSQL is used as the database, managed with Drizzle ORM and `node-postgres`. The schema, defined in `shared/schema.ts`, includes tables for users, leads, blog posts, brokers, clients, prospects, and activity logs. Drizzle-kit handles schema migrations.

### Core System Features & Design Decisions
- **Shared Schema**: Ensures type safety across frontend and backend.
- **Unified Authentication**: Centralized login for admin and brokers.
- **Admin CRM**: A comprehensive dashboard for client management, including an 8-stage pipeline, FDD/receipt tracking, and prospect management.
- **Prospect Finder**: Integrates SerpAPI for prospect discovery, with an enriched version using Apollo, Hunter, Proxycurl, and ZeroBounce for detailed contact information and decision-maker identification. Phone numbers are formatted/normalized locally (no external lookup service). Apollo API updated to new endpoint `api.apollo.io/api/v1/mixed_people/api_search` (deprecated: `api.apollo.io/v1/mixed_people/search`). Discovery uses two-step flow: `mixed_people/api_search` for search then `people/match` with `reveal_personal_emails: true` to unlock email addresses (uses Apollo email credits).
- **Electronic Signature System**: Manages FDD Receipt and Franchise Agreement signing workflows with token-based email delivery and status updates.
- **Integrated Communication**: Features Quo (OpenPhone) for all SMS sending, Meta WhatsApp Cloud API for WhatsApp direct messaging, Drop Cowboy for ringless voicemails, and an email composer with templates and tracking. Twilio is NOT used — all SMS goes through Quo, all WhatsApp through Meta Cloud API.
- **Agent SMS & One-tap Approval Flow**: Allows agents to draft content (SEO, outreach) and send for approval via SMS with direct, login-free approval links. Includes morning digest SMS for pending items. Number assignments: SEO agent → 808-460-6509 (Quo: PNRyMRwwud), Outreach agent → 407-449-7941 (Quo: PNByzBL2IK), Dylan receives on 863-360-7768. Phone ID resolution handles 10-digit US numbers from Quo API. All idempotency guards in place (once per day per trigger_type).
- **CRM Client Enrichment**: Extended client fields, activity timelines, and document upload.
- **CRM Reports Tab**: Provides analytics on pipeline, lead sources, and contact activities.
- **Campaigns Tab**: Manages email drip sequences, SMS blasts, and WhatsApp blasts with list-based enrollment.
- **Smart Send Scheduler**: Optimizes delivery times for SMS, WhatsApp, and emails based on research-backed windows, including jitter for carrier compliance and daily caps.
- **SEO Command Center**: An admin portal for managing SEO activities, including keyword tracking, backlink outreach, content generation, and AI agent tasks.
- **Autonomous SEO Campaign Agent**: Utilizes Claude to run daily SEO campaigns based on keyword targets, executing actions like content generation, internal linking, and outreach, with human approval for all drafts.
- **AI Outreach Agent**: A full autonomous outreach system for lead discovery, AI scoring, email drafting (4-touch sequences), and staggered execution of communications, with a portal for manual approval/holding and a comprehensive dashboard.
- **AI Chat Scheduling**: The AI agent can schedule various tasks (SMS/WhatsApp blasts, campaign enrollments, lead finding) for future execution.
- **Broker Outreach Sequence**: An 11-touch omnichannel sequence over 21 days for broker leads, incorporating LinkedIn, email, SMS, postcards (Lob), HeyGen AI video, and WhatsApp, with timeline visibility and sequence controls.
- **Partner Outreach Sequence (v4.1)**: An 8-step sequence for professional partners (immigration attorneys, wealth managers, business advisors, E-2 consultants, immigration consultants, other). Channels: LinkedIn, Email, and Lob physical letter only — no SMS or WhatsApp. 6 audience types with distinct AI-drafted messaging, Spanish soft-touch logic, and A/B subject line testing. Partner fee (12.5%, $31,250) revealed in Step 7 only. Managed via `server/partner-sequence-service.ts`, `server/partner-routes.ts`, tables `partner_leads` + `partner_sequence_events`. UI accessible at Agent > Partner Outreach sidebar.
- **Lead Gen & Outreach Engine**: New sections within the agent interface for pipeline management, AI-powered list building, campaign dashboards with AI-generated sequences, activity feeds, and AI research tools.
- **Multilingual Outreach**: `server/language-detection.ts` detects lead country and injects language-specific instructions into all AI drafting prompts (emails, WhatsApp, LinkedIn). Supports Mexican Spanish, Castilian Spanish, Argentine/Rioplatense Spanish, Colombian Spanish, Brazilian Portuguese, French, German, Japanese, Korean, Mandarin Chinese, Arabic (Gulf/KSA), Hebrew, Italian, Turkish, and Indian English. Each language profile includes a curated list of "banned phrases" — dead-giveaway AI-translation artifacts — which the lint checker enforces across retry attempts.

## External Dependencies

### Required Services
- **PostgreSQL Database**: Primary data storage.
- **OpenAI API**: AI-powered content generation for blogs and SEO.
- **SerpAPI**: Prospect search and SEO keyword tracking.
- **Quo (OpenPhone) API**: SMS communication.
- **Twilio API**: WhatsApp messaging, phone number lookup, and AI Agent monitoring.
- **Drop Cowboy API**: Ringless voicemail services.
- **Apollo.io, Hunter.io, Proxycurl, ZeroBounce APIs**: Enhanced prospect data enrichment.
- **Whitepages Pro API**: Phone number and address enrichment for US-based contacts found in the prospect finder (Phase 4.7 in people-finder pipeline). Adds `address` field to FoundPerson and EnrichedContact. Capped at 10 lookups per search to preserve credits.
- **People Data Labs API**: General enrichment source (Phase 1 — company search + Phase 4.8 — gap enrichment). Especially strong for international contacts (EU, APAC, LATAM) where Apollo coverage drops off. Replaces ZoomInfo as the recommended international data source. Service file: `server/pdl-service.ts`. Integrated into `people-finder.ts` pipeline alongside Apollo, Hunter, Proxycurl. `PEOPLE_DATA_LABS_API_KEY` env secret required.
- **HeyGen API**: AI avatar video generation for personalized outreach.

### Key NPM Packages
- `drizzle-orm` & `drizzle-kit`: ORM and migration tools.
- `express`: Web application framework.
- `@tanstack/react-query`: Client-side server state management.
- `zod`: Schema validation.
- `framer-motion`: Animations.
- `wouter`: Client-side routing.
- `connect-pg-simple`: PostgreSQL session store.
- `bcrypt`: Password hashing.
- `node-cron`: Task scheduling.
- `openai`: OpenAI API client.