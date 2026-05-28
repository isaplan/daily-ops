/**
 * @registry-id: dailyOpsBlobSpacesClient
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: S3-compatible client for DigitalOcean Spaces (cold tier)
 * @adr-ref: ADR-006
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { DailyOpsBlobConfig } from './config'

let cached: S3Client | null = null

export function getSpacesClient(cfg: DailyOpsBlobConfig): S3Client {
  if (cached) return cached
  cached = new S3Client({
    endpoint: cfg.spacesEndpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: cfg.spacesAccessKey,
      secretAccessKey: cfg.spacesSecretKey,
    },
    forcePathStyle: false,
  })
  return cached
}

export async function uploadColdBlob(
  cfg: DailyOpsBlobConfig,
  key: string,
  body: Buffer,
  contentType = 'application/gzip',
): Promise<void> {
  const client = getSpacesClient(cfg)
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.spacesBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentEncoding: 'gzip',
    }),
  )
}

export async function downloadColdBlob(cfg: DailyOpsBlobConfig, key: string): Promise<Buffer> {
  const client = getSpacesClient(cfg)
  const res = await client.send(
    new GetObjectCommand({
      Bucket: cfg.spacesBucket,
      Key: key,
    }),
  )
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
