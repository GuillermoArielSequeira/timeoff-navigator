import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import LabChat from '../components/LabChat';
import LabConfigForm from '../components/LabConfigForm';
import type { ChatMessageDisplay } from '../components/LabChat';
import {
  sendMessage as sendClaudeMessage,
  defaultPolicyConfig,
} from '../services/claudeService';
import type { PolicyConfig } from '../services/claudeService';
import { buildSystemPrompt } from '../config/laboratorySystemPrompt';
import { timeOffAdminService } from '../services/timeOffService';

// Reverse mapping: internal activityPeriod → API allowanceStart
const ACTIVITY_PERIOD_TO_ALLOWANCE_START: Record<string, string> = {
  JAN_DEC: 'JANUARY', FEB_JAN: 'FEBRUARY', MAR_FEB: 'MARCH', APR_MAR: 'APRIL',
  MAY_APR: 'MAY', JUN_MAY: 'JUNE', JUL_JUN: 'JULY', AUG_JUL: 'AUGUST',
  SEP_AUG: 'SEPTEMBER', OCT_SEP: 'OCTOBER', NOV_OCT: 'NOVEMBER', DEC_NOV: 'DECEMBER',
  EMPLOYEE_ANNIVERSARY: 'HIRING_DATE',
};

const LaboratoryCreate = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PolicyConfig>({ ...defaultPolicyConfig });
  const [messages, setMessages] = useState<ChatMessageDisplay[]>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy tu copiloto de configuración de políticas.\n\nTe voy a guiar paso a paso para crear una nueva política de tiempo libre.\n\n¿Qué tipo de política querés crear? ¿Es para vacaciones o para otro tipo de licencia/permiso? Si es para un país específico, indicámelo.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [policyTypes, setPolicyTypes] = useState<{ id: number; name: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const apiMessagesRef = useRef<any[]>([]);

  // Fetch policy types on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await timeOffAdminService.getPolicyTypes();
        const items: any[] = resp?.items || resp?.data || resp || [];
        const types = items
          .filter((pt: any) => pt.id && pt.name)
          .map((pt: any) => ({ id: pt.id, name: pt.name }));
        setPolicyTypes(types);
      } catch (err) {
        console.error('Error fetching policy types:', err);
      }
    })();
  }, []);

  // Send message to Claude
  const handleSendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    apiMessagesRef.current.push({ role: 'user', content: text });

    try {
      const systemPrompt = buildSystemPrompt('create');
      const response = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);

      if (response.configUpdate) {
        const updatedFields = Object.keys(response.configUpdate);
        setConfig((prev) => ({ ...prev, ...response.configUpdate! }));
        setHighlightedFields(updatedFields);
        setTimeout(() => setHighlightedFields([]), 2500);

        const assistantContent: any[] = [];
        if (response.text) assistantContent.push({ type: 'text', text: response.text });
        assistantContent.push({
          type: 'tool_use',
          id: response.toolUseId,
          name: 'update_policy_config',
          input: response.configUpdate,
        });
        apiMessagesRef.current.push({ role: 'assistant', content: assistantContent });
        apiMessagesRef.current.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: response.toolUseId, content: 'Configuración actualizada correctamente en el formulario.' }],
        });

        const followUp = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);
        const fullText = response.text
          ? response.text + (followUp.text ? '\n\n' + followUp.text : '')
          : followUp.text || '';

        if (fullText) {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
          apiMessagesRef.current.push({ role: 'assistant', content: followUp.text || '' });
        }

        if (followUp.configUpdate) {
          setConfig((prev) => ({ ...prev, ...followUp.configUpdate! }));
          setHighlightedFields((prev) => [...prev, ...Object.keys(followUp.configUpdate!)]);
          setTimeout(() => setHighlightedFields([]), 2500);
        }
      } else {
        if (response.text) {
          setMessages((prev) => [...prev, { role: 'assistant', content: response.text }]);
          apiMessagesRef.current.push({ role: 'assistant', content: response.text });
        }
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error al comunicarse con el copiloto: ${err.message || 'Error desconocido'}` }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleManualChange = useCallback((field: string, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreatePolicy = useCallback(async (policyName: string, policyTypeId: number) => {
    setIsCreating(true);
    try {
      const yearsOfService = (config.seniorityEnabled && config.seniorityTiers && config.seniorityTiers.length > 0)
        ? config.seniorityTiers.map((t) => ({ years: t.yearsOfService, yearsOfService: t.yearsOfService, extraDays: t.extraDays }))
        : [];

      const body: Record<string, unknown> = {
        policyTypeId,
        name: policyName,
        description: policyName,
        allowanceType: config.allowanceType,
        allowanceStart: ACTIVITY_PERIOD_TO_ALLOWANCE_START[config.activityPeriod] || 'JANUARY',
        countingMethod: config.countingMethod,
        attachmentRequirement: 'NONE',
        allowHalfDayRequests: false,
        noRetroactiveRequests: false,
        allowanceAmount: config.allowanceType === 'BASIC_ANNUAL' ? config.allowanceAmount : 0,
        allowanceProrationFrequency: config.prorationFrequency || 'EVERY_TWELVE_MONTHS',
        accumulationMoment: config.accumulationMoment || 'START_OF_CYCLE',
        minimumBalance: config.minimumBalance ?? 0,
        maximumBalance: config.maximumBalance ?? 0,
        maximumRemnant: config.maximumRemnant ?? 0,
        minimumAdvanceDays: Math.max(config.minimumAdvanceDays ?? 0, 1),
        maximumAmountPerRequest: 0.5,
        minimumAmountPerRequest: 0.01,
        reminderDaysInterval: 1,
        balanceViewPrecision: 'DECIMALS',
        attachmentInstructions: ' ',
        approvalUsers: [{ relations: ['BOSS'] }],
        yearsOfService,
        argentinianLawCompliance: config.seniorityLawCountry === 'AR',
        ...(config.remnantExpirationValue != null
          ? { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: config.remnantExpirationValue }
          : { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: 0 }),
      };

      await timeOffAdminService.createPolicy(body);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Política "${policyName}" creada exitosamente. Ya está disponible para asignar empleados.` }]);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.message || err?.message || 'Error desconocido';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error al crear la política: ${errorDetail}. Revisá la configuración e intentá nuevamente.` }]);
    } finally {
      setIsCreating(false);
    }
  }, [config]);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/laboratory')}
          variant="outlined"
          size="small"
        >
          Volver
        </Button>
        <Typography variant="h1">
          Crear Política
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <LabChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                mode="create"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <LabConfigForm
                config={config}
                highlightedFields={highlightedFields}
                onManualChange={handleManualChange}
                mode="create"
                policyTypes={policyTypes}
                onCreatePolicy={handleCreatePolicy}
                isCreating={isCreating}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LaboratoryCreate;
