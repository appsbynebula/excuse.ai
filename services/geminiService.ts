import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Generates visual evidence for an excuse.
 * Supports optional reference image for Image-to-Image generation.
 * 
 * @param excuse The text description of the excuse
 * @param referenceImageBase64 Optional base64 string of a reference image to maintain realism
 */
export const generateEvidence = async (excuse: string, referenceImageBase64?: string | null): Promise<string> => {
  if (!ai) {
    console.warn("No API Key provided. Returning mock image.");
    return mockGeneration(excuse);
  }

  try {
    // 1. Refine the prompt - Aggressive realism engineering
    // We emphasize "snapshot" aesthetics and explicitly forbid artistic styles.
    const styleModifiers = "captured on iPhone 14, flash enabled, harsh lighting, digital noise, motion blur, unedited raw photo, messy environment, candid shot, low quality jpeg, 4k textures, hyper-realistic";
    const negativePrompt = "cartoon, illustration, 3d render, painting, drawing, artistic, perfect lighting, studio, bokeh, blurry foreground";
    
    const fullPrompt = `Create a realistic photo evidence for: "${excuse}". ${styleModifiers}. The image must look exactly like a photo taken by a panicked person with a phone. It should NOT look like art. Context: ${negativePrompt}.`;

    const parts: any[] = [{ text: fullPrompt }];

    // 2. Add reference image if provided
    if (referenceImageBase64) {
      // Remove data URL prefix if present for the API call
      const base64Data = referenceImageBase64.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg', // Assuming jpeg/png for simplicity
          data: base64Data
        }
      });
    }

    // 3. Generate Image
    // Use gemini-2.5-flash-image for standard image tasks (multimodal supported)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
    });

    // 4. Extract Image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }

    throw new Error("No image data received from Gemini.");

  } catch (error) {
    console.error("Gemini Generation Failed:", error);
    return mockGeneration(excuse);
  }
};

const mockGeneration = async (excuse: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 2500));
  const seed = excuse.length;
  return `https://picsum.photos/seed/${seed}/800/1200?grayscale&blur=2`;
};