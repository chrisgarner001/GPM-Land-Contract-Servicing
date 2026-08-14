import { NextRequest, NextResponse } from "next/server";
import { generateDeedDocx, buildDeedFilename, type DeedType } from "@/domain/documents/generateDeedDocx";
import { logGeneratedDocument } from "@/server/documents";
import { createClient } from "@/lib/supabase/server";

const VALID_DEED_TYPES: DeedType[] = ["QCD", "WD", "WDS", "LC", "QCDLC", "LCA"];

// POST rather than a server action (the response is a binary file) and
// rather than GET (the legal description field can be long). The client
// fetch()es this, then blob-downloads the response — same end-user
// experience as the standalone dashboard this replaces.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deedType, contractId, fields, grantorName, granteeName, propertyAddress } = body as {
    deedType: string;
    contractId: string | null;
    fields: Record<string, string>;
    grantorName: string | null;
    granteeName: string | null;
    propertyAddress: string | null;
  };

  if (!VALID_DEED_TYPES.includes(deedType as DeedType)) {
    return NextResponse.json({ error: "Invalid deed type." }, { status: 400 });
  }
  if (!fields || typeof fields !== "object") {
    return NextResponse.json({ error: "Missing field data." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = generateDeedDocx(deedType as DeedType, fields);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to generate document." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await logGeneratedDocument({
    contractId: contractId || null,
    docType: deedType as DeedType,
    grantorName: grantorName || null,
    granteeName: granteeName || null,
    propertyAddress: propertyAddress || null,
    dataSnapshot: JSON.stringify(fields),
    generatedBy: user?.email ?? null,
  });

  const filename = buildDeedFilename(deedType as DeedType, grantorName, granteeName);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
