import PDFDocument from "pdfkit";
import type { Response } from "express";

const NAVY = "#1B2E5A";
const GOLD = "#F0A30A";
const DARK = "#1C1C1E";
const GRAY = "#555555";
const LIGHT_BG = "#F5F7FA";
const WHITE = "#FFFFFF";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  email: "dylan@newdawnfranchising.com",
  phone: "(346) 597-9994",
  website: "newdawnfranchising.com",
  focus: "Fort Worth, Texas",
};

const PW = 612;
const CW = PW - 100;
const SAFE_BOTTOM = 680;

export function generateBrochurePDF(res: Response) {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 50, bottom: 0, left: 50, right: 50 },
    info: {
      Title: "New Dawn Franchising — Investor Brochure",
      Author: "New Dawn Franchising LLC",
      Subject: "E-2 Visa Franchise Investment Opportunity",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="New-Dawn-Investor-Brochure.pdf"');
  doc.pipe(res);

  let y = 50;
  let pageNum = 0;

  function newPage() {
    if (pageNum > 0) {
      drawFooter();
      doc.addPage();
    }
    pageNum++;
    y = 50;
  }

  function ensure(h: number) {
    if (y + h > SAFE_BOTTOM) {
      newPage();
    }
  }

  function drawFooter() {
    const fy = 752;
    doc.save();
    doc.rect(0, fy - 6, PW, 46).fill(NAVY);
    doc.font("Helvetica").fontSize(8).fillColor(WHITE)
      .text(`${COMPANY.website}  |  ${COMPANY.email}  |  ${COMPANY.phone}`, 50, fy + 5, { width: PW - 150, align: "left", lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(GOLD)
      .text(`Page ${pageNum}`, PW - 80, fy + 5, { width: 40, align: "right", lineBreak: false });
    doc.restore();
  }

  function drawHeader() {
    doc.rect(0, 0, PW, 140).fill(NAVY);
    doc.rect(0, 130, PW, 6).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(28).fillColor(WHITE)
      .text("NEW DAWN", 50, 35, { width: CW, lineBreak: false });
    doc.font("Helvetica").fontSize(14).fillColor(GOLD)
      .text("FRANCHISING LLC", 50, 68, { width: CW, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(WHITE)
      .text("Your Path to an E-2 Visa Through Hands-Off Franchise Ownership", 50, 100, { width: CW, lineBreak: false });
    y = 160;
  }

  function mh(text: string, fontSize: number, font: string, width: number, lineGap: number = 0): number {
    return doc.font(font).fontSize(fontSize).heightOfString(text, { width, lineGap });
  }

  function title(text: string) {
    ensure(34);
    doc.rect(50, y, 4, 22).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(16).fillColor(NAVY)
      .text(text, 62, y + 2, { width: CW - 12, lineBreak: false });
    y += 34;
  }

  function body(text: string) {
    const h = mh(text, 10.5, "Helvetica", CW, 3);
    ensure(h + 8);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
      .text(text, 50, y, { width: CW, lineGap: 3 });
    y += h + 8;
  }

  function bullet(text: string) {
    const bw = CW - 22;
    const h = mh(text, 10.5, "Helvetica", bw, 2);
    ensure(h + 6);
    doc.circle(62, y + 5, 2.5).fill(GOLD);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
      .text(text, 72, y, { width: bw, lineGap: 2 });
    y += h + 6;
  }

  function highlight(htitle: string, htext: string) {
    const tw = CW - 30;
    const th = mh(htitle, 11, "Helvetica-Bold", tw);
    const bh = mh(htext, 10, "Helvetica", tw, 2);
    const total = th + bh + 28;
    ensure(total + 8);
    doc.roundedRect(50, y, CW, total, 6).fill(LIGHT_BG);
    doc.roundedRect(50, y, CW, total, 6).lineWidth(0.5).strokeColor("#D0D5DD").stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
      .text(htitle, 65, y + 12, { width: tw });
    doc.font("Helvetica").fontSize(10).fillColor(GRAY)
      .text(htext, 65, y + 12 + th + 6, { width: tw, lineGap: 2 });
    y += total + 8;
  }

  function statBoxes(stats: Array<{ stat: string; label: string }>) {
    ensure(76);
    stats.forEach((s, i) => {
      const x = 50 + i * 130;
      const w = 118;
      doc.roundedRect(x, y, w, 60, 6).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(20).fillColor(GOLD)
        .text(s.stat, x, y + 12, { width: w, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(WHITE)
        .text(s.label, x, y + 38, { width: w, align: "center", lineBreak: false });
    });
    y += 76;
  }

  function table(rows: string[][]) {
    const totalH = rows.length * 24;
    ensure(totalH + 10);
    const c1 = 160;
    const c2 = CW - c1;
    rows.forEach((row, i) => {
      const isH = i === 0;
      doc.rect(50, y, CW, 24).fill(isH ? NAVY : i % 2 === 0 ? LIGHT_BG : WHITE);
      doc.font(isH ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(isH ? WHITE : DARK);
      doc.text(row[0], 58, y + 7, { width: c1 - 16, lineBreak: false });
      doc.text(row[1], 50 + c1 + 8, y + 7, { width: c2 - 16, lineBreak: false });
      y += 24;
    });
  }

  function timeline(phase: string, ttl: string, time: string, desc: string) {
    const boxH = 62;
    ensure(boxH + 8);
    doc.roundedRect(50, y, CW, boxH, 6).fill(LIGHT_BG);
    doc.roundedRect(50, y, CW, boxH, 6).lineWidth(0.5).strokeColor("#D0D5DD").stroke();
    doc.roundedRect(55, y + 5, 70, 20, 4).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
      .text(phase, 55, y + 11, { width: 70, align: "center", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
      .text(ttl, 135, y + 8, { width: 280, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD)
      .text(time, PW - 180, y + 9, { width: 130, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(9.5).fillColor(GRAY)
      .text(desc, 135, y + 28, { width: CW - 140, lineGap: 2 });
    y += boxH + 8;
  }

  function cta() {
    ensure(100);
    doc.roundedRect(50, y, CW, 90, 8).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(GOLD)
      .text("Get Started Today", 70, y + 14, { width: CW - 40, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(WHITE)
      .text(`Email: ${COMPANY.email}`, 70, y + 38, { width: CW - 40, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(WHITE)
      .text(`Phone: ${COMPANY.phone}`, 70, y + 54, { width: CW - 40, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(WHITE)
      .text(`Website: ${COMPANY.website}`, 70, y + 70, { width: CW - 40, lineBreak: false });
    y += 100;
  }

  function gap(n: number = 6) { y += n; }

  // ── Build the brochure ──
  newPage();
  drawHeader();

  title("Why New Dawn?");
  body("New Dawn Franchising offers a turnkey property management franchise in Fort Worth, Texas — specifically designed for international investors who want a hands-off business that qualifies for the U.S. E-2 Treaty Investor Visa.");
  body("With 300+ active management contracts already in operation, our proven model gives you a real, revenue-generating business from day one — without requiring you to do any property management work yourself.");

  gap(4);
  statBoxes([
    { stat: "300+", label: "Active Contracts" },
    { stat: "$250K", label: "Starting Investment" },
    { stat: "4–7 mo", label: "Visa Timeline" },
    { stat: "100%", label: "Hands-Off Model" },
  ]);

  title("The Hands-Off Model");
  body("Our franchise is built so you maintain full ownership and financial oversight while a territory-approved manager handles every aspect of day-to-day operations:");
  bullet("You own the franchise and maintain financial control over all accounts and decisions");
  bullet("An approved territory representative manages tenant relations, maintenance coordination, and lease execution");
  bullet("You receive regular reporting and have full transparency into operations — without doing the work");
  bullet("You can live anywhere in the United States — no requirement to relocate to Texas");

  gap(4);
  highlight(
    "You Don't Need Property Management Experience",
    "Our systems, training, and operational support are designed so that you can succeed as a franchise owner regardless of your professional background."
  );

  title("Perfect for E-2 Visa Investors");
  body("The E-2 Treaty Investor Visa requires a substantial, active investment in a real U.S. business. Our franchise checks every box:");
  bullet("Substantial investment: Packages start at $250,000, meeting the E-2 threshold");
  bullet("Real and operating: 300+ active contracts generating revenue immediately");
  bullet("Not marginal: The business has capacity to generate significant returns beyond personal living expenses");
  bullet("Active direction: You direct and develop the business — even in a hands-off capacity");
  bullet("Job creation: Your franchise employs U.S. workers in the territory");

  title("Investment Overview");
  body("Our franchise packages are structured to meet E-2 visa requirements while giving you a real, profitable business:");
  gap(2);
  table([
    ["Feature", "Details"],
    ["Starting Investment", "$250,000 (franchise packages available)"],
    ["Financing", "Available — speak with our team about options"],
    ["Location", "Fort Worth, Texas (you don't need to live there)"],
    ["Business Type", "Long-term single-family rental management"],
    ["Contracts Included", "Active management contracts from day one"],
    ["Training & Support", "Comprehensive onboarding and ongoing support"],
    ["Territory Exclusivity", "Protected territory with defined boundaries"],
  ]);

  gap(16);
  title("Financial Projections & P&L");
  body("We believe in full transparency. When you request our Franchise Disclosure Document (FDD), you'll receive access to Item 19 — a complete financial projections section that includes:");
  bullet("A full mock Profit & Loss statement for the first years of operation");
  bullet("Line-by-line detail of every revenue stream and expense category");
  bullet("Realistic projections based on our existing franchise operations");
  bullet("Clear breakdown of ongoing fees, royalties, and operating costs");
  bullet("Expected return timeline and cash flow analysis");

  gap(2);
  highlight(
    "Request the FDD Today",
    "Contact us to receive the full Franchise Disclosure Document with detailed financial projections. No obligation — just the information you need to make an informed decision."
  );

  title("Spouse Visa Strategy");
  body("Our franchise can be structured so that your spouse holds the E-2 visa as the primary investor, while you continue your current employment or professional career in the United States. This gives your family the visa benefits while you maintain your income — the best of both worlds.");

  gap(6);
  title("In-House Buy-Back Program");
  body("Planning your exit? Our in-house buy-back program provides a clear pathway to recover your investment. Invest $250K, get your hands-off visa, live in the USA, build your business — and when you're ready (typically around 4 years), we have a program designed to help you transition out smoothly.");

  gap(6);
  title("Our Protections");
  body("While E-2 visa regulations require that your investment be genuinely \"at risk\" (which means no franchise can offer a traditional investment guarantee), we do provide two important protections:");
  bullet("90-Day Contract Replacement Guarantee — If you lose any management contracts in the first 90 days for any reason, we replace them with new ones at no cost to you");
  bullet("Visa Denial Protection — If your E-2 visa application is ultimately declined, we provide money replacement so you're not left at a loss");

  title("E-2 Visa Timeline");
  body("Our streamlined process gets you from initial inquiry to E-2 visa approval in as little as 4–7 months:");
  timeline("Phase 1", "Discovery & Due Diligence", "2–4 Weeks", "Review FDD, financial projections, and franchise model. Schedule meetings with our team.");
  timeline("Phase 2", "Franchise Agreement", "1–2 Weeks", "Sign the franchise agreement, complete investment, and begin entity formation.");
  timeline("Phase 3", "Business Setup", "4–6 Weeks", "Company formation, EIN, bank accounts, insurance, and operational onboarding.");
  timeline("Phase 4", "Visa Application", "6–10 Weeks", "Work with your immigration attorney to prepare and file the E-2 visa application.");
  timeline("Phase 5", "Visa Interview & Approval", "2–4 Weeks", "Consular interview. Upon approval, you and your family can live and work in the USA.");

  gap(8);
  title("Why Fort Worth, Texas?");
  bullet("One of the fastest-growing cities in America — population up 25% in the last decade");
  bullet("Strong rental demand driven by corporate relocations and population growth");
  bullet("No state income tax — maximizing your take-home returns");
  bullet("Business-friendly regulations and a low cost of living compared to coastal cities");
  bullet("Central U.S. location with two major international airports");

  gap(10);
  title("Ready to Learn More?");
  body("Take the next step toward your E-2 visa and hands-off franchise ownership. Request our Franchise Disclosure Document today — it includes a full mock P&L for the first years of operation that goes over everything in line-by-line detail.");

  gap(4);
  cta();

  drawFooter();
  doc.end();
}
