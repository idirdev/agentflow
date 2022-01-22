import { z } from "zod";

export class OutputParser {
  static json<T>(output: string, schema?: z.ZodSchema<T>): T {
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in output");
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    if (schema) return schema.parse(parsed);
    return parsed as T;
  }

  static list(output: string): string[] {
    return output.split("\n").map((line) => line.replace(/^[-*\d.)\s]+/, "").trim()).filter((line) => line.length > 0);
  }

  static table(output: string): Record<string, string>[] {
    const lines = output.trim().split("\n").filter((l) => !l.match(/^[-|]+$/));
    if (lines.length < 2) return [];
    const headers = lines[0].split("|").map((h) => h.trim()).filter(Boolean);
    return lines.slice(1).map((row) => {
      const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => { obj[header] = cells[i] || ""; });
      return obj;
    });
  }

  static extractCodeBlock(output: string, language?: string): string | null {
    const pattern = language ? new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\\s*\`\`\``) : /```(?:\w+)?\s*([\s\S]*?)\s*```/;
    const match = output.match(pattern);
    return match ? match[1].trim() : null;
  }
}
