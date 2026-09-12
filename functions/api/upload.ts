import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handleUpload = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;

  if (method === 'POST') {
    if (!meetingId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing meeting ID' }) };
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${meetingId}.txt`,
      ContentType: 'text/plain', // Mime type validation is handled in the frontend and extraction lambda
    });

    // 15 minute expiry per requirements
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ uploadUrl }),
    };
  }
};
