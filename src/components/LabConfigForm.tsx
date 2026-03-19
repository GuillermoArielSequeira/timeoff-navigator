import { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  FormControlLabel,
  RadioGroup,
  Radio,
  Paper,
  Chip,
  Alert,
  Switch,
  IconButton,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Info as InfoIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { PolicyConfig, SeniorityTier } from '../services/claudeService';

export interface SimEmployee {
  name: string;
  currentBalance: number;
  simulatedBalance: number | string;
  amountRequested?: number;
}

interface PolicyTypeOption {
  id: number;
  name: string;
}

interface LabConfigFormProps {
  config: PolicyConfig;
  highlightedFields: string[];
  onManualChange: (field: string, value: any) => void;
  simulatedEmployees?: SimEmployee[];
  mode?: 'create' | 'edit';
  policyTypes?: PolicyTypeOption[];
  onCreatePolicy?: (policyName: string, policyTypeId: number) => void;
  onUpdatePolicy?: () => void;
  isCreating?: boolean;
}

const ACTIVITY_PERIODS = [
  { value: 'JAN_DEC', label: 'Enero - Diciembre' },
  { value: 'FEB_JAN', label: 'Febrero - Enero' },
  { value: 'MAR_FEB', label: 'Marzo - Febrero' },
  { value: 'APR_MAR', label: 'Abril - Marzo' },
  { value: 'MAY_APR', label: 'Mayo - Abril' },
  { value: 'JUN_MAY', label: 'Junio - Mayo' },
  { value: 'JUL_JUN', label: 'Julio - Junio' },
  { value: 'AUG_JUL', label: 'Agosto - Julio' },
  { value: 'SEP_AUG', label: 'Septiembre - Agosto' },
  { value: 'OCT_SEP', label: 'Octubre - Septiembre' },
  { value: 'NOV_OCT', label: 'Noviembre - Octubre' },
  { value: 'DEC_NOV', label: 'Diciembre - Noviembre' },
  { value: 'EMPLOYEE_ANNIVERSARY', label: 'Aniversario del empleado' },
];

const fieldStyle = (field: string, highlighted: string[]) => ({
  transition: 'background-color 0.8s ease',
  backgroundColor: highlighted.includes(field) ? '#FFF9C4' : 'transparent',
  borderRadius: 1,
  p: 1,
  mb: 1,
});

const LabConfigForm = ({ config, highlightedFields, onManualChange, simulatedEmployees, mode, policyTypes, onCreatePolicy, onUpdatePolicy, isCreating }: LabConfigFormProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateInputs, setShowCreateInputs] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [selectedPolicyTypeId, setSelectedPolicyTypeId] = useState<number | ''>('');
  const tiers = config.seniorityTiers || [];

  const handleAddTier = useCallback(() => {
    const newTiers = [...tiers];
    const lastYears = newTiers.length > 0 ? newTiers[newTiers.length - 1].yearsOfService : 0;
    newTiers.push({ yearsOfService: lastYears + 5, extraDays: 7 });
    onManualChange('seniorityTiers', newTiers);
  }, [tiers, onManualChange]);

  const handleRemoveTier = useCallback((idx: number) => {
    const newTiers = [...tiers];
    newTiers.splice(idx, 1);
    onManualChange('seniorityTiers', newTiers);
  }, [tiers, onManualChange]);

  const handleTierChange = useCallback((idx: number, field: keyof SeniorityTier, value: number) => {
    const newTiers = [...tiers];
    newTiers[idx] = { ...newTiers[idx], [field]: value };
    onManualChange('seniorityTiers', newTiers);
  }, [tiers, onManualChange]);

  /* ───── Tab 0: Prestación ───── */
  const renderPrestacion = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Prestación
      </Typography>

      {/* Derecho de prestación */}
      <Box sx={fieldStyle('allowanceType', highlightedFields)}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Derecho a prestación
        </Typography>
        <RadioGroup
          value={config.allowanceType}
          onChange={(e) => onManualChange('allowanceType', e.target.value)}
        >
          <FormControlLabel value="BASIC_ANNUAL" control={<Radio size="small" />} label="Prestación anual básica" />
          <FormControlLabel value="UNLIMITED" control={<Radio size="small" />} label="Ilimitada" />
        </RadioGroup>
      </Box>

      {config.allowanceType !== 'UNLIMITED' && (
        <>
          {/* Prestación anual */}
          <Box sx={fieldStyle('allowanceAmount', highlightedFields)}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Prestación anual"
              value={config.allowanceAmount}
              onChange={(e) => onManualChange('allowanceAmount', Number(e.target.value))}
              helperText={`Introducir prestación anual en ${config.unit === 'HOURS' ? 'horas' : 'días'}`}
            />
          </Box>

          {/* Ciclo de acumulación */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>
            Ciclo de acumulación
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Define con qué frecuencia se calcula y acumule el saldo de los colaboradores.
          </Typography>

          {/* Período de actividad */}
          <Box sx={fieldStyle('activityPeriod', highlightedFields)}>
            <TextField
              fullWidth
              size="small"
              select
              label="Período de actividad"
              value={config.activityPeriod}
              onChange={(e) => onManualChange('activityPeriod', e.target.value)}
            >
              {ACTIVITY_PERIODS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Frecuencia de acreditación */}
          <Box sx={fieldStyle('prorationFrequency', highlightedFields)}>
            <TextField
              fullWidth
              size="small"
              select
              label="Frecuencia de acumulación del saldo"
              value={config.prorationFrequency}
              onChange={(e) => onManualChange('prorationFrequency', e.target.value)}
            >
              <MenuItem value="EVERY_TWELVE_MONTHS">Anual</MenuItem>
              <MenuItem value="EVERY_ONE_MONTH">Mensual</MenuItem>
            </TextField>
          </Box>

          {/* Momento de acreditación */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>
            Momento de la acumulación
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            ¿Cuándo aumenta el saldo del empleado?
          </Typography>

          <Box sx={fieldStyle('accumulationMoment', highlightedFields)}>
            <RadioGroup
              value={config.accumulationMoment}
              onChange={(e) => onManualChange('accumulationMoment', e.target.value)}
            >
              <FormControlLabel value="START_OF_CYCLE" control={<Radio size="small" />} label="Inicio del ciclo" />
              <FormControlLabel value="END_OF_CYCLE" control={<Radio size="small" />} label="Final del ciclo" />
            </RadioGroup>
          </Box>
        </>
      )}
    </Box>
  );

  /* ───── Tab 1: Límites de saldo ───── */
  const renderLimitesDeSaldo = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Límite de saldo
      </Typography>

      {/* Remanente de saldo */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Remanente de saldo
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Limite cuánto tiempo pueden trasladarse y establece la fecha de vencimiento del remanente.
      </Typography>

      <Box sx={fieldStyle('maximumRemnant', highlightedFields)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">Establecer el límite del remanente</Typography>
          <Switch
            checked={config.maximumRemnant != null}
            onChange={(e) => onManualChange('maximumRemnant', e.target.checked ? 0 : null)}
            color="primary"
          />
        </Box>
        {config.maximumRemnant != null && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Máximo acumulable (carry-over)"
            value={config.maximumRemnant}
            onChange={(e) => onManualChange('maximumRemnant', Number(e.target.value))}
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      <Box sx={fieldStyle('remnantExpirationValue', highlightedFields)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">Expiración del remanente</Typography>
          <Switch
            checked={config.remnantExpirationValue != null}
            onChange={(e) => onManualChange('remnantExpirationValue', e.target.checked ? 6 : null)}
            color="primary"
          />
        </Box>
        {config.remnantExpirationValue != null && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Expiración del remanente (meses)"
            value={config.remnantExpirationValue}
            onChange={(e) => onManualChange('remnantExpirationValue', Number(e.target.value))}
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* Máximo y mínimo de saldo */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 3, mb: 0.5 }}>
        Máximo y mínimo de saldo
      </Typography>

      <Box sx={fieldStyle('maximumBalance', highlightedFields)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">Establecer el saldo máximo al final del ciclo</Typography>
          <Switch
            checked={config.maximumBalance != null && config.maximumBalance > 0}
            onChange={(e) => onManualChange('maximumBalance', e.target.checked ? 30 : null)}
            color="primary"
          />
        </Box>
        {config.maximumBalance != null && config.maximumBalance > 0 && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Saldo máximo"
            value={config.maximumBalance}
            onChange={(e) => onManualChange('maximumBalance', Number(e.target.value))}
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      <Box sx={fieldStyle('minimumBalance', highlightedFields)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">Establecer el límite de saldo mínimo</Typography>
          <Switch
            checked={config.minimumBalance < 0}
            onChange={(e) => onManualChange('minimumBalance', e.target.checked ? -5 : 0)}
            color="primary"
          />
        </Box>
        {config.minimumBalance < 0 && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Saldo mínimo permitido"
            value={config.minimumBalance}
            onChange={(e) => onManualChange('minimumBalance', Number(e.target.value))}
            helperText="Negativo = permite adelanto de días"
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    </Box>
  );

  /* ───── Tab 2: Aumento de prestación ───── */
  const renderAumentoPrestacion = () => (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Aumento de prestación
      </Typography>

      {/* Años de servicio */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Años de servicio
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Otorga un aumento según los años de servicio de los colaboradores.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2">
          Conceder más días en función de los años de servicio
        </Typography>
        <Switch
          checked={config.seniorityEnabled}
          onChange={(e) => onManualChange('seniorityEnabled', e.target.checked)}
          color="primary"
        />
      </Box>

      {config.seniorityEnabled && (
        <>
          <Alert icon={<InfoIcon />} severity="info" sx={{ mb: 2 }}>
            La asignación base es de {config.allowanceAmount} días
          </Alert>

          {tiers.length > 0 && (
            <Table size="small" sx={{ mb: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Años de servicio</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Días extras</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Total de días de prestación</TableCell>
                  <TableCell width={40} />
                </TableRow>
              </TableHead>
              <TableBody>
                {tiers.map((tier, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={tier.yearsOfService}
                        onChange={(e) => handleTierChange(idx, 'yearsOfService', Number(e.target.value))}
                        sx={{ width: 80 }}
                        inputProps={{ min: 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={tier.extraDays}
                        onChange={(e) => handleTierChange(idx, 'extraDays', Number(e.target.value))}
                        sx={{ width: 80 }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {config.allowanceAmount + tiers.slice(0, idx + 1).reduce((sum, t) => sum + t.extraDays, 0)} Días
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRemoveTier(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Button size="small" startIcon={<AddIcon />} onClick={handleAddTier} sx={{ mb: 2 }}>
            Agregar fila
          </Button>

          {/* Ajustes especiales */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
            Ajustes especiales
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ flex: 1, mr: 2 }}>
              <Typography variant="body2">Aplicar cálculo en base a la ley Argentina</Typography>
              <Typography variant="caption" color="text.secondary">
                Según establece ley Argentina, el cálculo de la antigüedad de un ciclo (Oct-Sep) se considera hasta el 31 de diciembre.
              </Typography>
            </Box>
            <Switch
              checked={config.seniorityLawCountry === 'AR'}
              onChange={(e) => onManualChange('seniorityLawCountry', e.target.checked ? 'AR' : null)}
              color="primary"
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ flex: 1, mr: 2 }}>
              <Typography variant="body2">
                Aplicar días proporcionales de vacaciones por ley Argentina para ingresos menores a un año.
              </Typography>
            </Box>
            <Switch
              checked={config.seniorityProportionalNewHires}
              onChange={(e) => onManualChange('seniorityProportionalNewHires', e.target.checked)}
              color="primary"
            />
          </Box>

          {config.seniorityProportionalNewHires && (
            <Box sx={{ mt: 1, pl: 1 }}>
              <Tooltip title="Información sobre días proporcionales" arrow>
                <Chip
                  icon={<InfoIcon />}
                  label="Días proporcionales de vacaciones para nuevos ingresos"
                  variant="outlined"
                  color="info"
                  size="small"
                />
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pr: 1 }}>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Configuración de la Política
      </Typography>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Prestación" />
        <Tab label="Límites de saldo" />
        <Tab label="Aumento de prestación" />
      </Tabs>

      {/* Tab content */}
      {activeTab === 0 && renderPrestacion()}
      {activeTab === 1 && renderLimitesDeSaldo()}
      {activeTab === 2 && renderAumentoPrestacion()}

      {/* Resumen visual — siempre visible */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2, bgcolor: '#F5F7FA' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Resumen de configuración
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {config.allowanceType === 'UNLIMITED' ? (
            'Política ilimitada — sin tracking de saldo'
          ) : (
            <>
              <strong>{config.allowanceAmount} {config.unit === 'HOURS' ? 'horas' : 'días'}</strong>
              {' '}
              {config.countingMethod === 'CALENDAR_DAYS' ? 'corridos' : 'hábiles'}
              {', '}
              acreditación{' '}
              {config.prorationFrequency === 'EVERY_ONE_MONTH' ? 'mensual' : 'anual'}
              {' al '}
              {config.accumulationMoment === 'START_OF_CYCLE' ? 'inicio' : 'final'}
              {' del ciclo'}
              {config.activityPeriod === 'EMPLOYEE_ANNIVERSARY'
                ? ' (aniversario del empleado)'
                : ` (${ACTIVITY_PERIODS.find((p) => p.value === config.activityPeriod)?.label || config.activityPeriod})`}
              {config.maximumRemnant != null && `, máx. acumulable: ${config.maximumRemnant} días`}
              {config.remnantExpirationValue != null && `, expira en ${config.remnantExpirationValue} meses`}
              {config.minimumBalance < 0 && `, adelanto hasta ${Math.abs(config.minimumBalance)} días`}
            </>
          )}
        </Typography>
      </Paper>

      {/* Crear la política — solo en modo crear */}
      {mode === 'create' && onCreatePolicy && (
        <Box sx={{ mt: 3 }}>
          {!showCreateInputs ? (
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => setShowCreateInputs(true)}
              sx={{ borderRadius: 2, py: 1.5, fontWeight: 600 }}
            >
              Crear la política
            </Button>
          ) : (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Datos para crear la política
              </Typography>

              <TextField
                fullWidth
                size="small"
                label="Nombre de la política"
                placeholder="Ej: Vacaciones Argentina"
                value={newPolicyName}
                onChange={(e) => setNewPolicyName(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                select
                label="Tipo de política"
                value={selectedPolicyTypeId}
                onChange={(e) => setSelectedPolicyTypeId(Number(e.target.value))}
                sx={{ mb: 2 }}
              >
                {(policyTypes || []).map((pt) => (
                  <MenuItem key={pt.id} value={pt.id}>
                    {pt.name}
                  </MenuItem>
                ))}
              </TextField>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowCreateInputs(false)}
                  sx={{ flex: 1 }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  disabled={!newPolicyName.trim() || !selectedPolicyTypeId || isCreating}
                  onClick={() => onCreatePolicy(newPolicyName.trim(), selectedPolicyTypeId as number)}
                  sx={{ flex: 1, fontWeight: 600 }}
                >
                  {isCreating ? 'Creando...' : 'Confirmar creación'}
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* Aplicar cambios — solo en modo editar */}
      {mode === 'edit' && onUpdatePolicy && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={isCreating}
            onClick={onUpdatePolicy}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 600 }}
          >
            {isCreating ? 'Aplicando cambios...' : 'Aplicar cambios a la política'}
          </Button>
        </Box>
      )}

      {/* Simulación de saldos — card layout — siempre visible */}
      {simulatedEmployees && simulatedEmployees.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Impacto en empleados
          </Typography>
          <Alert icon={<InfoIcon />} severity="info" sx={{ mb: 2 }}>
            Simulación con {simulatedEmployees.length} empleados reales
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {simulatedEmployees.map((emp) => {
              const sim = typeof emp.simulatedBalance === 'number' ? emp.simulatedBalance : null;
              const diff = sim !== null ? sim - emp.currentBalance : null;
              const requested = emp.amountRequested ?? 0;
              return (
                <Paper
                  key={emp.name}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'border-color 0.3s',
                    borderColor: diff !== null && diff !== 0 ? (diff > 0 ? '#C8E6C9' : '#FFCDD2') : undefined,
                    bgcolor: diff !== null && diff !== 0 ? (diff > 0 ? '#FAFFF9' : '#FFFAFA') : undefined,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {emp.name}
                      </Typography>
                      {requested > 0 && (
                        <Chip
                          label={`${requested} solicitados`}
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ fontSize: '0.7rem', height: 22 }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {emp.currentBalance} días
                    </Typography>
                  </Box>

                  <Typography variant="body1" color="text.secondary" sx={{ flexShrink: 0 }}>
                    →
                  </Typography>

                  <Typography variant="body1" sx={{ fontWeight: 700, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                    {sim !== null ? `${sim} días` : '∞'}
                  </Typography>

                  {diff !== null && (
                    <Chip
                      size="small"
                      label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}
                      color={diff > 0 ? 'success' : diff < 0 ? 'error' : 'default'}
                      sx={{ fontWeight: 600, minWidth: 55, flexShrink: 0 }}
                    />
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default LabConfigForm;
