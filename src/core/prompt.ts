import Handlebars from "handlebars";

export class PromptTemplate {
  private template: HandlebarsTemplateDelegate;
  private templateStr: string;

  constructor(template: string) {
    this.templateStr = template;
    this.template = Handlebars.compile(template);
  }

  render(variables: Record<string, unknown>): string {
    return this.template(variables);
  }

  static render(template: string, variables: Record<string, unknown>): string {
    return new PromptTemplate(template).render(variables);
  }

  static fromFile(content: string): PromptTemplate {
    return new PromptTemplate(content);
  }

  getVariables(): string[] {
    const matches = this.templateStr.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  }
}
