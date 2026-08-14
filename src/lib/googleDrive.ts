import { JWT } from "google-auth-library";

// Uses a service account (not OAuth-on-behalf-of-a-user) — this app is a
// server, not a logged-in Google user, so a service account with the
// target Shared Drive folder explicitly shared with it is the only way to
// upload here without a human in the loop. Setup (one-time, done in Google
// Cloud Console by whoever administers the Google Workspace):
//   1. Create a Google Cloud project (or reuse one), enable the Drive API.
//   2. Create a service account, create a JSON key for it.
//   3. In Google Drive, share the target Shared Drive folder with that
//      service account's email (Content Manager or Editor) — service
//      accounts have no storage quota of their own, so they can only ever
//      write into a folder a real person/Shared Drive has shared with them.
//   4. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
//      (the key's `client_email`/`private_key` fields) and
//      LC_PACKAGE_DRIVE_FOLDER_ID (the target folder's ID, from its URL) below.
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

function getAuthClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Google Drive isn't configured yet — GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set."
    );
  }
  // Env vars can't hold a literal newline cleanly — the private key is
  // stored with escaped "\n" sequences and un-escaped here.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return new JWT({ email, key: privateKey, scopes: ["https://www.googleapis.com/auth/drive"] });
}

function rootFolderId(): string {
  const id = process.env.LC_PACKAGE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("LC_PACKAGE_DRIVE_FOLDER_ID is not set — no target Drive folder configured.");
  return id;
}

// Google Drive folder names may collide (Drive allows duplicate names in
// the same folder, unlike a filesystem) — appends a numeric suffix only if
// a name search turns up an existing folder, so re-publishing under an
// identical buyer+address+date doesn't silently create confusing dupes.
async function uniqueFolderName(client: JWT, parentId: string, desiredName: string): Promise<string> {
  const escaped = desiredName.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${escaped}'`;
  const res = await client.request<{ files: { name: string }[] }>({
    url: `${DRIVE_API}/files`,
    params: { q, fields: "files(name)", supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: "allDrives" },
  });
  const existingNames = new Set(res.data.files.map((f) => f.name));
  if (!existingNames.has(desiredName)) return desiredName;
  let i = 2;
  while (existingNames.has(`${desiredName} (${i})`)) i++;
  return `${desiredName} (${i})`;
}

async function createFolder(client: JWT, name: string, parentId: string): Promise<{ id: string; webViewLink: string }> {
  const res = await client.request<{ id: string; webViewLink: string }>({
    url: `${DRIVE_API}/files`,
    method: "POST",
    params: { supportsAllDrives: true, fields: "id,webViewLink" },
    data: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
  });
  return res.data;
}

async function uploadFile(client: JWT, folderId: string, filename: string, buffer: Buffer, mimeType: string): Promise<void> {
  const boundary = `lc_package_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  await client.request({
    url: `${DRIVE_UPLOAD_API}/files`,
    method: "POST",
    params: { uploadType: "multipart", supportsAllDrives: true },
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    data: body,
  });
}

function mimeTypeFor(filename: string): string {
  if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (filename.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

// Creates (or reuses, with a de-duped name) a folder under the configured
// root, uploads every file into it, and returns the folder's own Drive URL.
export async function uploadPackageToDrive(
  folderName: string,
  files: { filename: string; buffer: Buffer }[]
): Promise<{ folderId: string; folderUrl: string }> {
  const client = getAuthClient();
  const parentId = rootFolderId();
  const finalName = await uniqueFolderName(client, parentId, folderName);
  const folder = await createFolder(client, finalName, parentId);

  for (const file of files) {
    await uploadFile(client, folder.id, file.filename, file.buffer, mimeTypeFor(file.filename));
  }

  return { folderId: folder.id, folderUrl: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}` };
}
