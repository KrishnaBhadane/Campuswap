import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

function client() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not configured');
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  return cloudinary;
}

export async function deleteCollegeId(publicId) {
  if (!publicId) return;
  const result = await client().uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated', invalidate: true, timeout: 15000 });
  if (!['ok', 'not found'].includes(result.result)) throw new Error('College ID deletion failed');
}

export async function uploadPrivateId(buffer) {
  const publicId = `campuswap/verification/${randomUUID()}`;
  try {
    await new Promise((resolve, reject) => {
      client().uploader.upload_stream({ public_id: publicId, resource_type: 'image', type: 'authenticated', overwrite: false, timeout: 15000 },
        (error, result) => error ? reject(error) : resolve(result)).end(buffer);
    });
    return publicId;
  } catch (error) {
    if (!error.http_code || error.http_code >= 500) await deleteCollegeId(publicId);
    throw Object.assign(new Error('College ID upload failed'), { status: 502 });
  }
}

export async function readPrivateId(publicId) {
  const url = client().utils.private_download_url(publicId, 'webp', {
    resource_type: 'image', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Object.assign(new Error('College ID could not be retrieved'), { status: 502 });
  return Buffer.from(await response.arrayBuffer());
}
