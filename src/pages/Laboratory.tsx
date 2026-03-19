import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { Add as CreateIcon, Edit as EditIcon } from '@mui/icons-material';
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

// Map API's allowanceStart (month name) → internal activityPeriod code
const ALLOWANCE_START_TO_ACTIVITY_PERIOD: Record<string, string> = {
  JANUARY: 'JAN_DEC',
  FEBRUARY: 'FEB_JAN',
  MARCH: 'MAR_FEB',
  APRIL: 'APR_MAR',
  MAY: 'MAY_APR',
  JUNE: 'JUN_MAY',
  JULY: 'JUL_JUN',
  AUGUST: 'AUG_JUL',
  SEPTEMBER: 'SEP_AUG',
  OCTOBER: 'OCT_SEP',
  NOVEMBER: 'NOV_OCT',
  DECEMBER: 'DEC_NOV',
  HIRING_DATE: 'EMPLOYEE_ANNIVERSARY',
};

// Simulation helpers (from Sandbox.tsx)
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
    const totalMs = nextAnniversary.getTime() - lastAnniversary.getTime();
    const elapsedMs = now.getTime() - lastAnniversary.getTime();
    return Math.min(elapsedMs / totalMs, 1);
  }
  const startMonth = ACTIVITY_PERIOD_START_MONTH[activityPeriod] ?? 0;
  const cycleStart = new Date(now.getFullYear(), startMonth, 1);
  if (cycleStart > now) cycleStart.setFullYear(cycleStart.getFullYear() - 1);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  const totalMs = cycleEnd.getTime() - cycleStart.getTime();
  const elapsedMs = now.getTime() - cycleStart.getTime();
  return Math.min(elapsedMs / totalMs, 1);
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

type Mode = 'select' | 'create' | 'edit';

interface PolicyOption {
  id: number;
  name: string;
  policyTypeId: string;
}

const Laboratory = () => {
  const [mode, setMode] = useState<Mode>('select');
  const [config, setConfig] = useState<PolicyConfig>({ ...defaultPolicyConfig });
  const [messages, setMessages] = useState<ChatMessageDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);

  // Edit mode state
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | ''>('');
  const [existingPolicy, setExistingPolicy] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  // Create mode state
  const [policyTypes, setPolicyTypes] = useState<{ id: number; name: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Conversation history for Claude API (includes tool_result messages)
  const apiMessagesRef = useRef<any[]>([]);

  // Handle mode selection
  const handleSelectCreate = useCallback(async () => {
    setMode('create');
    setConfig({ ...defaultPolicyConfig });
    apiMessagesRef.current = [];

    const initialMsg: ChatMessageDisplay = {
      role: 'assistant',
      content:
        '¡Hola! Soy tu copiloto de configuración de políticas. 🚀\n\nTe voy a guiar paso a paso para crear una nueva política de tiempo libre.\n\n¿Qué tipo de política querés crear? ¿Es para vacaciones o para otro tipo de licencia/permiso? Si es para un país específico, indicámelo.',
    };
    setMessages([initialMsg]);

    // Fetch policy types for the create dropdown
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
  }, []);

  const handleSelectEdit = useCallback(async () => {
    setMode('edit');
    setLoadingPolicies(true);
    apiMessagesRef.current = [];
    setMessages([]);

    try {
      const resp = await timeOffAdminService.getPolicies({ page: 1, limit: 50 });
      const items: any[] = resp?.items || resp?.data || [];
      const opts: PolicyOption[] = items
        .filter((p: any) => p.id && p.name)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          policyTypeId: String(p.policyType?.id || ''),
        }));
      setPolicies(opts);
    } catch {
      setPolicies([]);
    } finally {
      setLoadingPolicies(false);
    }
  }, []);

  // Load policy details when selected in edit mode
  const handlePolicySelect = useCallback(async (policyId: number) => {
    setSelectedPolicyId(policyId);
    setLoadingPolicy(true);

    try {
      const policy = await timeOffAdminService.getPolicy(policyId);

      // Extract config from policy response — map allowanceStart → activityPeriod
      const activityPeriod = ALLOWANCE_START_TO_ACTIVITY_PERIOD[policy.allowanceStart] || policy.activityPeriod || 'JAN_DEC';
      // Map seniority tiers from API (field is "yearsOfService" in the API response)
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

      // Load employees for this policy (with simulation data)
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
      } catch {
        /* ignore */
      }
      setEmployees(emps);

      const policyName = policy.name || `Política #${policyId}`;
      const PERIOD_LABELS: Record<string, string> = {
        JAN_DEC: 'Enero - Diciembre', FEB_JAN: 'Febrero - Enero', MAR_FEB: 'Marzo - Febrero',
        APR_MAR: 'Abril - Marzo', MAY_APR: 'Mayo - Abril', JUN_MAY: 'Junio - Mayo',
        JUL_JUN: 'Julio - Junio', AUG_JUL: 'Agosto - Julio', SEP_AUG: 'Septiembre - Agosto',
        OCT_SEP: 'Octubre - Septiembre', NOV_OCT: 'Noviembre - Octubre', DEC_NOV: 'Diciembre - Noviembre',
        EMPLOYEE_ANNIVERSARY: 'Aniversario del empleado',
      };
      const periodLabel = PERIOD_LABELS[policyConfig.activityPeriod] || policyConfig.activityPeriod;
      const initialMsg: ChatMessageDisplay = {
        role: 'assistant',
        content: `Estoy analizando la política **"${policyName}"** con ${emps.length} empleados asignados.\n\nConfiguración actual:\n• Prestación: ${policyConfig.allowanceAmount} ${policyConfig.unit === 'HOURS' ? 'horas' : 'días'} ${policyConfig.countingMethod === 'CALENDAR_DAYS' ? 'corridos' : 'hábiles'}\n• Acreditación: ${policyConfig.prorationFrequency === 'EVERY_ONE_MONTH' ? 'Mensual' : 'Anual'} al ${policyConfig.accumulationMoment === 'START_OF_CYCLE' ? 'inicio' : 'final'} del ciclo\n• Período: ${periodLabel}\n\n¿Qué cambio necesitás hacer en esta política?`,
      };
      setMessages([initialMsg]);
    } catch (err) {
      setMessages([
        {
          role: 'assistant',
          content: 'No pude cargar los detalles de la política. ¿Podés intentar de nuevo?',
        },
      ]);
    } finally {
      setLoadingPolicy(false);
    }
  }, []);

  // Send message to Claude
  const handleSendMessage = useCallback(
    async (text: string) => {
      // Add user message to display
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setIsLoading(true);

      // Add to API messages
      apiMessagesRef.current.push({ role: 'user', content: text });

      try {
        const currentMode = mode === 'edit' ? 'edit' : 'create';
        const systemPrompt = buildSystemPrompt(
          currentMode,
          currentMode === 'edit' ? existingPolicy : undefined,
          currentMode === 'edit' ? employees : undefined,
        );

        const response = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);

        // Handle tool_use: update config and send tool_result
        if (response.configUpdate) {
          const updatedFields = Object.keys(response.configUpdate);
          setConfig((prev) => ({ ...prev, ...response.configUpdate! }));

          // Highlight animation
          setHighlightedFields(updatedFields);
          setTimeout(() => setHighlightedFields([]), 2500);

          // Add assistant response with tool_use to API messages
          const assistantContent: any[] = [];
          if (response.text) {
            assistantContent.push({ type: 'text', text: response.text });
          }
          assistantContent.push({
            type: 'tool_use',
            id: response.toolUseId,
            name: 'update_policy_config',
            input: response.configUpdate,
          });
          apiMessagesRef.current.push({ role: 'assistant', content: assistantContent });

          // Send tool_result
          apiMessagesRef.current.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: response.toolUseId,
                content: 'Configuración actualizada correctamente en el formulario.',
              },
            ],
          });

          // Get follow-up response after tool_result
          const followUp = await sendClaudeMessage(apiMessagesRef.current, systemPrompt);

          const fullText = response.text
            ? response.text + (followUp.text ? '\n\n' + followUp.text : '')
            : followUp.text || '';

          if (fullText) {
            setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
            apiMessagesRef.current.push({ role: 'assistant', content: followUp.text || '' });
          }

          // Handle any additional tool_use in follow-up
          if (followUp.configUpdate) {
            const moreFields = Object.keys(followUp.configUpdate);
            setConfig((prev) => ({ ...prev, ...followUp.configUpdate! }));
            setHighlightedFields((prev) => [...prev, ...moreFields]);
            setTimeout(() => setHighlightedFields([]), 2500);
          }
        } else {
          // No tool_use — just text response
          if (response.text) {
            setMessages((prev) => [...prev, { role: 'assistant', content: response.text }]);
            apiMessagesRef.current.push({ role: 'assistant', content: response.text });
          }
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ Error al comunicarse con el copiloto: ${err.message || 'Error desconocido'}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, existingPolicy, employees],
  );

  // Manual config change — notify context for next message
  const handleManualChange = useCallback((field: string, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Reverse mapping: internal activityPeriod → API allowanceStart
  const ACTIVITY_PERIOD_TO_ALLOWANCE_START: Record<string, string> = useMemo(() => {
    const rev: Record<string, string> = {};
    for (const [k, v] of Object.entries(ALLOWANCE_START_TO_ACTIVITY_PERIOD)) {
      rev[v] = k;
    }
    return rev;
  }, []);

  // Create policy via API
  const handleCreatePolicy = useCallback(async (policyName: string, policyTypeId: number) => {
    setIsCreating(true);
    try {
      // Build seniority tiers for API (yearsOfService array)
      const yearsOfService = (config.seniorityEnabled && config.seniorityTiers && config.seniorityTiers.length > 0)
        ? config.seniorityTiers.map((t) => ({ yearsOfService: t.yearsOfService, extraDays: t.extraDays }))
        : [];

      const body: Record<string, unknown> = {
        // Required fields
        policyTypeId,
        name: policyName,
        description: policyName,
        allowanceType: config.allowanceType,
        allowanceStart: ACTIVITY_PERIOD_TO_ALLOWANCE_START[config.activityPeriod] || 'JANUARY',
        countingMethod: config.countingMethod,
        attachmentRequirement: 'NONE',
        allowHalfDayRequests: false,
        noRetroactiveRequests: false,

        // Fields the API requires — all with valid minimums
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
        yearsOfService: yearsOfService.map((t: any) => ({
          years: t.yearsOfService,
          yearsOfService: t.yearsOfService,
          extraDays: t.extraDays,
        })),
        argentinianLawCompliance: config.seniorityLawCountry === 'AR',

        // Remnant expiration
        ...(config.remnantExpirationValue != null
          ? { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: config.remnantExpirationValue }
          : { remnantExpirationUnit: 'MONTHS', remnantExpirationValue: 0 }),
      };

      await timeOffAdminService.createPolicy(body);

      const successMsg: ChatMessageDisplay = {
        role: 'assistant',
        content: `✅ **¡Política "${policyName}" creada exitosamente!**\n\nLa política fue creada en la plataforma y ya está disponible para asignar empleados.`,
      };
      setMessages((prev) => [...prev, successMsg]);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.message || err?.message || 'Error desconocido';
      const errorMsg: ChatMessageDisplay = {
        role: 'assistant',
        content: `❌ **Error al crear la política:** ${errorDetail}\n\nRevisá la configuración e intentá nuevamente.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsCreating(false);
    }
  }, [config, ACTIVITY_PERIOD_TO_ALLOWANCE_START]);

  // Update (edit) policy via API
  const handleUpdatePolicy = useCallback(async () => {
    if (!selectedPolicyId) return;
    setIsCreating(true);
    try {
      const yearsOfService = (config.seniorityEnabled && config.seniorityTiers && config.seniorityTiers.length > 0)
        ? config.seniorityTiers.map((t) => ({
            years: t.yearsOfService,
            yearsOfService: t.yearsOfService,
            extraDays: t.extraDays,
          }))
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
            // Clean each step: only include fields with actual data
            const fixed = existing.map((step: any) => {
              const clean: any = {};
              if (Array.isArray(step.userIds) && step.userIds.length > 0) clean.userIds = step.userIds;
              if (Array.isArray(step.relations) && step.relations.length > 0) clean.relations = step.relations;
              if (Array.isArray(step.itemIds) && step.itemIds.length > 0) clean.itemIds = step.itemIds;
              if (step.designatedReviewer === true) clean.designatedReviewer = true;
              // If step has no valid data, add BOSS
              if (Object.keys(clean).length === 0) {
                clean.relations = ['BOSS'];
              }
              return clean;
            });
            return fixed;
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

      const successMsg: ChatMessageDisplay = {
        role: 'assistant',
        content: `✅ **¡Política actualizada exitosamente!**\n\nLos cambios fueron aplicados en la plataforma.`,
      };
      setMessages((prev) => [...prev, successMsg]);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.message || err?.response?.data?.errors
        ? JSON.stringify(err?.response?.data?.errors || err?.response?.data?.message)
        : err?.message || 'Error desconocido';
      const errorMsg: ChatMessageDisplay = {
        role: 'assistant',
        content: `❌ **Error al actualizar la política:** ${errorDetail}\n\nRevisá la configuración e intentá nuevamente.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsCreating(false);
    }
  }, [config, selectedPolicyId, existingPolicy, ACTIVITY_PERIOD_TO_ALLOWANCE_START]);

  // Compute simulated balances whenever config or employees change
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
        if (emp.originalCountingMethod === 'BUSINESS_DAYS' && config.countingMethod === 'CALENDAR_DAYS') {
          adjustedConsumed = consumed * calendarToBusinessRatio;
        } else if (emp.originalCountingMethod === 'CALENDAR_DAYS' && config.countingMethod === 'BUSINESS_DAYS') {
          adjustedConsumed = consumed / calendarToBusinessRatio;
        }
      }

      const monthsElapsed = getMonthsElapsedInCycle(config.activityPeriod, emp.hiringDate);
      let accruedThisCycle = 0;

      if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS') {
        if (config.accumulationMoment === 'START_OF_CYCLE') {
          accruedThisCycle = newAllowance;
        } else {
          accruedThisCycle = 0;
        }
      } else {
        const monthlyNew = newAllowance / 12;
        const monthlyOld = emp.originalAllowance / 12;
        accruedThisCycle = Math.min(monthlyOld * monthsElapsed + monthlyNew * (12 - monthsElapsed), newAllowance);
      }

      let adjustedRemnant = remnantFromPreviousCycles;
      if (config.maximumRemnant !== null && config.maximumRemnant >= 0) {
        adjustedRemnant = Math.min(adjustedRemnant, config.maximumRemnant);
      }
      if (config.remnantExpirationValue !== null && config.remnantExpirationValue > 0 && monthsElapsed >= config.remnantExpirationValue) {
        adjustedRemnant = 0;
      }
      if (config.prorationFrequency === 'EVERY_ONE_MONTH' && config.maximumRemnant === 0) {
        adjustedRemnant = 0;
      }

      let simBalance: number;
      if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS' && config.accumulationMoment === 'END_OF_CYCLE') {
        const currentWithoutRemnant = Math.min(emp.currentBalance, emp.originalAllowance);
        simBalance = currentWithoutRemnant + (consumed - adjustedConsumed) + adjustedRemnant;
      } else {
        simBalance = accruedThisCycle + adjustedRemnant - adjustedConsumed;
      }

      if (config.minimumBalance < 0) {
        simBalance = Math.max(simBalance, config.minimumBalance);
      } else {
        simBalance = Math.max(simBalance, 0);
      }

      simBalance = Math.round(simBalance * 100) / 100;

      return { name: emp.name, currentBalance: emp.currentBalance, simulatedBalance: simBalance, amountRequested: emp.amountRequested };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [config, employees]);

  // MODE SELECT screen
  if (mode === 'select') {
    return (
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h1" gutterBottom>
            Laboratorio de Políticas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Un copiloto de IA te guía paso a paso para crear o editar políticas de vacaciones y
            permisos, explicándote cada configuración y sus consecuencias.
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ maxWidth: 700 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card
              sx={{
                height: '100%',
                borderTop: '4px solid #1976D2',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea onClick={handleSelectCreate} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CreateIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h3" gutterBottom>
                    Crear una política
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    El copiloto te pregunta sobre el país, tipo de licencia y configura
                    automáticamente según la legislación.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card
              sx={{
                height: '100%',
                borderTop: '4px solid #ED6C02',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
              }}
            >
              <CardActionArea onClick={handleSelectEdit} sx={{ height: '100%', p: 3 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <EditIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h3" gutterBottom>
                    Editar una política
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Seleccioná una política existente. El copiloto te explica las consecuencias de
                    cada cambio antes de aplicarlo.
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // EDIT mode — policy selector (before chat starts)
  if (mode === 'edit' && messages.length === 0) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h1" gutterBottom>
            Laboratorio de Políticas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Seleccioná la política que querés editar.
          </Typography>
        </Box>

        {loadingPolicies ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ maxWidth: 400 }}>
            <TextField
              fullWidth
              size="small"
              select
              label="Política a editar"
              value={selectedPolicyId}
              onChange={(e) => handlePolicySelect(Number(e.target.value))}
              disabled={loadingPolicy}
            >
              {policies.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            {loadingPolicy && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  Cargando política...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // SPLIT LAYOUT — Chat + Config Form
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h1">
          Laboratorio de Políticas
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Chat Panel */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <LabChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                mode={mode === 'edit' ? 'edit' : 'create'}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Config Form Panel */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <LabConfigForm
                config={config}
                highlightedFields={highlightedFields}
                onManualChange={handleManualChange}
                simulatedEmployees={simulatedEmployees}
                mode={mode === 'select' ? undefined : mode}
                policyTypes={policyTypes}
                onCreatePolicy={handleCreatePolicy}
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

export default Laboratory;
