/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY3  });

export interface ExtractedBooking {
  requesterName: string;
  truckReference: string;
  truckCount:number
  driverName: string;
  driverPhone: string;
  licensePlate: string;
  suggestedDate: string; // ISO
  suggestedTime: string; // HH:mm
}
console.log(process.env.GEMINI_API_KEY3)
export async function extractPlanningFromText(text: string): Promise<ExtractedBooking[]> {
  if (!process.env.GEMINI_API_KEY3) {
    throw new Error("GEMINI_API_KEY3 is not configured");
  }
alert(process.env.GEMINI_API_KEY3)
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: `Extract dock booking information from the following text: "${text}". 
    If multiple bookings are present, extract all of them. 
    Dates  be in YYYY-MM-DD format. Times in HH:mm format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            requesterName: { type: Type.STRING },
            truckCount: { type: Type.NUMBER },
            truckReference: { type: Type.STRING },
            driverName: { type: Type.STRING },
            driverPhone: { type: Type.STRING },
            licensePlate: { type: Type.STRING },
            suggestedDate: { type: Type.STRING },
            suggestedTime: { type: Type.STRING },
          },
          required: ["requesterName", "truckReference", "suggestedDate", "suggestedTime", "truckCount"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}
