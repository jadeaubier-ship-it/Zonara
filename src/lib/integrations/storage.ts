import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client =
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
      })
    : null;

export async function getUploadUrl(key: string, contentType: string) {
  if (!client || !process.env.R2_BUCKET) {
    return { signedUrl: `${process.env.R2_PUBLIC_URL ?? ""}/${key}`, key };
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType
  });

  return {
    signedUrl: await getSignedUrl(client, command, { expiresIn: 900 }),
    key
  };
}

export async function getDownloadUrl(key: string) {
  if (!client || !process.env.R2_BUCKET) {
    return `${process.env.R2_PUBLIC_URL ?? ""}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  });

  return getSignedUrl(client, command, { expiresIn: 900 });
}
