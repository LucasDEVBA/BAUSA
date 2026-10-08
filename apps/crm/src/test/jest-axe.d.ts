/**
 * Tipos do jest-axe, que não publica .d.ts.
 *
 * Por que não @types/jest-axe: ele arrasta @types/jest (globais do Jest no
 * programa TS inteiro do Next) e um axe-core 3.x defasado. Por que não importar
 * os tipos do próprio axe-core: no pnpm ele só fica resolvível como dependência
 * direta, e declará-lo muda a versão usada pelo eslint-plugin-jsx-a11y no
 * lockfile. Cobre só a superfície que os testes usam — amplie quando precisar.
 */
declare module "jest-axe" {
  export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

  export interface AxeNodeResult {
    html: string;
    target: unknown[];
    failureSummary?: string;
  }

  export interface AxeRuleResult {
    id: string;
    impact?: AxeImpact | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: AxeNodeResult[];
  }

  export interface AxeResults {
    violations: AxeRuleResult[];
    passes: AxeRuleResult[];
    incomplete: AxeRuleResult[];
    inapplicable: AxeRuleResult[];
  }

  /** Opções do runner do axe-core (`axe.run`) mais o filtro de impacto do jest-axe. */
  export interface AxeRunOptions {
    rules?: Record<string, { enabled: boolean }>;
    runOnly?: string | string[] | { type: "rule" | "rules" | "tag" | "tags"; values: string[] };
    impactLevels?: AxeImpact[];
  }

  export interface JestAxeConfigureOptions extends AxeRunOptions {
    /** Repassado ao `axe.configure` (configuração global do axe-core). */
    globalOptions?: Record<string, unknown>;
  }

  export type JestAxe = (html: Element | string, options?: AxeRunOptions) => Promise<AxeResults>;

  export const axe: JestAxe;
  export function configureAxe(options?: JestAxeConfigureOptions): JestAxe;
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): {
      pass: boolean;
      message(): string;
      actual: AxeRuleResult[];
    };
  };
}
