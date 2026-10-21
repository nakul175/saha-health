export type EffectiveAnaemiaProvider = { active: boolean; version: number; agreementRef: string; updatedAt: string; by: string };

export function effectiveAnaemiaProvider(
  state: { operations?: { anaemiaProvider?: EffectiveAnaemiaProvider } },
  runtime: Record<string, string | undefined>,
): EffectiveAnaemiaProvider {
  return state.operations?.anaemiaProvider ?? {
    active: runtime.SAHA_ANAEMIA_DEMO_BOOTSTRAP === 'true',
    version: runtime.SAHA_ANAEMIA_DEMO_BOOTSTRAP === 'true' ? 1 : 0,
    agreementRef: 'DEMO-SERVICE-AGREEMENT-v1',
    updatedAt: '',
    by: 'deployment-demo-configuration',
  };
}
