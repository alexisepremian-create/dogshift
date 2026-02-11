import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const R2_BUCKET = (process.env.R2_BUCKET ?? "").trim();

function requiredEnv(name: string) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`[r2] missing env ${name}`);
  }
  return value;
}

export function getR2Client() {
  const endpoint = requiredEnv("R2_ENDPOINT");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function presignPutObject(args: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const client = getR2Client();
  const bucket = R2_BUCKET || requiredEnv("R2_BUCKET");
  const expiresIn = args.expiresInSeconds ?? 60;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: args.key,
    ContentType: args.contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, expiresIn };
}

export async function presignGetObject(args: { key: string; expiresInSeconds?: number }) {
  const client = getR2Client();
  const bucket = R2_BUCKET || requiredEnv("R2_BUCKET");
  const expiresIn = args.expiresInSeconds ?? 60;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: args.key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, expiresIn };
}

export async function headObject(args: { key: string }) {
  const client = getR2Client();
  const bucket = R2_BUCKET || requiredEnv("R2_BUCKET");
  const command = new HeadObjectCommand({ Bucket: bucket, Key: args.key });
  return client.send(command);
}

export async function deleteObject(args: { key: string }) {
  const client = getR2Client();
  const bucket = R2_BUCKET || requiredEnv("R2_BUCKET");
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: args.key });
  return client.send(command);
}
