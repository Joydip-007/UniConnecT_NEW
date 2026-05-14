"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = exports.s3Client = void 0;
exports.createUploadKey = createUploadKey;
exports.createPutObjectCommand = createPutObjectCommand;
exports.getPresignedUploadUrl = getPresignedUploadUrl;
exports.sanitizeFileName = sanitizeFileName;
const node_crypto_1 = require("node:crypto");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("../config/env");
exports.s3Client = new client_s3_1.S3Client({
    region: env_1.env.AWS_REGION,
    credentials: env_1.env.AWS_ACCESS_KEY_ID && env_1.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
        }
        : undefined,
});
function createUploadKey(input) {
    const safeFileName = sanitizeFileName(input.fileName);
    const folder = input.folder?.replace(/^\/+|\/+$/g, '') || 'uploads';
    return `${folder}/${(0, node_crypto_1.randomUUID)()}-${safeFileName}`;
}
function createPutObjectCommand(input) {
    const key = createUploadKey(input);
    return {
        key,
        command: new client_s3_1.PutObjectCommand({
            Bucket: env_1.env.AWS_S3_BUCKET,
            Key: key,
            ContentType: input.contentType,
        }),
    };
}
async function getPresignedUploadUrl(key, contentType) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: env_1.env.AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType,
    });
    return {
        uploadUrl: await (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn: 300 }),
        publicUrl: `https://${env_1.env.AWS_S3_BUCKET}.s3.${env_1.env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`,
    };
}
exports.uploadService = {
    getPresignedUploadUrl,
};
function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}
function encodeS3Key(key) {
    return key.split('/').map(encodeURIComponent).join('/');
}
