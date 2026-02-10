# i2speedex Sale Module - S3 Storage Setup

## Cloud Storage for Documents & Attachments

**Date**: January 29, 2026
**Status**: ✅ S3 Buckets Deployed
**Environment**: Development (dev)

---

## Deployed Resources

### Documents Bucket
**Bucket Name**: `i2speedex-documents-dev-827562051115`
**ARN**: `arn:aws:s3:::i2speedex-documents-dev-827562051115`
**Region**: eu-west-1
**Purpose**: Store generated documents (PDFs, XML invoices, HTML)
**Status**: ✅ ACTIVE

**Configuration**:
- **Encryption**: S3-managed (SSE-S3)
- **Public Access**: ❌ Blocked (all)
- **Versioning**: ❌ Disabled (dev), ✅ Enabled (prod)
- **SSL**: ✅ Required (enforceSSL: true)
- **Auto-delete**: ✅ Enabled (dev only)

**Lifecycle Rules** (Development):
```
DeleteOldDevDocuments:
  - Enabled: ✅ Yes
  - Expiration: 30 days
  - Purpose: Clean up dev documents automatically
```

**Lifecycle Rules** (Production):
```
TransitionToIA:
  - Enabled: ✅ Yes
  - Storage Class: INTELLIGENT_TIERING
  - Transition After: 90 days
  - Purpose: Optimize storage costs for older documents

TransitionToGlacier:
  - Enabled: ✅ Yes
  - Storage Class: GLACIER
  - Transition After: 365 days (1 year)
  - Purpose: Long-term archival of old invoices
```

### Attachments Bucket
**Bucket Name**: `i2speedex-attachments-dev-827562051115`
**ARN**: `arn:aws:s3:::i2speedex-attachments-dev-827562051115`
**Region**: eu-west-1
**Purpose**: Store file attachments uploaded by users
**Status**: ✅ ACTIVE

**Configuration**:
- **Encryption**: S3-managed (SSE-S3)
- **Public Access**: ❌ Blocked (all)
- **Versioning**: ❌ Disabled (dev), ✅ Enabled (prod)
- **SSL**: ✅ Required (enforceSSL: true)
- **Auto-delete**: ✅ Enabled (dev only)

**Lifecycle Rules** (Development):
```
DeleteOldDevAttachments:
  - Enabled: ✅ Yes
  - Expiration: 30 days
  - Purpose: Clean up dev uploads automatically
```

**Lifecycle Rules** (Production):
```
TransitionToIA:
  - Enabled: ✅ Yes
  - Storage Class: INTELLIGENT_TIERING
  - Transition After: 180 days (6 months)
  - Purpose: Optimize storage costs for older attachments
```

---

## CORS Configuration

### Documents Bucket

**Allowed Methods**:
- GET (download documents)
- PUT (upload via pre-signed URLs)
- POST (multipart uploads)

**Allowed Origins** (Development):
- `http://localhost:3000` (local development)
- `https://dev-sales.i2speedex.com` (dev environment)

**Allowed Origins** (Production):
- `https://sales.i2speedex.com` (production only)

**Allowed Headers**: `*` (all headers)
**Max Age**: 3600 seconds (1 hour)

### Attachments Bucket

**Allowed Methods**:
- GET (download attachments)
- PUT (upload via pre-signed URLs)
- POST (multipart uploads)
- DELETE (remove attachments)

**Allowed Origins**: Same as Documents Bucket

**Allowed Headers**: `*` (all headers)
**Exposed Headers**: `ETag` (for upload verification)
**Max Age**: 3600 seconds (1 hour)

---

## Folder Structure

### Documents Bucket

```
i2speedex-documents-dev-827562051115/
├── pdfs/
│   └── {year}/
│       └── {sale_id}/
│           ├── invoice-{sale_id}.pdf
│           └── invoice-{sale_id}-{language}.pdf
│
├── xml/
│   └── {year}/
│       └── {sale_id}/
│           └── invoice-{sale_id}.xml (SDI format)
│
└── html/
    └── {year}/
        └── {sale_id}/
            └── invoice-{sale_id}.html
```

**Examples**:
```
/pdfs/2026/SALE001/invoice-SALE001.pdf
/pdfs/2026/SALE001/invoice-SALE001-it.pdf
/pdfs/2026/SALE001/invoice-SALE001-en.pdf
/xml/2026/SALE001/invoice-SALE001.xml
/html/2026/SALE001/invoice-SALE001.html
```

### Attachments Bucket

```
i2speedex-attachments-dev-827562051115/
├── sales/
│   └── {sale_id}/
│       └── {filename}
│
├── buyers/
│   └── {buyer_id}/
│       └── {filename}
│
└── temp/
    └── {temp_upload_id}/
        └── {filename}
```

**Examples**:
```
/sales/SALE001/contract-signed.pdf
/sales/SALE001/shipping-label.pdf
/buyers/BUYER123/vat-certificate.pdf
/temp/upload-abc123/document.pdf
```

---

## Integration with Lambda Functions

### Uploading Documents (Lambda → S3)

```typescript
// Lambda function to generate and upload PDF invoice
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'eu-west-1' });

export async function uploadInvoice(saleId: string, pdfBuffer: Buffer, language: string = 'it') {
  const year = new Date().getFullYear();
  const key = `pdfs/${year}/${saleId}/invoice-${saleId}-${language}.pdf`;

  const command = new PutObjectCommand({
    Bucket: process.env.DOCUMENTS_BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256',
    Metadata: {
      saleId: saleId,
      language: language,
      generatedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return {
    bucket: process.env.DOCUMENTS_BUCKET_NAME,
    key: key,
    url: `https://${process.env.DOCUMENTS_BUCKET_NAME}.s3.eu-west-1.amazonaws.com/${key}`,
  };
}
```

### Generating Pre-signed URLs (Lambda → Frontend)

```typescript
// Lambda function to create pre-signed URL for direct upload
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'eu-west-1' });

export async function createUploadUrl(saleId: string, filename: string) {
  const key = `sales/${saleId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ATTACHMENTS_BUCKET_NAME,
    Key: key,
    ServerSideEncryption: 'AES256',
    Metadata: {
      saleId: saleId,
      uploadedBy: 'user-id', // From Cognito
    },
  });

  // Pre-signed URL valid for 15 minutes
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 900
  });

  return {
    uploadUrl: presignedUrl,
    key: key,
    expiresIn: 900,
  };
}
```

### Downloading Documents (Lambda → Frontend)

```typescript
// Lambda function to create pre-signed download URL
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'eu-west-1' });

export async function getDownloadUrl(saleId: string, documentType: 'pdf' | 'xml' | 'html', language: string = 'it') {
  const year = new Date().getFullYear();

  let key: string;
  let contentType: string;

  switch (documentType) {
    case 'pdf':
      key = `pdfs/${year}/${saleId}/invoice-${saleId}-${language}.pdf`;
      contentType = 'application/pdf';
      break;
    case 'xml':
      key = `xml/${year}/${saleId}/invoice-${saleId}.xml`;
      contentType = 'application/xml';
      break;
    case 'html':
      key = `html/${year}/${saleId}/invoice-${saleId}.html`;
      contentType = 'text/html';
      break;
  }

  const command = new GetObjectCommand({
    Bucket: process.env.DOCUMENTS_BUCKET_NAME,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename="invoice-${saleId}.${documentType}"`,
  });

  // Pre-signed URL valid for 1 hour
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600
  });

  return {
    downloadUrl: presignedUrl,
    expiresIn: 3600,
  };
}
```

---

## Integration with Nuxt 4 Frontend

### Direct File Upload to S3

```vue
<!-- components/FileUpload.vue -->
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  saleId: string;
}>();

const file = ref<File | null>(null);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadedUrl = ref<string | null>(null);

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    file.value = target.files[0];
  }
}

async function uploadFile() {
  if (!file.value) return;

  uploading.value = true;
  uploadProgress.value = 0;

  try {
    // Step 1: Get pre-signed URL from API
    const api = useApi();
    const { uploadUrl, key } = await api.post(`/sales/${props.saleId}/upload-url`, {
      filename: file.value.name,
    });

    // Step 2: Upload directly to S3
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      }
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.value.type);

    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = reject;
      xhr.send(file.value);
    });

    uploadedUrl.value = key;

    // Step 3: Notify API that upload is complete
    await api.post(`/sales/${props.saleId}/attachments`, {
      key: key,
      filename: file.value.name,
      size: file.value.size,
      mimeType: file.value.type,
    });

    console.log('Upload complete:', key);

  } catch (error) {
    console.error('Upload error:', error);
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="file-upload">
    <input
      type="file"
      @change="handleFileSelect"
      :disabled="uploading"
    />

    <button
      @click="uploadFile"
      :disabled="!file || uploading"
    >
      {{ uploading ? `Uploading ${uploadProgress}%` : 'Upload File' }}
    </button>

    <div v-if="uploadedUrl" class="success">
      File uploaded successfully: {{ uploadedUrl }}
    </div>
  </div>
</template>
```

### Download Invoice PDF

```vue
<!-- components/InvoiceDownload.vue -->
<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  saleId: string;
  language?: string;
}>();

const downloading = ref(false);

async function downloadInvoice(format: 'pdf' | 'xml' | 'html') {
  downloading.value = true;

  try {
    const api = useApi();

    // Get pre-signed download URL from API
    const { downloadUrl } = await api.get(
      `/sales/${props.saleId}/invoice/download?format=${format}&language=${props.language || 'it'}`
    );

    // Open download URL in new tab (or use fetch to download)
    window.open(downloadUrl, '_blank');

    // Alternative: Download using fetch
    /*
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${props.saleId}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    */

  } catch (error) {
    console.error('Download error:', error);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <div class="invoice-download">
    <button @click="downloadInvoice('pdf')" :disabled="downloading">
      Download PDF
    </button>
    <button @click="downloadInvoice('xml')" :disabled="downloading">
      Download XML (SDI)
    </button>
    <button @click="downloadInvoice('html')" :disabled="downloading">
      View HTML
    </button>
  </div>
</template>
```

---

## Security & Permissions

### Bucket Policies

Both buckets are configured with:
- ✅ Block all public access
- ✅ SSL/TLS required (enforceSSL: true)
- ✅ S3-managed encryption (SSE-S3)
- ✅ Auto-delete enabled for dev environment

### IAM Policies for Lambda Functions

Lambda functions need the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::i2speedex-documents-dev-827562051115/*",
        "arn:aws:s3:::i2speedex-attachments-dev-827562051115/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::i2speedex-documents-dev-827562051115",
        "arn:aws:s3:::i2speedex-attachments-dev-827562051115"
      ]
    }
  ]
}
```

### Pre-signed URL Best Practices

1. **Short Expiration**: Keep expiration times short (15 min for uploads, 1 hour for downloads)
2. **Unique Keys**: Use UUIDs or timestamps in file keys to prevent overwrites
3. **Content-Type Validation**: Specify allowed MIME types in pre-signed URLs
4. **Size Limits**: Implement file size limits in Lambda (e.g., max 10MB)
5. **Virus Scanning**: Consider adding S3 event-triggered virus scanning for production

---

## CloudWatch Monitoring

### S3 Metrics Available

- **BucketSizeBytes**: Total bucket size in bytes
- **NumberOfObjects**: Total number of objects
- **AllRequests**: Total number of requests
- **GetRequests**: Number of GET requests
- **PutRequests**: Number of PUT requests
- **4xxErrors**: Client error count
- **5xxErrors**: Server error count

### Production Alarms

**Bucket Size Alarm** (Production only):
```
Metric: BucketSizeBytes
Threshold: 50 GB
Period: 1 day
Action: Alert when documents bucket exceeds 50GB
```

### View S3 Metrics

```bash
# Get bucket size
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=i2speedex-documents-dev-827562051115 Name=StorageType,Value=StandardStorage \
  --start-time $(date -u -d '7 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 86400 \
  --statistics Average

# Get number of objects
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name NumberOfObjects \
  --dimensions Name=BucketName,Value=i2speedex-documents-dev-827562051115 Name=StorageType,Value=AllStorageTypes \
  --start-time $(date -u -d '7 days ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 86400 \
  --statistics Average
```

---

## S3 Operations via AWS CLI

### List Files in Documents Bucket

```bash
# List all PDFs
aws s3 ls s3://i2speedex-documents-dev-827562051115/pdfs/ --recursive

# List PDFs for specific year
aws s3 ls s3://i2speedex-documents-dev-827562051115/pdfs/2026/ --recursive

# List all files with human-readable sizes
aws s3 ls s3://i2speedex-documents-dev-827562051115/ --recursive --human-readable --summarize
```

### Upload File Manually

```bash
# Upload PDF invoice
aws s3 cp invoice.pdf s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/invoice-SALE001.pdf \
  --content-type application/pdf \
  --metadata saleId=SALE001,language=it

# Upload with server-side encryption
aws s3 cp invoice.pdf s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/invoice-SALE001.pdf \
  --sse AES256
```

### Download File

```bash
# Download PDF invoice
aws s3 cp s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/invoice-SALE001.pdf ./invoice.pdf

# Download entire year of invoices
aws s3 sync s3://i2speedex-documents-dev-827562051115/pdfs/2026/ ./invoices-2026/
```

### Delete File

```bash
# Delete single file
aws s3 rm s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/invoice-SALE001.pdf

# Delete all files for a sale
aws s3 rm s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/ --recursive
```

### Get Object Metadata

```bash
# Get file metadata
aws s3api head-object \
  --bucket i2speedex-documents-dev-827562051115 \
  --key pdfs/2026/SALE001/invoice-SALE001.pdf
```

---

## Cost Estimation

### S3 Pricing (eu-west-1)

**Storage Costs**:
- Standard Storage: $0.023 per GB/month
- Intelligent Tiering: $0.0025 per 1,000 objects + automatic cost optimization
- Glacier Storage: $0.004 per GB/month

**Request Costs**:
- PUT/COPY/POST: $0.005 per 1,000 requests
- GET/SELECT: $0.0004 per 1,000 requests

**Data Transfer**:
- Data IN to S3: FREE
- Data OUT to internet: First 100 GB/month FREE, then $0.09 per GB

### Expected Cost for i2speedex

**Assumptions**:
- 100 sales/month
- 3 documents per sale (PDF, XML, HTML)
- Average 200 KB per document
- 10 downloads per document
- Total storage: 60 MB/month

**Monthly Cost**:
- Storage: 0.06 GB × $0.023 = **$0.00** (negligible)
- PUT requests: 300 × $0.005/1000 = **$0.00**
- GET requests: 3,000 × $0.0004/1000 = **$0.00**
- Data transfer: < 100 GB = **$0.00** (free tier)

**Total Monthly Cost**: **~$0.00** (within free tier)

**Headroom**: Can store ~4,300 GB before reaching $100/month

---

## Testing S3 Integration

### Test File Upload

```bash
# Create test file
echo "Test invoice content" > test-invoice.pdf

# Upload to documents bucket
aws s3 cp test-invoice.pdf s3://i2speedex-documents-dev-827562051115/pdfs/2026/TEST001/invoice-TEST001.pdf

# Verify upload
aws s3 ls s3://i2speedex-documents-dev-827562051115/pdfs/2026/TEST001/
```

### Test Pre-signed URL Generation

```bash
# Generate pre-signed URL for upload (15 minutes)
aws s3 presign s3://i2speedex-attachments-dev-827562051115/temp/test/file.pdf \
  --expires-in 900

# Generate pre-signed URL for download (1 hour)
aws s3 presign s3://i2speedex-documents-dev-827562051115/pdfs/2026/SALE001/invoice-SALE001.pdf \
  --expires-in 3600
```

### Test CORS Configuration

```bash
# Test CORS from browser console
fetch('https://i2speedex-documents-dev-827562051115.s3.eu-west-1.amazonaws.com/pdfs/2026/SALE001/invoice-SALE001.pdf', {
  method: 'HEAD',
  headers: {
    'Origin': 'http://localhost:3000'
  }
}).then(response => {
  console.log('CORS headers:', response.headers);
});
```

---

## Troubleshooting

### Access Denied Error

**Cause**: Missing IAM permissions or bucket policy issue
**Solution**:
1. Check Lambda execution role has S3 permissions
2. Verify bucket policy allows Lambda access
3. Ensure SSL is being used (enforceSSL: true)

### CORS Error

**Cause**: Origin not in allowed list or headers missing
**Solution**:
1. Check CORS configuration includes your origin
2. Verify request includes correct headers
3. Use pre-signed URLs which bypass CORS

### Pre-signed URL Expired

**Cause**: URL expiration time exceeded
**Solution**:
1. Generate new pre-signed URL
2. Reduce expiration time for security
3. Implement auto-refresh in frontend

### File Not Found

**Cause**: Incorrect key or file hasn't been uploaded yet
**Solution**:
1. Verify file exists using AWS CLI: `aws s3 ls s3://bucket/key`
2. Check key format matches expected pattern
3. Ensure upload completed successfully

---

## Next Steps

- [ ] Connect S3 to Lambda functions (invoice generation, file uploads)
- [ ] Set up CloudFront distribution for faster downloads
- [ ] Implement virus scanning for uploaded files (production)
- [ ] Add S3 event notifications for automated workflows
- [ ] Configure S3 replication for disaster recovery (production)
- [ ] Set up S3 inventory for compliance reporting
- [ ] Add lifecycle policy monitoring and alerts

---

## Infrastructure as Code

### CDK Stack Location
`lambda-building-blocks/cdk/lib/sale-module-s3-stack.ts`

### Deploy Commands

```bash
# Deploy S3 buckets
cd lambda-building-blocks/cdk
npx cdk deploy SaleModuleS3-Dev --context environment=dev

# View stack outputs
aws cloudformation describe-stacks \
  --stack-name SaleModuleS3-Dev \
  --query 'Stacks[0].Outputs'

# Delete stack (dev only - will delete buckets and all files)
npx cdk destroy SaleModuleS3-Dev --context environment=dev
```

---

## Links

- **S3 Console - Documents**: https://s3.console.aws.amazon.com/s3/buckets/i2speedex-documents-dev-827562051115
- **S3 Console - Attachments**: https://s3.console.aws.amazon.com/s3/buckets/i2speedex-attachments-dev-827562051115
- **CloudWatch Metrics**: https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#metricsV2:graph=~();namespace=~'AWS*2fS3
- **CloudFormation Stack**: https://eu-west-1.console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/stackinfo?stackId=arn:aws:cloudformation:eu-west-1:827562051115:stack/SaleModuleS3-Dev/8dcb0670-fcd2-11f0-9799-02ab37f2202b

---

**Status**: ✅ S3 Buckets Deployed & Configured
**Deployment Date**: January 29, 2026, 12:23 UTC
**Deployed By**: Claude Code
**Environment**: Development (dev)
**Documents Bucket**: i2speedex-documents-dev-827562051115
**Attachments Bucket**: i2speedex-attachments-dev-827562051115
**Next**: Set up CloudFront CDN distribution (optional) or proceed to Phase 2 (Backend Lambda functions)
