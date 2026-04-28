import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

const UPLOAD_EXPIRES_SECONDS = 300; // 5 minutes
const DOWNLOAD_EXPIRES_SECONDS = 3600; // 1 hour

const createClient = (): S3Client =>
  new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });

export function generateUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const client = createClient();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_EXPIRES_SECONDS });
}

export function getPublicUrl(key: string): string {
  return `${env.R2_PUBLIC_URL}/${key}`;
}

export function generateDownloadUrl(key: string): Promise<string> {
  const client = createClient();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_EXPIRES_SECONDS,
  });
}

export async function checkObjectExists(key: string): Promise<boolean> {
  const client = createClient();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
    );
    return true;
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return false;
    }
    throw error;
  }
}
