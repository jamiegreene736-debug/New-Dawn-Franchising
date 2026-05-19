import PDFDocument from "pdfkit";

const NAVY = "#1B2E5A";
const GOLD = "#F0A30A";
const DARK = "#1C1C1E";
const GRAY = "#555555";
const WHITE = "#FFFFFF";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  email: "dylan@newdawnfranchising.com",
  phone: "(346) 597-9994",
  website: "newdawnfranchising.com",
};

const SAFE_BOTTOM = 680;

interface BrokerInfo {
  fullName: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  signedAt: Date;
}

export function generateBrokerAgreementPDF(broker: BrokerInfo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 0, left: 50, right: 50 },
      info: {
        Title: "Referring Broker Commission Agreement — New Dawn Franchising LLC",
        Author: "New Dawn Franchising LLC",
        Subject: "Broker Commission Agreement",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = 612;
    const CW = PW - 100;
    let y = 50;
    let pageNum = 1;

    function ensure(h: number) {
      if (y + h > SAFE_BOTTOM) {
        drawFooter();
        doc.addPage();
        pageNum++;
        y = 50;
      }
    }

    function drawFooter() {
      const fy = 752;
      doc.rect(0, fy - 6, PW, 46).fill(NAVY);
      doc.font("Helvetica").fontSize(8).fillColor(WHITE)
        .text(`${COMPANY.website}  |  ${COMPANY.email}  |  ${COMPANY.phone}`, 50, fy + 5, { width: PW - 150, align: "left", lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(GOLD)
        .text(`Page ${pageNum}`, PW - 80, fy + 5, { width: 40, align: "right", lineBreak: false });
    }

    function mh(text: string, fontSize: number, font: string, width: number, lineGap: number = 0): number {
      return doc.font(font).fontSize(fontSize).heightOfString(text, { width, lineGap });
    }

    function heading(text: string) {
      const h = mh(text, 11, "Helvetica-Bold", CW);
      ensure(h + 12);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(text, 50, y, { width: CW });
      y += h + 12;
    }

    function para(text: string) {
      const h = mh(text, 10, "Helvetica", CW, 3);
      ensure(h + 8);
      doc.font("Helvetica").fontSize(10).fillColor(DARK).text(text, 50, y, { width: CW, lineGap: 3 });
      y += h + 8;
    }

    function bullet(text: string) {
      const bw = CW - 20;
      const h = mh(text, 10, "Helvetica", bw, 2);
      ensure(h + 6);
      doc.circle(60, y + 4, 2).fill(GOLD);
      doc.font("Helvetica").fontSize(10).fillColor(DARK).text(text, 70, y, { width: bw, lineGap: 2 });
      y += h + 6;
    }

    // Header
    doc.rect(0, 0, PW, 100).fill(NAVY);
    doc.rect(0, 94, PW, 4).fill(GOLD);
    doc.font("Helvetica-Bold").fontSize(22).fillColor(WHITE)
      .text("REFERRING BROKER COMMISSION AGREEMENT", 50, 30, { width: CW, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(GOLD)
      .text("New Dawn Franchising LLC", 50, 62, { width: CW, lineBreak: false });
    y = 120;

    // Preamble
    para(`This Referring Broker Commission Agreement ("Agreement") is entered into by and between New Dawn Franchising LLC, a Texas limited liability company ("Company"), and the undersigned referring broker ("Broker").`);

    heading("1. PURPOSE");
    para("This Agreement establishes the terms under which the Broker may refer prospective franchise buyers (\"Clients\") to the Company and earn a commission on completed franchise sales resulting from such referrals.");

    heading("2. COMMISSION RATE");
    para("The Company agrees to pay the Broker a commission as outlined in the separate Broker Commission Schedule provided upon agreement execution, based on the gross sales price of any franchise package sold to a Client referred by the Broker, subject to the conditions set forth herein.");

    heading("3. REFERRAL REQUIREMENTS");
    para("To qualify for a commission, the Broker must:");
    bullet("Register the Client through the Broker Portal prior to or contemporaneously with the Client's first substantive contact with the Company;");
    bullet("Provide the Client's first name, last name, email address, and telephone number;");
    bullet("The Client must not have been previously registered by another broker or already in active discussions with the Company.");

    heading("4. COMMISSION PAYMENT");
    para("Commissions shall be paid within thirty (30) days following the Company's receipt of funds from the Client's designated escrow account. The commission is only payable once New Dawn Franchising LLC has received the funds — not upon the Client's deposit into escrow. If the franchise sale is structured with installment payments, the commission shall be paid proportionally as payments are received by the Company from escrow.");

    heading("5. EXCLUSIONS");
    para("No commission shall be owed if:");
    bullet("The Client was already known to the Company prior to the Broker's referral;");
    bullet("The Client does not complete a franchise purchase;");
    bullet("The franchise sale is rescinded, refunded, or reversed for any reason.");

    heading("6. NON-EXCLUSIVE RELATIONSHIP");
    para("This Agreement does not create an exclusive relationship. The Broker is free to refer clients to other franchise systems, and the Company may engage other referring brokers.");

    heading("7. INDEPENDENT CONTRACTOR");
    para("The Broker is an independent contractor and not an employee, agent, or representative of the Company. The Broker shall not make any representations, warranties, or commitments on behalf of the Company.");

    heading("8. TERM AND TERMINATION");
    para("This Agreement shall remain in effect for a period of one (1) year from the date of execution and shall automatically renew for successive one-year terms unless terminated by either party with thirty (30) days' written notice. Commissions earned on referrals made prior to termination shall survive termination.");

    heading("9. GOVERNING LAW");
    para("This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.");

    heading("10. ELECTRONIC SIGNATURE");
    para("By electronically signing below, the Broker acknowledges that they have read, understood, and agree to be bound by the terms of this Agreement. This electronic signature shall have the same legal effect as a handwritten signature.");

    // Signature block
    ensure(180);
    y += 10;
    doc.rect(50, y, CW, 1).fill("#D0D5DD");
    y += 20;

    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY)
      .text("EXECUTED ELECTRONICALLY", 50, y, { width: CW });
    y += 24;

    const signDate = broker.signedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const rows = [
      ["Broker Name:", broker.fullName],
      ["Email:", broker.email],
      ["Company:", broker.company || "N/A"],
      ["Phone:", broker.phone || "N/A"],
      ["Date Signed:", signDate],
      ["Signature:", `Electronically signed by ${broker.fullName}`],
    ];

    rows.forEach(([label, value]) => {
      ensure(22);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY)
        .text(label, 50, y, { width: 120, lineBreak: false });
      doc.font("Helvetica").fontSize(10).fillColor(DARK)
        .text(value, 175, y, { width: CW - 125, lineBreak: false });
      y += 22;
    });

    y += 16;
    ensure(50);
    doc.roundedRect(50, y, CW, 40, 6).fill(NAVY);
    doc.font("Helvetica").fontSize(9).fillColor(WHITE)
      .text("This document was electronically signed and is a binding legal agreement.", 65, y + 13, { width: CW - 30, align: "center", lineBreak: false });

    drawFooter();
    doc.end();
  });
}
