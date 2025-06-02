import { z } from 'zod';

const cloudflareImageUploadResponseSchema = z.object({
  result: z.object({
    id: z.string(),
    filename: z.string().optional(),
    uploaded: z.string().optional(),
    requireSignedURLs: z.boolean().optional(),
    variants: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).nullable(),
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number(), message: z.string() })),
  messages: z.array(z.object({ code: z.number(), message: z.string() })),
});

type CloudflareImageUploadResponse = z.infer<typeof cloudflareImageUploadResponseSchema>;

interface UploadResult {
  success: boolean;
  imageId?: string;
  error?: string;
  variants?: string[];
  originalResponse?: CloudflareImageUploadResponse;
}

export class CloudflareImagesService {
  private accountId: string;
  private apiToken: string;
  private accountHash: string;
  private imageDeliveryBaseUrl: string; // e.g., 'imagedelivery.net'

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || ''; // Assuming this name
    this.accountHash = process.env.CLOUDFLARE_ACCOUNT_HASH || '';
    this.imageDeliveryBaseUrl = process.env.IMAGE_DELIVERY_URL || 'imagedelivery.net'; // Default if not set

    if (!this.accountId || !this.apiToken || !this.accountHash) {
      console.error(
        'Cloudflare Images Service: Missing required environment variables (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_HASH)'
      );
      // Depending on policy, you might throw an error here or allow degraded functionality
    }
  }

  /**
   * Uploads an image to Cloudflare Images from a given URL.
   * @param sourceImageUrl The publicly accessible URL of the image to upload.
   * @param metadata Optional metadata to associate with the image.
   * @param requireSignedURLs Whether the image should require signed URLs for access. Defaults to false.
   * @returns {Promise<UploadResult>} An object containing the success status, Cloudflare image ID, and any errors.
   */
  async uploadImageFromUrl(
    sourceImageUrl: string,
    metadata?: Record<string, any>,
    requireSignedURLs = false
  ): Promise<UploadResult> {
    if (!this.accountId || !this.apiToken) {
      return { success: false, error: 'Cloudflare service not configured (missing accountId or apiToken).' };
    }

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;

    const formData = new FormData();
    formData.append('url', sourceImageUrl);
    formData.append('requireSignedURLs', String(requireSignedURLs));
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          // 'Content-Type' will be set automatically by fetch for FormData
        },
        body: formData,
      });

      const responseData: CloudflareImageUploadResponse = await response.json();
      const validation = cloudflareImageUploadResponseSchema.safeParse(responseData);

      if (!validation.success) {
        console.error('Cloudflare API response validation error:', validation.error.issues);
        return { 
          success: false, 
          error: 'Invalid response structure from Cloudflare API.',
          originalResponse: responseData // include for debugging
        };
      }
      
      const validatedData = validation.data;

      if (validatedData.success && validatedData.result?.id) {
        return {
          success: true,
          imageId: validatedData.result.id,
          variants: validatedData.result.variants,
          originalResponse: validatedData
        };
      } else {
        const errorMessage = validatedData.errors?.[0]?.message || 'Unknown error during Cloudflare upload.';
        console.error('Cloudflare upload failed:', validatedData.errors);
        return { success: false, error: errorMessage, originalResponse: validatedData };
      }
    } catch (error: any) {
      console.error('Error uploading to Cloudflare:', error);
      return { success: false, error: error.message || 'Network error or unexpected issue during Cloudflare upload.' };
    }
  }

  /**
   * Uploads an image to Cloudflare Images from a Buffer.
   * @param imageBuffer The image data as a Buffer.
   * @param filename The filename for the uploaded image.
   * @param metadata Optional metadata to associate with the image.
   * @param requireSignedURLs Whether the image should require signed URLs for access. Defaults to false.
   * @returns {Promise<UploadResult>} An object containing the success status, Cloudflare image ID, and any errors.
   */
  async uploadImageFromBuffer(
    imageBuffer: Buffer,
    filename: string,
    metadata?: Record<string, any>,
    requireSignedURLs = false
  ): Promise<UploadResult> {
    if (!this.accountId || !this.apiToken) {
      return { success: false, error: 'Cloudflare service not configured (missing accountId or apiToken).' };
    }

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;

    const formData = new FormData();
    
    // Create a Blob from the buffer and append as file
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('file', blob, filename);
    formData.append('requireSignedURLs', String(requireSignedURLs));
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    try {
      console.log('🔄 Uploading processed image buffer to Cloudflare:', {
        filename,
        size: (imageBuffer.length / 1024 / 1024).toFixed(2) + 'MB',
        hasMetadata: !!metadata
      })

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          // 'Content-Type' will be set automatically by fetch for FormData
        },
        body: formData,
      });

      const responseData: CloudflareImageUploadResponse = await response.json();
      const validation = cloudflareImageUploadResponseSchema.safeParse(responseData);

      if (!validation.success) {
        console.error('Cloudflare API response validation error:', validation.error.issues);
        return { 
          success: false, 
          error: 'Invalid response structure from Cloudflare API.',
          originalResponse: responseData // include for debugging
        };
      }
      
      const validatedData = validation.data;

      if (validatedData.success && validatedData.result?.id) {
        console.log('✅ Buffer upload to Cloudflare successful:', {
          imageId: validatedData.result.id,
          filename
        })
        
        return {
          success: true,
          imageId: validatedData.result.id,
          variants: validatedData.result.variants,
          originalResponse: validatedData
        };
      } else {
        const errorMessage = validatedData.errors?.[0]?.message || 'Unknown error during Cloudflare upload.';
        console.error('Cloudflare buffer upload failed:', validatedData.errors);
        return { success: false, error: errorMessage, originalResponse: validatedData };
      }
    } catch (error: any) {
      console.error('Error uploading buffer to Cloudflare:', error);
      return { success: false, error: error.message || 'Network error or unexpected issue during Cloudflare upload.' };
    }
  }

  /**
   * Constructs the public URL for an image stored in Cloudflare Images.
   * @param imageId The ID of the image in Cloudflare.
   * @param variantName The name of the variant to use (e.g., 'public', 'thumbnail'). Defaults to 'public'.
   * @returns {string} The full public URL for the image variant.
   */
  getPublicUrl(imageId: string, variantName = 'public'): string {
    if (!this.accountHash || !this.imageDeliveryBaseUrl) {
        console.warn("CloudflareImagesService: accountHash or imageDeliveryBaseUrl is not set. URL might be incorrect.")
        // Return a non-functional or placeholder URL if critical parts are missing
        return `https://example.com/missing_config/${imageId}/${variantName}`; 
    }
    // Ensure imageDeliveryBaseUrl doesn't have its own scheme if it's just the domain
    const baseUrl = this.imageDeliveryBaseUrl.startsWith('http') 
        ? this.imageDeliveryBaseUrl 
        : `https://${this.imageDeliveryBaseUrl}`;

    return `${baseUrl}/${this.accountHash}/${imageId}/${variantName}`;
  }
} 