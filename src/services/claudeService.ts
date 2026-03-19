/**
 * Claude API Service — direct browser fetch to Anthropic Messages API
 * Uses tool_use to extract structured policy configuration from conversations
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SeniorityTier {
  yearsOfService: number;
  extraDays: number;
}

export interface PolicyConfig {
  allowanceAmount: number;
  allowanceType: 'BASIC_ANNUAL' | 'UNLIMITED';
  activityPeriod: string;
  prorationFrequency: 'EVERY_TWELVE_MONTHS' | 'EVERY_ONE_MONTH';
  accumulationMoment: 'START_OF_CYCLE' | 'END_OF_CYCLE';
  countingMethod: 'BUSINESS_DAYS' | 'CALENDAR_DAYS';
  maximumRemnant: number | null;
  remnantExpirationValue: number | null;
  maximumBalance: number | null;
  minimumBalance: number;
  minimumAdvanceDays: number;
  allowHalfDayRequests: boolean;
  unit: 'DAYS' | 'HOURS';
  seniorityEnabled: boolean;
  seniorityTiers: SeniorityTier[];
  seniorityLawCountry: string | null;
  seniorityProportionalNewHires: boolean;
}

export const defaultPolicyConfig: PolicyConfig = {
  allowanceAmount: 0,
  allowanceType: 'BASIC_ANNUAL',
  activityPeriod: 'JAN_DEC',
  prorationFrequency: 'EVERY_TWELVE_MONTHS',
  accumulationMoment: 'START_OF_CYCLE',
  countingMethod: 'CALENDAR_DAYS',
  maximumRemnant: null,
  remnantExpirationValue: null,
  maximumBalance: null,
  minimumBalance: 0,
  minimumAdvanceDays: 0,
  allowHalfDayRequests: false,
  unit: 'DAYS',
  seniorityEnabled: false,
  seniorityTiers: [],
  seniorityLawCountry: null,
  seniorityProportionalNewHires: false,
};

// Tool definition for Claude to update policy config
const UPDATE_POLICY_CONFIG_TOOL = {
  name: 'update_policy_config',
  description:
    'Actualiza los campos de configuración de la política en el formulario. Llamá a esta herramienta cada vez que tengas información suficiente para setear o cambiar uno o más campos. Solo incluí los campos que estés seguro de configurar.',
  input_schema: {
    type: 'object' as const,
    properties: {
      allowanceAmount: {
        type: 'number',
        description: 'Cantidad de días u horas de prestación base por ciclo',
      },
      allowanceType: {
        type: 'string',
        enum: ['BASIC_ANNUAL', 'UNLIMITED'],
        description: 'Tipo de prestación: BASIC_ANNUAL (con límite) o UNLIMITED (ilimitada)',
      },
      activityPeriod: {
        type: 'string',
        enum: [
          'JAN_DEC', 'FEB_JAN', 'MAR_FEB', 'APR_MAR', 'MAY_APR',
          'JUN_MAY', 'JUL_JUN', 'AUG_JUL', 'SEP_AUG', 'OCT_SEP',
          'NOV_OCT', 'DEC_NOV', 'EMPLOYEE_ANNIVERSARY',
        ],
        description: 'Período de actividad del ciclo. EMPLOYEE_ANNIVERSARY = aniversario de contratación',
      },
      prorationFrequency: {
        type: 'string',
        enum: ['EVERY_TWELVE_MONTHS', 'EVERY_ONE_MONTH'],
        description: 'Frecuencia de acreditación: anual o mensual',
      },
      accumulationMoment: {
        type: 'string',
        enum: ['START_OF_CYCLE', 'END_OF_CYCLE'],
        description: 'Momento de acreditación: inicio o final del ciclo/mes',
      },
      countingMethod: {
        type: 'string',
        enum: ['BUSINESS_DAYS', 'CALENDAR_DAYS'],
        description: 'Método de conteo: días hábiles o corridos',
      },
      maximumRemnant: {
        type: ['number', 'null'] as unknown as 'number',
        description: 'Máximo de días que se pueden acumular (carry-over). null = sin límite',
      },
      remnantExpirationValue: {
        type: ['number', 'null'] as unknown as 'number',
        description: 'Meses hasta que expira el remanente. null = no expira',
      },
      minimumBalance: {
        type: 'number',
        description: 'Saldo mínimo permitido. Negativo = permite adelanto de días',
      },
      minimumAdvanceDays: {
        type: 'number',
        description: 'Días mínimos de anticipación para solicitar',
      },
      maximumBalance: {
        type: ['number', 'null'] as unknown as 'number',
        description: 'Saldo máximo permitido al final del ciclo. null = sin límite. Cuando el usuario pide "establecer el saldo máximo al final del ciclo" o "saldo máximo" se refiere a este campo.',
      },
      unit: {
        type: 'string',
        enum: ['DAYS', 'HOURS'],
        description: 'Unidad de medida: días u horas',
      },
      seniorityEnabled: {
        type: 'boolean',
        description: 'Activar/desactivar aumento de prestación por años de servicio (antigüedad)',
      },
      seniorityTiers: {
        type: 'array',
        description: 'Tramos de antigüedad. Cada tramo tiene yearsOfService (años) y extraDays (días extras). Ejemplo: [{yearsOfService: 5, extraDays: 7}, {yearsOfService: 10, extraDays: 7}]',
        items: {
          type: 'object',
          properties: {
            yearsOfService: { type: 'number', description: 'Años de servicio del tramo' },
            extraDays: { type: 'number', description: 'Días extras que se otorgan en este tramo' },
          },
        },
      },
      seniorityLawCountry: {
        type: ['string', 'null'] as unknown as 'string',
        description: 'País cuya ley de antigüedad aplicar. "AR" para Argentina (calcula antigüedad al 31 de diciembre). null = sin ley especial.',
      },
      seniorityProportionalNewHires: {
        type: 'boolean',
        description: 'Aplicar días proporcionales para nuevos ingresos menores a un año (ley Argentina)',
      },
    },
    required: [],
  },
};

export interface ClaudeResponse {
  text: string;
  configUpdate: Partial<PolicyConfig & { seniorityTiers?: SeniorityTier[] }> | null;
  toolUseId: string | null;
}

/**
 * Send a message to Claude and get a response with optional policy config updates
 */
export async function sendMessage(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<ClaudeResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      text: '⚠️ No se encontró la API key de Anthropic. Agregá VITE_ANTHROPIC_API_KEY en el archivo .env para habilitar el copiloto.',
      configUpdate: null,
      toolUseId: null,
    };
  }

  // Convert messages to Claude API format
  const apiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      tools: [UPDATE_POLICY_CONFIG_TOOL],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json();
  return parseResponse(data);
}

/**
 * Parse Claude API response to extract text and config updates
 */
function parseResponse(data: any): ClaudeResponse {
  let text = '';
  let configUpdate: Partial<PolicyConfig> | null = null;
  let toolUseId: string | null = null;

  const content: any[] = data.content || [];

  for (const block of content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use' && block.name === 'update_policy_config') {
      configUpdate = block.input as Partial<PolicyConfig>;
      toolUseId = block.id;
    }
  }

  return { text, configUpdate, toolUseId };
}

/**
 * Build a tool_result message to acknowledge the config update
 */
export function buildToolResultMessage(toolUseId: string): {
  role: 'user';
  content: Array<{ type: 'tool_result'; tool_use_id: string; content: string }>;
} {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: 'Configuración actualizada correctamente en el formulario.',
      },
    ],
  };
}
