import { NextResponse, type NextRequest } from "next/server";
import type { ComplianceStatus, ComplianceVendorRow } from "@/components/dashboard/types";
import { getPrimaryOrganization } from "@/lib/auth/organization";
import { loadComplianceData } from "@/lib/compliance/load";

function statusMatches(status: ComplianceStatus, filter: string) {
  if (filter === "all") return true;
  if (filter === "missing") return status === "missing" || status === "deficient";
  return status === filter;
}

function filterRows(rows: ComplianceVendorRow[], request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? "all";
  const filter = request.nextUrl.searchParams.get("filter") ?? "all";
  const query = request.nextUrl.searchParams.get("q") ?? "";

  return rows.filter((row) => {
    const matchesProperty = propertyId === "all" || row.propertyId === propertyId;
    const matchesStatus = statusMatches(row.status, filter);
    const matchesQuery = `${row.vendorName} ${row.vendorEmail ?? ""} ${row.propertyName}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesProperty && matchesStatus && matchesQuery;
  });
}

function csvEscape(value: string | number | null) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: ComplianceVendorRow[]) {
  const headers = [
    "Vendor",
    "Email",
    "Property",
    "Status",
    "Total requirements",
    "Approved",
    "Expiring",
    "Missing",
    "Under review",
    "Deficient",
    "Last upload",
  ];

  const body = rows.map((row) =>
    [
      row.vendorName,
      row.vendorEmail,
      row.propertyName,
      row.status,
      row.total,
      row.compliant,
      row.expiring,
      row.missing,
      row.underReview,
      row.deficient,
      row.lastUploadAt,
    ]
      .map(csvEscape)
      .join(","),
  );

  return [headers.map(csvEscape).join(","), ...body].join("\n");
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(rows: ComplianceVendorRow[]) {
  const lines = [
    "VendorProof Compliance Report",
    `Generated ${new Date().toLocaleString()}`,
    "",
    ...rows.slice(0, 42).map((row) =>
      `${row.vendorName} | ${row.propertyName} | ${row.status} | ${row.compliant}/${row.total} approved | ${row.expiring} expiring | ${row.missing + row.deficient} missing`,
    ),
  ];

  const content = [
    "BT",
    "/F1 16 Tf",
    "50 770 Td",
    ...lines.flatMap((line, index) => [
      index === 1 ? "/F1 9 Tf" : index === 3 ? "/F1 10 Tf" : "",
      `(${escapePdfText(line)}) Tj`,
      "0 -18 Td",
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects
    .map((object) => {
      xref.push(String(offset).padStart(10, "0") + " 00000 n ");
      offset += Buffer.byteLength(object);
      return object;
    })
    .join("");
  const xrefOffset = offset;
  const trailer = `xref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(`%PDF-1.4\n${body}${trailer}`);
}

export async function GET(request: NextRequest) {
  const organization = await getPrimaryOrganization();

  if (!organization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const { vendorRows } = await loadComplianceData(organization.id);
  const rows = filterRows(vendorRows, request);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const pdf = buildPdf(rows);
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="vendorproof-compliance-${stamp}.pdf"`,
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vendorproof-compliance-${stamp}.csv"`,
    },
  });
}
