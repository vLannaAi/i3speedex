import type { Attachment } from '~/types'

export function useAttachments() {
  const { get, post, del } = useApi()

  async function getUploadUrl(saleId: string, fileName: string, fileType: string, fileSize: number) {
    return post<{ attachmentId: string; uploadUrl: string; s3Key: string; expiresIn: number }>(
      `/api/sales/${saleId}/upload-url`,
      { fileName, fileType, fileSize },
    )
  }

  async function registerAttachment(saleId: string, data: {
    attachmentId: string
    fileName: string
    fileType: string
    fileSize: number
    s3Key: string
    description?: string
  }) {
    return post<Attachment>(`/api/sales/${saleId}/attachments`, data)
  }

  async function fetchAttachments(saleId: string) {
    // Response: { data: { attachments: [...] } }
    const res = await get<any>(`/api/sales/${saleId}/attachments`)
    return {
      ...res,
      data: res.data?.attachments || res.data || [],
    }
  }

  async function deleteAttachment(saleId: string, attachmentId: string) {
    return del<void>(`/api/sales/${saleId}/attachments/${attachmentId}`)
  }

  async function uploadFile(saleId: string, file: File, description?: string) {
    // 1. Get presigned URL (returns attachmentId, uploadUrl, s3Key)
    const urlRes = await getUploadUrl(saleId, file.name, file.type, file.size)
    if (!urlRes.success || !urlRes.data) throw new Error('Impossibile ottenere URL di upload')

    // 2. Upload to S3 via presigned URL
    await fetch(urlRes.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })

    // 3. Register attachment with the attachmentId from step 1
    return registerAttachment(saleId, {
      attachmentId: urlRes.data.attachmentId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      s3Key: urlRes.data.s3Key,
      description,
    })
  }

  return { getUploadUrl, registerAttachment, fetchAttachments, deleteAttachment, uploadFile }
}
