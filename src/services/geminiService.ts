/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY3 });

export interface ExtractedBooking {
  requesterName: string;
  truckReference: string;
  truckCount: number;
  driverName: string;
  driverPhone: string;
  licensePlate: string;
  suggestedDate: string; // YYYY-MM-DD
  suggestedTime: string; // HH:mm
}

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      requesterName:  { type: Type.STRING },
      truckCount:     { type: Type.NUMBER },
      truckReference: { type: Type.STRING },
      driverName:     { type: Type.STRING },
      driverPhone:    { type: Type.STRING },
      licensePlate:   { type: Type.STRING },
      suggestedDate:  { type: Type.STRING },
      suggestedTime:  { type: Type.STRING },
    },
    required: ["requesterName", "truckReference", "suggestedDate", "suggestedTime", "truckCount"],
  },
};

const BASE_PROMPT =
  "Extract dock booking information. If multiple bookings are present, extract all of them. " +
  "Dates must be in YYYY-MM-DD format. Times in HH:mm format. " +
  "For truckCount, use the number of trucks/units mentioned per booking line (default 1).";

function assertKey(): void {
  if (!process.env.GEMINI_API_KEY3) {
    throw new Error("GEMINI_API_KEY3 is not configured");
  }
}

function parseGeminiJson(text: string | null | undefined): ExtractedBooking[] {
  try {
    return JSON.parse(text || "[]");
  } catch {
    return [];
  }
}

// ── Extract from plain text ───────────────────────────────────────────────────
export async function extractPlanningFromText(text: string): Promise<ExtractedBooking[]> {
  assertKey();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `${BASE_PROMPT}\n\nSource text:\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });
  return parseGeminiJson(response.text);
}

// ── Extract from uploaded File ────────────────────────────────────────────────
export async function extractPlanningFromFile(file: File): Promise<ExtractedBooking[]> {
  assertKey();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  // ── Excel ──────────────────────────────────────────────────────────────────
  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    const csvText = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`;
    }).join("\n\n");
    return extractPlanningFromText(csvText);
  }

  // ── CSV / TXT ──────────────────────────────────────────────────────────────
  if (ext === "csv" || ext === "txt" || file.type.startsWith("text/")) {
    const text = await file.text();
    return extractPlanningFromText(text);
  }

  // ── PDF / Image  →  Gemini multimodal inline data ──────────────────────────
  if (ext === "pdf" || file.type.startsWith("image/")) {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ""),
    );
    const mimeType = file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg");

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { inlineData: { mimeType, data: base64 } },
        { text: `${BASE_PROMPT}\n\nFile: ${file.name}` },
      ] as any,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
    return parseGeminiJson(response.text);
  }

  throw new Error(
    `Unsupported file type ".${ext}". Please upload Excel (.xlsx/.xls), CSV, TXT, PDF, or an image.`,
  );
}
