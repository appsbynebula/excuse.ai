import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
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
    console.warn("No API Key provided.");
    throw new Error("API Key missing. Cannot generate evidence.");
  }

  try {
    // 1. Refine the prompt - Aggressive realism engineering
    const styleModifiers = "captured on smartphone camera, flash photography, hyper-realistic, 4k, unedited, grainy, low light, messy, candid";
    const negativePrompt = "cartoon, illustration, 3d render, painting, drawing, artistic, perfect lighting, studio, bokeh, blurry foreground, fake, cgi";

    // Explicit instruction for object presence
    const fullPrompt = `Generate a photorealistic image of: "${excuse}". ${styleModifiers}. The image MUST contain the specific objects mentioned in the description (e.g. if 'thermometer', show a thermometer). It should look like a hasty photo taken by a regular person to prove an excuse. NOT ARTISTIC. Context: ${negativePrompt}.`;

    const parts: any[] = [{ text: fullPrompt }];

    // 2. Add reference image if provided
    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
    }

    // 3. Generate Image using Imagen model if available or Flash
    // Note: Use 'gemini-1.5-flash' or similar if it supports image generation, 
    // otherwise this relies on the specific model capability.
    // Assuming 'gemini-2.0-flash-exp' or similar might be available. 
    // If the user provided a specific model, we stick to it, otherwise default.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Keeping user's model preference, assuming it's valid
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
    throw error; // Propagate error instead of mocking with random images
  }
};