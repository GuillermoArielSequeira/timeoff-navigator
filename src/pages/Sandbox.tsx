import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  Button,
  Chip,
  Divider,
  Alert,
  Paper,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  PlayArrow as SimulateIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { timeOffAdminService, timeOffClientService } from '../services/timeOffService';

interface PolicyConfig {
  allowanceAmount: number;
  allowanceType: string;
  accumulationMoment: string;
  prorationFrequency: string;
  countingMethod: string;
  maximumRemnant: number | null;
  remnantExpirationValue: number | null;
  minimumBalance: number;
  allowHalfDayRequests: boolean;
  minimumAdvanceDays: number;
  activityPeriod: string;
}

const defaultConfig: PolicyConfig = {
  allowanceAmount: 15,
  allowanceType: 'BASIC_ANNUAL',
  accumulationMoment: 'START_OF_CYCLE',
  prorationFrequency: 'EVERY_TWELVE_MONTHS',
  countingMethod: 'BUSINESS_DAYS',
  maximumRemnant: null,
  remnantExpirationValue: 3,
  minimumBalance: 0,
  allowHalfDayRequests: false,
  minimumAdvanceDays: 0,
  activityPeriod: 'JAN_DEC',
};

interface EmployeeBalance {
  name: string;
  currentBalance: number;
  amountRequested: number;
  originalAllowance: number;
  hiringDate: string | null;
  workdays: number[];
  originalCountingMethod: string;
  originalAccumulationMoment: string;
  originalProrationFrequency: string;
  originalMaximumRemnant: number | null;
  originalRemnantExpirationValue: number | null;
  originalAllowanceStart: string | null;
}

// Mapeo de allowanceStart (API) → activityPeriod (interno)
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

const mapAllowanceStartToActivityPeriod = (allowanceStart?: string | null): string | null => {
  if (!allowanceStart) return null;
  return ALLOWANCE_START_TO_ACTIVITY_PERIOD[allowanceStart] ?? null;
};

// Helpers for simulation
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

const getWorkdaysPerWeek = (workdays: number[]): number => {
  return workdays.length > 0 ? workdays.length : 5;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawPolicy = Record<string, any>;

const Sandbox = () => {
  const location = useLocation();
  const [policies, setPolicies] = useState<RawPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [config, setConfig] = useState<PolicyConfig>(defaultConfig);
  const [unit, setUnit] = useState<'DAYS' | 'HOURS'>('DAYS');
  const [employees, setEmployees] = useState<EmployeeBalance[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [loading, setLoading] = useState(true);
  const templateApplied = useRef(false);

  // Pre-fill config from template navigation state
  useEffect(() => {
    const templateConfig = (location.state as { templateConfig?: Partial<PolicyConfig> } | null)?.templateConfig;
    if (templateConfig && !templateApplied.current) {
      templateApplied.current = true;
      setConfig({ ...defaultConfig, ...templateConfig });
      setSelectedPolicy('');
      setSimulated(false);
      setEmployees([]);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const data = await timeOffAdminService.getPolicies({ limit: 50 });
        const items = data.data || data.items || data || [];
        setPolicies(Array.isArray(items) ? items : []);
      } catch {
        // Fallback with empty
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  const fetchEmployeesForPolicy = async (policyId: string) => {
    setLoadingEmployees(true);
    try {
      const data = await timeOffClientService.getBalancesReport({ policyIds: policyId, limit: 100 });
      const items = data.items || data.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = items.map((item: any) => ({
        name: `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim(),
        currentBalance: item.currentBalance ?? 0,
        amountRequested: item.amountRequested ?? 0,
        originalAllowance: item.policy?.allowanceAmount ?? 0,
        hiringDate: item.user?.hiringDate ?? null,
        workdays: item.user?.workdays ?? [],
        originalCountingMethod: item.policy?.countingMethod ?? 'BUSINESS_DAYS',
        originalAccumulationMoment: item.policy?.accumulationMoment ?? 'START_OF_CYCLE',
        originalProrationFrequency: item.policy?.allowanceProrationFrequency ?? 'EVERY_TWELVE_MONTHS',
        originalMaximumRemnant: item.policy?.maximumRemnant ?? null,
        originalRemnantExpirationValue: item.policy?.remnantExpirationValue ?? null,
        originalAllowanceStart: item.policy?.allowanceStart ?? null,
      }));
      setEmployees(mapped);
    } catch {
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handlePolicySelect = (policyId: string) => {
    setSelectedPolicy(policyId);
    setSimulated(false);

    if (!policyId) {
      setConfig(defaultConfig);
      setUnit('DAYS');
      setEmployees([]);
      return;
    }

    fetchEmployeesForPolicy(policyId);

    const policy = policies.find((p) => String(p.id ?? p._id) === policyId);
    if (policy) {
      const policyUnit = policy.policyType?.unit ?? 'DAYS';
      setUnit(policyUnit === 'HOURS' ? 'HOURS' : 'DAYS');
      setConfig({
        allowanceAmount: policy.allowanceAmount ?? defaultConfig.allowanceAmount,
        allowanceType: policy.allowanceType ?? defaultConfig.allowanceType,
        accumulationMoment: policy.accumulationMoment ?? defaultConfig.accumulationMoment,
        prorationFrequency: policy.allowanceProrationFrequency ?? policy.prorationFrequency ?? defaultConfig.prorationFrequency,
        countingMethod: policy.countingMethod ?? defaultConfig.countingMethod,
        maximumRemnant: policy.maximumRemnant ?? defaultConfig.maximumRemnant,
        remnantExpirationValue: policy.remnantExpirationValue ?? defaultConfig.remnantExpirationValue,
        minimumBalance: policy.minimumBalance ?? defaultConfig.minimumBalance,
        allowHalfDayRequests: policy.allowHalfDayRequests ?? defaultConfig.allowHalfDayRequests,
        minimumAdvanceDays: policy.minimumAdvanceDays ?? defaultConfig.minimumAdvanceDays,
        activityPeriod: mapAllowanceStartToActivityPeriod(policy.allowanceStart) ?? defaultConfig.activityPeriod,
      });
    }
  };

  /**
   * Simulación basada en las reglas reales del módulo Time Off de Humand.
   *
   * Reglas clave (de la skill):
   * - Saldo actual = suma de todos los eventos activos (FIFO: se descuenta del más antiguo)
   * - Inicio de ciclo: recalcula constantemente, cambios inmediatos y retroactivos
   * - Final de ciclo: cambios solo impactan siguiente ciclo, lo previo se corrige manual
   * - Mensual: no recalcula meses anteriores, solo la próxima acreditación
   * - Expiración del remanente cuenta desde el FINAL del ciclo
   * - Saldo mínimo negativo permite adelantar días del próximo ciclo
   * - Días laborales = L-V sin feriados; Días calendario = todos los días incluidos fines de semana
   */
  const calculateSimulatedBalance = (emp: EmployeeBalance): string | number => {
    // 1. Ilimitada → no hay saldo, solo se trackea consumo
    if (config.allowanceType === 'UNLIMITED') return '∞';

    const newAllowance = config.allowanceAmount;
    const workdaysPerWeek = getWorkdaysPerWeek(emp.workdays);
    const calendarToBusinessRatio = 7 / workdaysPerWeek; // ej: 7/5 = 1.4

    // 2. Estimar consumo real (solicitudes aprobadas en el ciclo)
    // consumed = originalAllowance - currentBalance (si es positivo, el empleado usó días)
    // Si currentBalance > originalAllowance, hay remanente de ciclos anteriores
    const consumed = Math.max(0, emp.originalAllowance - emp.currentBalance);
    const remnantFromPreviousCycles = Math.max(0, emp.currentBalance - emp.originalAllowance);

    // 3. Ajustar consumo si cambió el método de conteo
    // Skill: "Solicitudes futuras se calculan diferente. Las ya aprobadas no cambian."
    // Pero en simulación mostramos el impacto como si se re-calculara
    let adjustedConsumed = consumed;
    if (emp.originalCountingMethod !== config.countingMethod) {
      if (emp.originalCountingMethod === 'BUSINESS_DAYS' && config.countingMethod === 'CALENDAR_DAYS') {
        // Misma ausencia ahora consume más (incluye fines de semana)
        adjustedConsumed = consumed * calendarToBusinessRatio;
      } else if (emp.originalCountingMethod === 'CALENDAR_DAYS' && config.countingMethod === 'BUSINESS_DAYS') {
        // Misma ausencia ahora consume menos (solo laborales)
        adjustedConsumed = consumed / calendarToBusinessRatio;
      }
    }

    // 4. Calcular acreditación según tipo de política
    const monthsElapsed = getMonthsElapsedInCycle(config.activityPeriod, emp.hiringDate);
    let accruedThisCycle = 0;

    if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS') {
      // ANUAL
      if (config.accumulationMoment === 'START_OF_CYCLE') {
        // Skill: "días se dan al EMPEZAR el período. Se acreditan automáticamente."
        // Skill: "Inicio de ciclo = recálculo constante. Cualquier cambio afecta saldos inmediatamente."
        accruedThisCycle = newAllowance;
      } else {
        // FINAL DE CICLO
        // Skill: "días se dan al TERMINAR el año trabajado. No se acredita nada hasta que cierre el ciclo."
        // Skill: "Los cambios generalmente no afectan saldos existentes; impactan en el siguiente ciclo."
        // En simulación: si estamos en medio del ciclo, aún no se acreditó nada del nuevo valor
        // Usamos el saldo actual como base ya que refleja lo ya acreditado
        accruedThisCycle = 0; // No se acredita hasta el cierre
      }
    } else {
      // MENSUAL
      // Skill: "proporcionalmente cada mes (ej: 15/12 = 1.25 días/mes)"
      // Skill: "los cambios NO recalculan el mes en curso ni los anteriores. Solo afectan la próxima acreditación."
      const monthlyAmountNew = newAllowance / 12;
      const monthlyAmountOld = emp.originalAllowance / 12;

      // Meses ya acreditados con el valor anterior + meses restantes con el nuevo
      const accruedOldMonths = monthlyAmountOld * monthsElapsed;
      const remainingMonths = 12 - monthsElapsed;
      const accruedNewMonths = monthlyAmountNew * remainingMonths;
      accruedThisCycle = accruedOldMonths + accruedNewMonths;
      accruedThisCycle = Math.min(accruedThisCycle, newAllowance);
    }

    // 5. Calcular remanente (carry over)
    let adjustedRemnant = remnantFromPreviousCycles;

    // 5a. Aplicar límite de remanente
    // Skill: "Sin límite = acumulación indefinida / 0 = no transfiere nada / N = transfiere hasta N días"
    if (config.maximumRemnant !== null && config.maximumRemnant >= 0) {
      adjustedRemnant = Math.min(adjustedRemnant, config.maximumRemnant);
    }

    // 5b. Aplicar expiración del remanente
    // Skill: "La expiración siempre empieza a contar desde el FINAL del ciclo"
    // Si ya pasaron más meses que la expiración configurada, el remanente expiró
    if (config.remnantExpirationValue !== null && config.remnantExpirationValue > 0) {
      // monthsElapsed = meses desde inicio del ciclo actual
      // Si monthsElapsed >= remnantExpiration, el remanente del ciclo anterior ya venció
      if (monthsElapsed >= config.remnantExpirationValue) {
        adjustedRemnant = 0; // Expiró
      }
    }

    // Remanente en mensual opera mes a mes
    // Skill: "Límite 0: días no usados vencen al cierre de cada mes"
    if (config.prorationFrequency === 'EVERY_ONE_MONTH' && config.maximumRemnant === 0) {
      adjustedRemnant = 0;
    }

    // 6. Calcular saldo simulado
    let simulatedBalance: number;

    if (config.prorationFrequency === 'EVERY_TWELVE_MONTHS' && config.accumulationMoment === 'END_OF_CYCLE') {
      // Final de ciclo: los cambios no afectan saldo actual, impactan en el siguiente ciclo
      // El saldo actual se mantiene (ya refleja lo acreditado previamente)
      // Solo ajustamos por cambios en remanente y counting method
      const currentWithoutRemnant = Math.min(emp.currentBalance, emp.originalAllowance);
      const adjustedCurrent = currentWithoutRemnant + (consumed - adjustedConsumed); // Ajuste por counting method
      simulatedBalance = adjustedCurrent + adjustedRemnant;
    } else if (config.accumulationMoment === 'START_OF_CYCLE') {
      // Inicio de ciclo: recálculo constante e inmediato
      // Skill: "Cualquier cambio en la política afecta saldos de forma inmediata"
      simulatedBalance = accruedThisCycle + adjustedRemnant - adjustedConsumed;
    } else {
      // Mensual: meses anteriores intactos, nuevos meses con nuevo valor
      simulatedBalance = accruedThisCycle + adjustedRemnant - adjustedConsumed;
    }

    // 7. Aplicar saldo mínimo (adelanto)
    // Skill: "0 = no se pueden adelantar / Negativo (ej: -7) = se pueden tomar hasta 7 días prestados"
    // Skill: "Solo se puede adelantar la misma cantidad de días que tenés disponibles hoy"
    if (config.minimumBalance < 0) {
      // Permite adelanto hasta minimumBalance negativo
      simulatedBalance = Math.max(simulatedBalance, config.minimumBalance);
    } else {
      // No permite saldo negativo
      simulatedBalance = Math.max(simulatedBalance, 0);
    }

    // 8. Redondeo según precisión
    // Skill: "Solicitudes de medio día: habilita solicitudes de 0.5 días"
    if (config.allowHalfDayRequests) {
      simulatedBalance = Math.round(simulatedBalance * 2) / 2;
    } else {
      simulatedBalance = Math.round(simulatedBalance * 100) / 100;
    }

    return simulatedBalance;
  };

  const handleSimulate = () => {
    setSimulated(true);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          Sandbox de Políticas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Modificá parámetros y simulá el impacto sobre empleados antes de aplicar cambios reales.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h4" gutterBottom>
                Configuración de Política
              </Typography>

              {/* Step 1: Select base */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Paso 1: Seleccionar base
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Política existente (opcional)"
                  value={selectedPolicy}
                  onChange={(e) => handlePolicySelect(e.target.value)}
                >
                  <MenuItem value="">Crear desde cero</MenuItem>
                  {loading ? (
                    <MenuItem disabled>Cargando...</MenuItem>
                  ) : (
                    policies.map((p) => (
                      <MenuItem key={String(p.id ?? p._id)} value={String(p.id ?? p._id)}>
                        {p.name}
                      </MenuItem>
                    ))
                  )}
                </TextField>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Step 2: Parameters */}
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Paso 2: Ajustar parámetros
              </Typography>

              <Grid container spacing={2}>
                {/* Derecho a prestación */}
                <Grid size={{ xs: 12 }}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                      Derecho a prestación
                    </FormLabel>
                    <RadioGroup
                      value={config.allowanceType}
                      onChange={(e) =>
                        setConfig({ ...config, allowanceType: e.target.value })
                      }
                    >
                      <Paper variant="outlined" sx={{ px: 2, py: 1, mb: 1, borderRadius: 2 }}>
                        <FormControlLabel
                          value="BASIC_ANNUAL"
                          control={<Radio />}
                          label="Prestación anual básica"
                          sx={{ m: 0 }}
                        />
                      </Paper>
                      <Paper variant="outlined" sx={{ px: 2, py: 1, borderRadius: 2 }}>
                        <FormControlLabel
                          value="UNLIMITED"
                          control={<Radio />}
                          label="Ilimitada"
                          sx={{ m: 0 }}
                        />
                      </Paper>
                    </RadioGroup>
                  </FormControl>
                </Grid>

                {/* Período de actividad */}
                <Grid size={{ xs: 12 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Período de actividad"
                    value={config.activityPeriod}
                    onChange={(e) =>
                      setConfig({ ...config, activityPeriod: e.target.value })
                    }
                  >
                    <MenuItem value="EMPLOYEE_ANNIVERSARY">Comienza cada aniversario del empleado</MenuItem>
                    <MenuItem value="JAN_DEC">Ene-Dic</MenuItem>
                    <MenuItem value="FEB_JAN">Feb-Ene</MenuItem>
                    <MenuItem value="MAR_FEB">Mar-Feb</MenuItem>
                    <MenuItem value="APR_MAR">Abr-Mar</MenuItem>
                    <MenuItem value="MAY_APR">May-Abr</MenuItem>
                    <MenuItem value="JUN_MAY">Jun-May</MenuItem>
                    <MenuItem value="JUL_JUN">Jul-Jun</MenuItem>
                    <MenuItem value="AUG_JUL">Ago-Jul</MenuItem>
                    <MenuItem value="SEP_AUG">Sep-Ago</MenuItem>
                    <MenuItem value="OCT_SEP">Oct-Sep</MenuItem>
                    <MenuItem value="NOV_OCT">Nov-Oct</MenuItem>
                    <MenuItem value="DEC_NOV">Dic-Nov</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Prestación anual (${unit === 'HOURS' ? 'horas' : 'días'})`}
                    type="number"
                    value={config.allowanceAmount}
                    disabled={config.allowanceType === 'UNLIMITED'}
                    onChange={(e) =>
                      setConfig({ ...config, allowanceAmount: Number(e.target.value) })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Frecuencia de acumulación"
                    value={config.prorationFrequency}
                    onChange={(e) =>
                      setConfig({ ...config, prorationFrequency: e.target.value })
                    }
                  >
                    <MenuItem value="EVERY_TWELVE_MONTHS">Anual</MenuItem>
                    <MenuItem value="EVERY_ONE_MONTH">Mensual</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Momento de acumulación"
                    value={config.accumulationMoment}
                    onChange={(e) =>
                      setConfig({ ...config, accumulationMoment: e.target.value })
                    }
                  >
                    <MenuItem value="START_OF_CYCLE">Inicio del ciclo</MenuItem>
                    <MenuItem value="END_OF_CYCLE">Final del ciclo</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Cálculo de prorrateo"
                    value={config.countingMethod}
                    onChange={(e) =>
                      setConfig({ ...config, countingMethod: e.target.value })
                    }
                  >
                    <MenuItem value="BUSINESS_DAYS">Solo días laborales</MenuItem>
                    <MenuItem value="CALENDAR_DAYS">Días calendario</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Límite de remanente (días)"
                    type="number"
                    value={config.maximumRemnant ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maximumRemnant: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Sin límite"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Expiración remanente (meses)"
                    type="number"
                    value={config.remnantExpirationValue ?? ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        remnantExpirationValue: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Saldo mínimo (adelanto)"
                    type="number"
                    value={config.minimumBalance}
                    onChange={(e) =>
                      setConfig({ ...config, minimumBalance: Number(e.target.value) })
                    }
                    helperText="Negativo = permite adelantar días"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Anticipación mínima (días)"
                    type="number"
                    value={config.minimumAdvanceDays}
                    onChange={(e) =>
                      setConfig({ ...config, minimumAdvanceDays: Number(e.target.value) })
                    }
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SimulateIcon />}
                  onClick={handleSimulate}
                  size="large"
                >
                  Simular impacto
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ResetIcon />}
                  onClick={() => {
                    setConfig(defaultConfig);
                    setSelectedPolicy('');
                    setUnit('DAYS');
                    setSimulated(false);
                    setEmployees([]);
                  }}
                >
                  Resetear
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Simulation Results */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h4" gutterBottom>
                Resultado de Simulación
              </Typography>

              {!simulated ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    color: 'text.secondary',
                  }}
                >
                  {loadingEmployees ? (
                    <>
                      <CircularProgress sx={{ mb: 2 }} />
                      <Typography>Cargando empleados...</Typography>
                    </>
                  ) : (
                    <>
                      <SimulateIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                      <Typography>
                        {employees.length > 0
                          ? `${employees.length} empleados cargados. Hacé click en "Simular impacto"`
                          : 'Seleccioná una política y hacé click en "Simular impacto"'}
                      </Typography>
                    </>
                  )}
                </Box>
              ) : (
                <Box>
                  {employees.length === 0 ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      No se encontraron empleados asignados a esta política. Seleccioná una política existente.
                    </Alert>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Simulación con {employees.length} empleados reales de la comunidad
                      </Alert>

                      <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
                        {employees.map((emp) => {
                          const simBalance = calculateSimulatedBalance(emp);
                          const isUnlimited = simBalance === '∞';
                          const diff = isUnlimited ? 0 : (simBalance as number) - emp.currentBalance;
                          const diffColor = diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary';
                          const unitLabel = unit === 'HOURS' ? 'hs' : 'días';

                          return (
                            <Paper
                              key={emp.name}
                              variant="outlined"
                              sx={{ p: 2, mb: 1.5, borderRadius: 2 }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" fontWeight={600}>
                                  {emp.name}
                                </Typography>
                                {emp.amountRequested > 0 && (
                                  <Chip
                                    size="small"
                                    label={`${emp.amountRequested} solicitados`}
                                    color="warning"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Saldo actual
                                  </Typography>
                                  <Typography variant="body1">{emp.currentBalance} {unitLabel}</Typography>
                                </Box>
                                <Typography variant="h4" sx={{ color: 'text.secondary' }}>
                                  →
                                </Typography>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Saldo simulado
                                  </Typography>
                                  <Typography variant="body1" fontWeight={600}>
                                    {isUnlimited ? '∞' : `${simBalance} ${unitLabel}`}
                                  </Typography>
                                </Box>
                                {!isUnlimited && (
                                  <Chip
                                    size="small"
                                    label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}
                                    sx={{
                                      bgcolor: `${diff > 0 ? '#1CA332' : diff < 0 ? '#E74444' : '#6B778C'}15`,
                                      color: diffColor,
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>

                    </>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Sandbox;
