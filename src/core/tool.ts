import { ToolDefinition, ParameterDef } from "../types.js";

export class Tool {
  static create(config: {
    name: string;
    description: string;
    parameters: Record<string, ParameterDef>;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
  }): ToolDefinition {
    return {
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      handler: async (args) => {
        const validated = Tool.validateArgs(args, config.parameters);
        return config.handler(validated);
      },
    };
  }

  private static validateArgs(args: Record<string, unknown>, params: Record<string, ParameterDef>): Record<string, unknown> {
    const validated: Record<string, unknown> = {};
    for (const [key, param] of Object.entries(params)) {
      const value = args[key] ?? param.default;
      if (param.required && value === undefined) throw new Error(`Missing required parameter: ${key}`);
      if (value !== undefined) validated[key] = value;
    }
    return validated;
  }

  static toOpenAIFormat(tool: ToolDefinition) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, param] of Object.entries(tool.parameters)) {
      properties[key] = { type: param.type, description: param.description };
      if (param.required) required.push(key);
    }
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: { type: "object", properties, required },
      },
    };
  }
}
