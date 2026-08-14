import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Document Dashboard's deed .docx templates are read from disk at
  // request time (src/domain/documents/generateDeedDocx.ts) rather than
  // bundled as code — without this, Vercel's file tracing can drop them
  // from the deployed function.
  outputFileTracingIncludes: {
    "/documents/generate": ["./src/document-templates/*.docx"],
    "/documents/generate-batch": ["./src/document-templates/*.docx"],
    // Create Land Contract Package's 14 templates (.docx/.xlsx/.pdf), read
    // from disk at publish time in generatePackage.ts.
    "/onboarding/land-contract-package/[id]": ["./src/document-templates/land-contract-package/*"],
  },
};

export default nextConfig;
