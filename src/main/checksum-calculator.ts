import * as fs from 'fs';
import * as crypto from 'crypto';

// Compute image file checksum
export async function calculateFileChecksum(
  filePath: string,
  algorithm: 'sha256' | 'md5' = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Initialize hash stream
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 2 });

    // Stream image chunks
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    // Finalize digest string
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    // Handle stream errors
    stream.on('error', (err) => {
      reject(err);
    });
  });
}
