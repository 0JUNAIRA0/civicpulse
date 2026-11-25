"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "../ui";

export type PdfIssue = {
  referenceCode: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  address: string;
  coords: string;
  area: string;
  department: string;
  reporter: string;
  submitted: string;
  due: string;
  resolved: string;
  assignee: string;
  history: { when: string; status: string; by: string; note: string }[];
  feedback?: string;
};

/** Generates a printable PDF issue report in the browser. */
export function PdfButton({ issue }: { issue: PdfIssue }) {
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(18, 59, 93);
      doc.rect(0, 0, W, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("CivicPulse · Issue Report", 40, 42);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, W - 40, 42, { align: "right" });
      doc.setFillColor(0, 166, 166);
      doc.rect(0, 70, W, 4, "F");

      doc.setTextColor(15, 31, 46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(doc.splitTextToSize(`${issue.referenceCode} — ${issue.title}`, W - 80), 40, 104);

      autoTable(doc, {
        startY: 130,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 120, fillColor: [238, 244, 249] } },
        body: [
          ["Status", issue.status],
          ["Priority", issue.priority],
          ["Category", issue.category],
          ["Department", issue.department],
          ["Assigned to", issue.assignee],
          ["Address", issue.address],
          ["Area", issue.area],
          ["GPS", issue.coords],
          ["Reported by", issue.reporter],
          ["Submitted", issue.submitted],
          ["Due", issue.due],
          ["Resolved", issue.resolved],
          ...(issue.feedback ? [["Citizen feedback", issue.feedback]] : []),
        ],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let y = (doc as any).lastAutoTable.finalY + 24;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Description", 40, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(issue.description, W - 80);
      doc.text(lines, 40, y + 16);
      y += 26 + lines.length * 12;

      autoTable(doc, {
        startY: y,
        head: [["When", "Status", "By", "Note"]],
        body: issue.history.map((h) => [h.when, h.status, h.by, h.note]),
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [18, 59, 93] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Page ${i} of ${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      }
      doc.save(`${issue.referenceCode}.pdf`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={generate} loading={busy}>
      {!busy && <FileDown className="size-4" />} PDF report
    </Button>
  );
}
