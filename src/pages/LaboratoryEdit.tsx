import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Button,
  Chip,
} from '@mui/material';
import { ArrowBack as BackIcon, Edit as EditIcon } from '@mui/icons-material';
import LabChat from '../components/LabChat';
import LabConfigForm from '../components/LabConfigForm';
import type { SimEmployee } from '../components/LabConfigForm';
import type { ChatMessageDisplay } from '../components/LabChat';
import {
  sendMessage as sendClaudeMessage,
  defaultPolicyConfig,
} from '../services/claudeService';
import type { PolicyConfig } from '../services/claudeService';
import { buildSystemPrompt } from '../config/laboratorySystemPrompt';
import { timeOffAdminService, timeOffClientService } from '../services/timeOffService';

const ALLOWANCE_START_TO_ACTIVITY_PERIOD: Record<string, string> = {
  JANUARY: 'JAN_DEC', FEBRUARY: 'FEB_JAN', MARCH: 'MAR_FEB', APRIL: 'APR_MAR',
  MAY: 'MAY_APR', JUNE: 'JUN_MAY', JULY: 'JUL_JUN', AUGUST: 'AUG_JUL',
  SEPTEMBER: 'SEP_AUG', OCTOBER: 'OCT_SEP', NOVEMBER: 'NOV_OCT', DECEMBER: 'DEC_NOV',
  HIRING_DATE: 'EMPLOYEE_ANNIVERSARY',
};

const ACTIVITY_PERIOD_TO_ALLOWANCE_START: Record<string, string> = {
  JAN_DEC: 'JANUARY', FEB_JAN: 'FEBRUARY', MAR_FEB: 'MARCH', APR_MAR: 'APRIL',
  MAY_APR: 'MAY', JUN_MAY: 'JUNE', JUL_JUN: 'JULY', AUG_JUL: 'AUGUST',
  SEP_AUG: 'SEPTEMBER', OCT_SEP: 'OCTOBER', NOV_OCT: 'NOVEMBER', DEC_NOV: 'DECEMBER',
  EMPLOYEE_ANNIVERSARY: 'HIRING_DATE',
};

const ACTIVITY_PERIOD_START_MONTH: Record<string, number> = {
  JAN_DEC: 0, FEB_JAN: 1, MAR_FEB: 2, APR_MAR: 3,
  MAY_APR: 4, JUN_MAY: 5, JUL_JUN: 6, AUG_JUL: 7,
  SEP_AUG: 8, OCT_SEP: 9, NOV_OCT: 10, DEC_NOV: 11,
};

const getCycleProgress = (activityPeriod: string, hiringDate: string | null): number => {
  const now = new Date();
  if (activityPeriod === 'EMPLOYEE_ANNIVERSARY' && hiringDate) {
    const hire = new Date(hiringDate);
    const lastAnniversary = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
    if (lastAnniversary > now) lastAnniversary.setFullYear(lastAnniversary.getFullYear() - 1);
    const nextAnniversary = new Date(lastAnniversary);
    nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
    return Math.min((now.getTime() - lastAnniversary.getTime()) / (nextAnniversary.getTime() - lastAnniversary.getTime()), 1);
  }
  const startMonth = ACTIVITY_PERIOD_START_MONTH[activityPeriod] ?? 0;
  const cycleStart = new Date(now.getFullYear(), startMonth, 1);
  if (cycleStart > now) cycleStart.setFullYear(cycleStart.getFullYear() - 1);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  return Math.min((now.getTime() - cycleStart.getTime()) / (cycleEnd.getTime() - cycleStart.getTime()), 1);
};

const getMonthsElapsedInCycle = (activityPeriod: string, hiringDate: string | null): number => {
  return Math.floor(getCycleProgress(activityPeriod, hiringDate) * 12);
};

interface EmployeeSimData {
  name: string;
  currentBalance: number;
  originalAllowance: number;
  hiringDate: string | null;
  workdays: number[];
  originalCountingMethod: string;
  amountRequested: number;
}

interface PolicyOption {
  id: number;
  name: string;
  policyTypeId: string;
}

const PERIOD_LABELS: Record<string, string> = {
  JAN_DEC: 'Enero - Diciembre', FEB_JAN: 'Febrero - Enero', MAR_FEB: 'Marzo - Febrero',
  APR_MAR: 'Abril - Marzo', MAY_APR: 'Mayo - Abril', JUN_MAY: 'Junio - Mayo',
  JUL_JUN: 'Julio - Junio', AUG_JUL: 'Agosto - Julio', SEP_AUG: 'Septiembre - Agosto',
  OCT_SEP: 'Octubre - Septiembre', NOV_OCT: 'Noviembre - Octubre', DEC_NOV: 'Diciembre - Noviembre',
  EMPLOYEE_ANNIVERSARY: 'Aniversario del empleado',
};

const LaboratoryEdit = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PolicyConfig>({ ...defaultPolicyConfig });
  const [messages, setMessages] = useState<ChatMessageDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);

  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | ''>('');
  const [existingPolicy, setExistingPolicy] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const apiMessagesRef = useRef<any[]>([]);

  // Fetch policies on mount
  useState(() => {
    (async () => {
      try {
        const resp = await timeOffAdminService.getPolicies({ page: 1, limit: 50 });
        const items: any[] = resp?.items || resp?.data || [];
        const opts: PolicyOption[] = items
          .filter((p: any) => p.id && p.name)
          .map((p: any) => ({ id: p.id, name: p.name, policyTypeId: String(p.policyType?.id || '') }));
        setPolicies(opts);
      } catch {
        setPolicies([]);
      } finally {
        setLoadingPolicies(false);
      }
    })();
  });

  const handlePolicySelect = useCallback(async (policyId: number) => {
    setSelectedPolicyId(policyId);
    setLoadingPolicy(true);
    apiMessagesRef.current = [];

    try {
      const policy = await timeOffAdminService.getPolicy(String(policyId));
      const activityPeriod = ALLOWANCE_START_TO_ACTIVITY_PERIOD[policy.allowanceStart] || policy.activityPeriod || 'JAN_DEC';
      const apiTiers: any[] = policy.yearsOfService || policy.seniorityTiers || policy.policyType?.yearsOfService || [];
      const seniorityTiers = apiTiers.map((t: any) => ({
        yearsOfService: t.years ?? t.yearsOfService ?? 0,
        extraDays: t.extraDays ?? t.additionalDays ?? 0,
      }));

      const policyConfig: PolicyConfig = {
        allowanceAmount: policy.allowanceAmount ?? 0,
        allowanceType: policy.allowanceType || 'BASIC_ANNUAL',
        activityPeriod,
        prorationFrequency: policy.allowanceProrationFrequency || policy.prorationFrequency || 'EVERY_TWELVE_MONTHS',
        accumulationMoment: policy.accumulationMoment || 'START_OF_CYCLE',
        countingMethod: policy.countingMethod || 'CALENDAR_DAYS',
        maximumRemnant: policy.maximumRemnant ?? null,
        remnantExpirationValue: policy.remnantExpirationValue ?? null,
        maximumBalance: policy.maximumBalance ?? null,
        minimumBalance: policy.minimumBalance ?? 0,
        minimumAdvanceDays: policy.minimumAdvanceDays ?? 0,
        allowHalfDayRequests: policy.allowHalfDayRequests ?? false,
        unit: policy.policyType?.unit || 'DAYS',
        seniorityEnabled: seniorityTiers.length > 0,
        seniorityTiers,
        seniorityLawCountry: policy.argentinianLawCompliance ? 'AR' : (policy.seniorityLawCountry || null),
        seniorityProportionalNewHires: policy.hiringApportionmentMethod === 'PROPORTIONAL' || policy.seniorityProportionalNewHires || false,
      };

      setConfig(policyConfig);
      setExistingPolicy(policy);

      // Load employees
      let emps: EmployeeSimData[] = [];
      try {
        const TERMS = ['a', 'e', 'i', 'o', 'u'];
        const allResults = await Promise.all(
          TERMS.map((t) =>
            timeOffClientService.getBalancesReport({ search: t, limit: 100 })
              .then((r: any) => r?.items || r?.data || [])
              .catch(() => [] as any[])
          )
        );
        const seen = new Set<number>();
        for (const items of allResults) {
          for (const b of items) {
            if (b.policy?.id !== policyId) continue;
            const uid = b.user?.id || b.userId;
            if (seen.has(uid)) continue;
            seen.add(uid);
            emps.push({
              name: [b.user?.firstName, b.user?.lastName].filter(Boolean).join(' '),
              currentBalance: b.currentBalance ?? b.balance ?? 0,
              originalAllowance: b.policy?.allowanceAmount ?? policy.allowanceAmount ?? 0,
              hiringDate: b.user?.hiringDate || null,
              workdays: Array.isArray(b.user?.workdays) ? b.user.workdays : [1, 2, 3, 4, 5],
              originalCountingMethod: b.policy?.countingMethod || policy.countingMethod || 'CALENDAR_DAYS',
              amountRequested: b.amountRequested ?? 0,
            });
          }
        }
      } catch { /* ignore */ }
      setEmployees(emps);

      const policyName = policy.name || `Política #${policyId}`;
      const periodLabel = PERIOD_LABELS[policyConfig.activityPeriod] || policyConfig.activityPeriod;
      setMessages([{
        role: 'assistant',
        content: `Estoy analizando la política "${policyName}" con ${emps.length} empleados asignados.\n\nConfiguración actual:\n• Prestación: ${policyConfig.allowanceAmount} ${policyConfig.unit === 'HOURS' ? 'horas' : 'días'} ${policyConfig.countingMethod === 'CALENDAR_DAYS' ? 'corridos' : 'hábiles'}\n• Acreditación: ${policyConfig.prorationFrequency === 'EVERY_ONE_MONTH' ? 'Mensual' : 'Anual'} al ${policyConfig.accumulationMoment === 'START_OF_CYCLE' ? 'inicio' : 'final'} del ciclo\n• Período: ${periodLabel}\n\n¿Qué cambio necesitás hacer en esta política?`,
      }]);
    } catch {
      setMessages([{ role: 'assistant', content: 'No pude cargar los detalles de la política. ¿Podés intentar de nuevo?' }]);
    } finally {
      setLoadingPolicy(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    apiMessagesRef.current.push({ role: 'user', content: text });

    try {
      const systemPrompt = buildSystemPrompt('edit', existingPolicy, employees);
      const response = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);

      if (response.configUpdate) {
        const updatedFields = Object.keys(response.configUpdate);
        setConfig((prev) => ({ ...prev, ...response.configUpdate! }));
        setHighlightedFields(updatedFields);
        setTimeout(() => setHighlightedFields([]), 2500);

        const assistantContent: any[] = [];
        if (response.text) assistantContent.push({ type: 'text', text: response.text });
        assistantContent.push({ type: 'tool_use', id: response.toolUseId, name: 'update_policy_config', input: response.configUpdate });
        apiMessagesRef.current.push({ role: 'assistant', content: assistantContent });
        apiMessagesRef.current.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: response.toolUseId, content: 'Configuración actualizada correctamente en el formulario.' }] });

        const followUp = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);
        const fullText = response.text ? response.text + (followUp.text ? '\n\n' + followUp.text : '') : followUp.text || '';
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
  }, [existingPolicy, employees]);

  const handleManualChange = useCallback((field: string, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleUpdatePolicy = useCallback(async () => {
    if (!selectedPolicyId) return;
    setIsCreating(true);
    try {
      const yearsOfService = (config.seniorityEnabled && config.seniorityTiers && config.seniorityTiers.length > 0)
        ? config.seniorityTiers.map((t) => ({ years: t.yearsOfService, yearsOfService: t.yearsOfService, extraDays: t.extraDays }))
        : [];

      const body: Record<string, unknown> = {
        name: existingPolicy?.name || 'Política editada',
        description: existingPolicy?.description || existingPolicy?.name || '',
        allowanceType: config.allowanceType,
        allowanceStart: ACTIVITY_PERIOD_TO_ALLOWANCE_START[config.activityPeriod] || 'JANUARY',
        countingMethod: config.countingMethod,
        attachmentRequirement: existingPolicy?.attachmentRequirement || 'NONE',
        allowHalfDayRequests: existingPolicy?.allowHalfDayRequests ?? false,
        noRetroactiveRequests: existingPolicy?.noRetroactiveRequests ?? false,
        allowanceAmount: config.allowanceType === 'BASIC_ANNUAL' ? config.allowanceAmount : 0,
        allowanceProrationFrequency: config.prorationFrequency || 'EVERY_TWELVE_MONTHS',
        accumulationMoment: config.accumulationMoment || 'START_OF_CYCLE',
        minimumBalance: config.minimumBalance ?? 0,
        maximumBalance: config.maximumBalance ?? 0,
        maximumRemnant: config.maximumRemnant ?? 0,
        minimumAdvanceDays: Math.max(config.minimumAdvanceDays ?? 0, 1),
        maximumAmountPerRequest: existingPolicy?.maximumAmountPerRequest ?? 0.5,
        minimumAmountPerRequest: existingPolicy?.minimumAmountPerRequest ?? 0.01,
        reminderDaysInterval: existingPolicy?.reminderDaysInterval ?? 1,
        balanceViewPrecision: existingPolicy?.balanceViewPrecision || 'DECIMALS',
        attachmentInstructions: existingPolicy?.attachmentInstructions || ' ',
        approvalUsers: (() => {
          const existing = existingPolicy?.approvalUsers;
          if (Array.isArray(existing) && existing.length > 0) {
            return existing.map((step: any) => {
              const clean: any = {};
              if (Array.isArray(step.userIds) && step.userIds.length > 0) clean.userIds = step.userIds;
              if (Array.isArray(step.relations) && step.relations.length > 0) clean.relations = step.relations;
              if (Array.isArray(step.itemIds) && step.itemIds.length > 0) clean.itemIds = step.itemIds;
              if (step.designatedReviewer === true) clean.designatedReviewer = true;
              if (Object.keys(clean).length === 0) clean.relations = ['BOSS'];
              return clean;
            });
          }
          return [{ relations: ['BOSS'] }];
        })(),
        yearsOfService,
        argentinianLawCompliance: config.seniorityLawCountry === 'AR',
        ...(config.remnantExpirationValue != null
          ? { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: config.remnantExpirationValue }
          : { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: 0 }),
      };

      await timeOffAdminService.updatePolicy(String(selectedPolicyId), body);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Política actualizada exitosamente. Los cambios fueron aplicados en la plataforma.' }]);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.message || err?.response?.data?.errors
        ? JSON.stringify(err?.response?.data?.errors || err?.response?.data?.message)
        : err?.message || 'Error desconocido';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error al actualizar la política: ${errorDetail}. Revisá la configuración e intentá nuevamente.` }]);
    } finally {
      setIsCreating(false);
    }
  }, [config, selectedPolicyId, existingPolicy]);

  // Simulation
  const simulatedEmployees: SimEmployee[] = useMemo(() => {
    if (employees.length === 0 || !('currentBalance' in (employees[0] || {}))) return [];
    return (employees as EmployeeSimData[]).map((emp) => {
      if (config.allowanceType === 'UNLIMITED') {
        return { name: emp.name, currentBalance: emp.currentBalance, simulatedBalance: '∞' as string, amountRequested: emp.amountRequested };
      }
      const newAllowance = config.allowanceAmount;
      const workdaysPerWeek = emp.workdays?.length || 5;
      const calendarToBusinessRatio = 7 / workdaysPerWeek;
      const consumed = Math.max(0, emp.originalAllowance - emp.currentBalance);
      const remnantFromPreviousCycles = Math.max(0, emp.currentBalance - emp.originalAllowance);
      let adjustedConsumed = consumed;
      if (emp.originalCountingMethod !== config.countingMethod) {
        if (emp.originalCountingMethod === 'BUSINESS_DAYS' && config.countingMethod === 'CALENDAR_DAYS') adjustedConsumed = consumed * calendarToBusinessRatio;
        else if (emp.originalCountingMethod === 'CALENDAR_DAYS' && config.countingMethod === 'BUSINESS_DAYS') adjustedConsumed = consumed / calendarToBusinessRatio;
      }
      const monthsElapsed = getMonthsElapsedInCycle(config.activityPeriod, emp.hiringDate);
      let accruedThisCycle = 0;
      if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS') {
        accruedThisCycle = config.accumulationMoment === 'START_OF_CYCLE' ? newAllowance : 0;
      } else {
        const monthlyNew = newAllowance / 12;
        const monthlyOld = emp.originalAllowance / 12;
        accruedThisCycle = Math.min(monthlyOld * monthsElapsed + monthlyNew * (12 - monthsElapsed), newAllowance);
      }
      let adjustedRemnant = remnantFromPreviousCycles;
      if (config.maximumRemnant !== null && config.maximumRemnant >= 0) adjustedRemnant = Math.min(adjustedRemnant, config.maximumRemnant);
      if (config.remnantExpirationValue !== null && config.remnantExpirationValue > 0 && monthsElapsed >= config.remnantExpirationValue) adjustedRemnant = 0;
      if (config.prorationFrequency === 'EVERY_ONE_MONTH' && config.maximumRemnant === 0) adjustedRemnant = 0;
      let simBalance: number;
      if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS' && config.accumulationMoment === 'END_OF_CYCLE') {
        const currentWithoutRemnant = Math.min(emp.currentBalance, emp.originalAllowance);
        simBalance = currentWithoutRemnant + (consumed - adjustedConsumed) + adjustedRemnant;
      } else {
        simBalance = accruedThisCycle + adjustedRemnant - adjustedConsumed;
      }
      if (config.minimumBalance < 0) simBalance = Math.max(simBalance, config.minimumBalance);
      else simBalance = Math.max(simBalance, 0);
      simBalance = Math.round(simBalance * 100) / 100;
      return { name: emp.name, currentBalance: emp.currentBalance, simulatedBalance: simBalance, amountRequested: emp.amountRequested };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [config, employees]);

  // Policy selector screen
  if (messages.length === 0) {
    return (
      <Box>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/laboratory')} variant="outlined" size="small">
            Volver
          </Button>
          <Typography variant="h1">Editar Política</Typography>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Seleccioná la política que querés editar.
        </Typography>

        {loadingPolicies ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ maxWidth: 400 }}>
            <TextField
              fullWidth size="small" select label="Política a editar"
              value={selectedPolicyId}
              onChange={(e) => handlePolicySelect(Number(e.target.value))}
              disabled={loadingPolicy}
            >
              {policies.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            {loadingPolicy && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Cargando política...</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // Split layout
  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/laboratory')} variant="outlined" size="small">
          Volver
        </Button>
        <Typography variant="h1">Editar Política</Typography>
        {existingPolicy && (
          <Chip
            icon={<EditIcon sx={{ fontSize: 16 }} />}
            label={existingPolicy.name || `Política #${selectedPolicyId}`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.85rem' }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <LabChat messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} mode="edit" />
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
                simulatedEmployees={simulatedEmployees}
                mode="edit"
                onUpdatePolicy={handleUpdatePolicy}
                isCreating={isCreating}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LaboratoryEdit;
