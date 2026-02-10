# File Upload Implementation

## Task #17: File Upload Lambda Functions

**Date**: January 29, 2026
**Status**: ✅ Complete
**Handlers Implemented**: 4

---

## Overview

Implemented complete file upload and attachment management workflow using pre-signed S3 URLs for secure direct browser-to-S3 uploads. This approach:
- Reduces Lambda processing time and costs
- Eliminates file size limits in API Gateway
- Provides secure, time-limited upload URLs
- Tracks attachment metadata in DynamoDB

---

## Implemented Handlers

### 1. Generate Upload URL
**File**: `src/handlers/attachments/generate-upload-url.ts`
**Route**: `POST /api/sales/{id}/upload-url`
**Description**: Generate pre-signed S3 URL for direct file upload

**Features**:
- Generate time-limited upload URL (15 minutes)
- Validate user permissions (write)
- Validate file size (max 10MB)
- Validate file type (PDF, images, Office docs, text)
- Generate unique attachment ID
- Return URL and metadata for client

**Request Body**:
```json
{
  "fileName": "invoice.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "uploadUrl": "https://i2speedex-documents-dev-827562051115.s3.eu-west-1.amazonaws.com/attachments/2026/SALE001/a1b2c3d4.pdf?X-Amz-Algorithm=...",
    "s3Key": "attachments/2026/SALE001/a1b2c3d4.pdf",
    "expiresIn": 900,
    "message": "Upload URL generated successfully. Upload your file to this URL, then register the attachment."
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Validate file size (max 10MB)
3. Validate file type (whitelist)
4. Get sale and check access
5. Generate attachment ID (UUID)
6. Generate S3 key: `attachments/{year}/{saleId}/{attachmentId}.{ext}`
7. Generate pre-signed upload URL (15 minutes)
8. Return URL and metadata

**Allowed File Types**:
- PDF: `application/pdf`
- Images: `image/jpeg`, `image/jpg`, `image/png`
- Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Text: `text/plain`, `text/csv`

**File Size Limit**: 10MB (10,485,760 bytes)

---

### 2. Register Attachment
**File**: `src/handlers/attachments/register-attachment.ts`
**Route**: `POST /api/sales/{id}/attachments`
**Description**: Register uploaded file metadata in DynamoDB

**Features**:
- Store attachment metadata after upload
- Link attachment to sale
- Validate user permissions (write)
- Optional description field

**Request Body**:
```json
{
  "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "fileName": "invoice.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576,
  "s3Key": "attachments/2026/SALE001/a1b2c3d4.pdf",
  "description": "Supplier invoice for this sale"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "PK": "SALE#SALE001",
    "SK": "ATTACHMENT#a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "saleId": "SALE001",
    "fileName": "invoice.pdf",
    "fileType": "application/pdf",
    "fileSize": 1048576,
    "s3Key": "attachments/2026/SALE001/a1b2c3d4.pdf",
    "description": "Supplier invoice for this sale",
    "createdAt": "2026-01-29T12:00:00.000Z",
    "createdBy": "admin@i2speedex.com",
    "updatedAt": "2026-01-29T12:00:00.000Z",
    "updatedBy": "admin@i2speedex.com"
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Validate required fields (attachmentId, fileName, fileType, fileSize, s3Key)
3. Get sale and check access
4. Create attachment record in DynamoDB
5. Return created attachment

**DynamoDB Structure**:
```
PK: SALE#{saleId}
SK: ATTACHMENT#{attachmentId}
```

---

### 3. List Attachments
**File**: `src/handlers/attachments/list-attachments.ts`
**Route**: `GET /api/sales/{id}/attachments`
**Description**: List all attachments for a sale with download URLs

**Features**:
- List all attachments for a sale
- Generate pre-signed download URLs (1 hour)
- Filter out soft-deleted attachments
- Sort by creation date (newest first)
- Read-only access (all authenticated users)

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "attachments": [
      {
        "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "fileName": "invoice.pdf",
        "fileType": "application/pdf",
        "fileSize": 1048576,
        "description": "Supplier invoice for this sale",
        "downloadUrl": "https://i2speedex-documents-dev-827562051115.s3.eu-west-1.amazonaws.com/attachments/2026/SALE001/a1b2c3d4.pdf?X-Amz-Algorithm=...",
        "createdAt": "2026-01-29T12:00:00.000Z",
        "createdBy": "admin@i2speedex.com"
      },
      {
        "attachmentId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "fileName": "receipt.jpg",
        "fileType": "image/jpeg",
        "fileSize": 524288,
        "description": "Payment receipt",
        "downloadUrl": "https://i2speedex-documents-dev-827562051115.s3.eu-west-1.amazonaws.com/attachments/2026/SALE001/b2c3d4e5.jpg?X-Amz-Algorithm=...",
        "createdAt": "2026-01-29T11:00:00.000Z",
        "createdBy": "operator@i2speedex.com"
      }
    ],
    "count": 2,
    "message": "Found 2 attachment(s)"
  }
}
```

**Workflow**:
1. Validate user authentication
2. Get sale and check access
3. Query attachments from DynamoDB
4. Filter out soft-deleted attachments
5. Generate download URL for each attachment (1 hour expiry)
6. Sort by creation date (newest first)
7. Return attachments with download URLs

**Download URL Expiration**: 1 hour (3600 seconds)

---

### 4. Delete Attachment
**File**: `src/handlers/attachments/delete-attachment.ts`
**Route**: `DELETE /api/sales/{id}/attachments/{attachmentId}`
**Description**: Delete attachment (soft delete in DynamoDB, hard delete in S3)

**Features**:
- Soft delete attachment metadata in DynamoDB
- Hard delete file from S3
- Validate user permissions (write)
- Graceful S3 deletion (continue if file already deleted)

**Query Parameters**: None (IDs in path)

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "message": "Attachment deleted successfully"
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Get sale and check access
3. Get attachment from DynamoDB
4. Soft delete attachment in DynamoDB (set deletedAt)
5. Hard delete file from S3
6. Return success response

**Deletion Strategy**:
- **DynamoDB**: Soft delete (set `deletedAt` timestamp)
- **S3**: Hard delete (file permanently removed)
- **Error Handling**: Continues even if S3 deletion fails (file might be already deleted)

---

## Complete Upload Workflow

### Client-Side Implementation

```javascript
// Step 1: Request upload URL
const uploadResponse = await fetch('/api/sales/SALE001/upload-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    fileSize: file.size
  })
});

const { attachmentId, uploadUrl, s3Key } = await uploadResponse.json();

// Step 2: Upload file directly to S3
const uploadResult = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/pdf'
  },
  body: file
});

if (!uploadResult.ok) {
  throw new Error('File upload failed');
}

// Step 3: Register attachment metadata
const registerResponse = await fetch('/api/sales/SALE001/attachments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    attachmentId,
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    fileSize: file.size,
    s3Key,
    description: 'Supplier invoice for this sale'
  })
});

const attachment = await registerResponse.json();
console.log('Attachment registered:', attachment);
```

### Download Workflow

```javascript
// Step 1: List attachments (includes download URLs)
const listResponse = await fetch('/api/sales/SALE001/attachments', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { attachments } = await listResponse.json();

// Step 2: Download file (direct S3 download, no Lambda)
const downloadUrl = attachments[0].downloadUrl;
window.open(downloadUrl, '_blank');
// Or use fetch to download programmatically
```

---

## S3 Storage Structure

### Documents Bucket: `i2speedex-documents-dev-827562051115`

**Attachments**:
```
/attachments/{year}/{saleId}/{attachmentId}.{extension}
Example: /attachments/2026/SALE001/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

**Naming Convention**:
- Year folder for organization
- Sale ID folder for grouping
- Unique attachment ID (UUID) for uniqueness
- Original file extension preserved

---

## Validation Rules

### All Operations
- ✅ Sale must exist and not be deleted
- ✅ User must be authenticated
- ✅ User must have access to the sale

### Generate Upload URL
- ✅ User must have write permission
- ✅ fileName, fileType, fileSize are required
- ✅ File size must not exceed 10MB
- ✅ File type must be in allowed list

### Register Attachment
- ✅ User must have write permission
- ✅ attachmentId, fileName, fileType, fileSize, s3Key are required

### List Attachments
- ✅ No additional validation (read-only)
- ✅ Filters out soft-deleted attachments

### Delete Attachment
- ✅ User must have write permission
- ✅ Attachment must exist and not be deleted

---

## Error Responses

### 400 Bad Request
- Missing required fields
- File size exceeds limit
- File type not allowed

### 403 Forbidden
- User doesn't have write permission
- User doesn't have access to the sale

### 404 Not Found
- Sale not found
- Attachment not found
- Sale is soft deleted

### 500 Internal Server Error
- S3 upload URL generation failed
- DynamoDB operation failed

---

## Permissions Matrix

| Operation | Admin | Operator | Viewer |
|-----------|-------|----------|--------|
| Generate Upload URL | ✅ | ✅ Own | ❌ |
| Register Attachment | ✅ | ✅ Own | ❌ |
| List Attachments | ✅ | ✅ | ✅ |
| Delete Attachment | ✅ | ✅ Own | ❌ |

---

## Security Features

### Pre-signed URLs
- **Upload URLs**: 15 minutes expiry (short-lived for security)
- **Download URLs**: 1 hour expiry (longer for user convenience)
- **Content-Type**: Enforced on upload
- **Server-Side Encryption**: AES256 enabled

### Access Control
- Role-based permissions (admin, operator, viewer)
- Operator can only access own sales
- JWT authentication required

### File Validation
- File size limit (10MB)
- File type whitelist
- Unique file names (UUID-based)

---

## Performance Optimizations

### Direct S3 Upload
- Files uploaded directly to S3 (bypass Lambda)
- No API Gateway payload size limits
- No Lambda memory/timeout constraints
- Reduced Lambda costs

### Pre-signed URLs
- Generated on-demand
- Time-limited (no stale URLs)
- No need to store URLs in database

### DynamoDB Structure
- Attachments co-located with sales (same table)
- Single partition key for efficient queries
- No additional GSI needed

---

## Testing

### Generate Upload URL
```bash
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "invoice.pdf",
    "fileType": "application/pdf",
    "fileSize": 1048576
  }'
```

### Upload File to S3
```bash
curl -X PUT \
  "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary @invoice.pdf
```

### Register Attachment
```bash
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attachmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fileName": "invoice.pdf",
    "fileType": "application/pdf",
    "fileSize": 1048576,
    "s3Key": "attachments/2026/SALE001/a1b2c3d4.pdf",
    "description": "Supplier invoice"
  }'
```

### List Attachments
```bash
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/attachments \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Attachment
```bash
curl -X DELETE \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/attachments/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Browser Upload Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>File Upload Test</title>
</head>
<body>
  <input type="file" id="fileInput" />
  <button onclick="uploadFile()">Upload</button>

  <script>
    async function uploadFile() {
      const file = document.getElementById('fileInput').files[0];
      if (!file) return alert('Select a file first');

      try {
        // 1. Get upload URL
        const urlResponse = await fetch('/api/sales/SALE001/upload-url', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          })
        });

        const { attachmentId, uploadUrl, s3Key } = await urlResponse.json();

        // 2. Upload to S3
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });

        // 3. Register attachment
        const registerResponse = await fetch('/api/sales/SALE001/attachments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            attachmentId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            s3Key,
            description: 'User uploaded file'
          })
        });

        alert('File uploaded successfully!');
      } catch (error) {
        alert('Upload failed: ' + error.message);
      }
    }
  </script>
</body>
</html>
```

---

## Next Steps

1. ✅ Task #13: Implement Sales CRUD Lambda functions - **COMPLETE**
2. ✅ Task #14: Implement Buyers CRUD Lambda functions - **COMPLETE**
3. ✅ Task #15: Implement Producers CRUD Lambda functions - **COMPLETE**
4. ✅ Task #16: Implement Invoice Generation Lambda functions - **COMPLETE**
5. ✅ Task #17: Implement File Upload Lambda functions - **COMPLETE**
6. ⏳ Task #18: Implement Search and Dashboard Lambda functions - **NEXT**
7. ⏳ Task #19: Connect Lambda functions to API Gateway routes
8. ⏳ Task #20: Write unit tests for Lambda functions
9. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ File Upload Complete
**Date**: January 29, 2026
**Handlers**: 4/4 implemented
**Build**: ✅ Successful
**Location**: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/attachments/`
**Integration**: ✅ S3 pre-signed URLs, DynamoDB metadata storage
