// Mock for AWS SDK modules
const mockS3Client = {
  send: jest.fn(),
}

const mockS3 = {
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}

module.exports = mockS3 