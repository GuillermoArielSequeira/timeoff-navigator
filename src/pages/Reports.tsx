import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Grid,
  Alert,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  SmartToy as AiIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { timeOffClientService, timeOffAdminService } from '../services/timeOffService';

interface PolicyOption {
  id: number;            // policy id (e.g. 6076 for Vacaciones Argentina)
  name: string;
  policyTypeId: string;  // policyType.id (e.g. 3941 for Vacaciones) — used for getEvents API
  peopleAmount: number;
}

interface ReportRow {
  userId: number;
  name: string;
  acredited: number;
  used: number;
  expired: number;
  balance: number;
}

/** Per-user, per-cycle data for Excel export */
interface UserCycleRow {
  userId: number;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  currentBalance: number;
}

const currentYear = new Date().getFullYear();
const years = [String(currentYear - 2), String(currentYear - 1), String(currentYear)];

// Search terms that together cover virtually all Spanish names
const SEARCH_TERMS = ['a', 'e', 'i', 'o', 'u', 'r', 's'];

/** Fetch all balance items across multiple searches and deduplicate */
const fetchAllBalanceItems = async (): Promise<any[]> => {
  const results = await Promise.all(
    SEARCH_TERMS.map((term) =>
      timeOffClientService.getBalancesReport({ search: term, limit: 100 }).then((resp) => {
        return resp?.items || resp?.data || [];
      }).catch(() => [] as any[])
    )
  );
  // Deduplicate by composite key: userId + policyId
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const items of results) {
    for (const item of items) {
      const uid = item.user?.id || item.userId;
      const pid = item.policy?.id;
      const key = `${uid}-${pid}`;
      if (uid && pid && !seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
  }
  return merged;
};

/** Process events with FIFO logic, returns year buckets + cycle date info */
const processEventsWithFIFO = (evts: any[]) => {
  const sorted = [...evts].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return da - db || (a.id || 0) - (b.id || 0);
  });

  const yearBuckets = new Map<string, { acredited: number; used: number; expired: number; remaining: number }>();
  const cycleDates = new Map<string, { startDate: string; endDate: string }>();

  const getYear = (dateStr: string): string => (dateStr || '').substring(0, 4);
  const getBucket = (yr: string) => {
    if (!yearBuckets.has(yr)) yearBuckets.set(yr, { acredited: 0, used: 0, expired: 0, remaining: 0 });
    return yearBuckets.get(yr)!;
  };

  // First pass: accumulate additions, expirations, and extract cycle dates
  for (const ev of sorted) {
    const yr = getYear(ev.date);
    if (!yr || yr < '2000') continue;
    const amt = Math.abs(ev.amount ?? ev.value ?? 0);
    const t = ev.type || '';

    if (t.includes('EXPIRATION')) {
      getBucket(yr).expired += amt;
    } else if (ev.operation === 'ADDITION') {
      const b = getBucket(yr);
      b.acredited += amt;
      b.remaining += amt;
    }

    // Extract cycle dates from CYCLE_ADDITION customData
    if (t === 'CYCLE_ADDITION' && ev.customData?.fromDateCycle && ev.customData?.toDateCycle) {
      cycleDates.set(yr, {
        startDate: ev.customData.fromDateCycle,
        endDate: ev.customData.toDateCycle,
      });
    }

    // For years without explicit cycle dates, set defaults
    if (!cycleDates.has(yr)) {
      cycleDates.set(yr, {
        startDate: `${yr}-01-01`,
        endDate: `${yr}-12-31`,
      });
    }
  }

  // Subtract expirations from remaining balance
  for (const [, b] of yearBuckets) {
    b.remaining = Math.max(0, b.remaining - b.expired);
  }

  // FIFO: distribute subtractions to the oldest year with remaining balance
  const sortedYears = Array.from(yearBuckets.keys()).sort();

  for (const ev of sorted) {
    if (ev.operation !== 'SUBTRACTION') continue;
    const t = ev.type || '';
    if (t.includes('EXPIRATION')) continue;

    let amt = Math.abs(ev.amount ?? ev.value ?? 0);

    for (const yr of sortedYears) {
      if (amt <= 0) break;
      const b = getBucket(yr);
      if (b.remaining <= 0) continue;
      const consume = Math.min(amt, b.remaining);
      b.used += consume;
      b.remaining -= consume;
      amt -= consume;
    }

    if (amt > 0) {
      const evYr = getYear(ev.date);
      if (evYr && evYr >= '2000') {
        getBucket(evYr).used += amt;
      }
    }
  }

  return { yearBuckets, cycleDates, sortedYears };
};

const Reports = () => {
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [allBalanceItems, setAllBalanceItems] = useState<any[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyOption | null>(null);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [allCycleRows, setAllCycleRows] = useState<UserCycleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  // On mount: load policies from admin API + all balance items
  useEffect(() => {
    const init = async () => {
      setLoadingPolicies(true);
      try {
        const [adminResp, balanceItems] = await Promise.all([
          timeOffAdminService.getPolicies({ page: 1, limit: 50 }).catch(() => null),
          fetchAllBalanceItems(),
        ]);

        setAllBalanceItems(balanceItems);

        const adminItems: any[] = adminResp?.items || adminResp?.data || [];
        let opts: PolicyOption[] = [];

        if (adminItems.length > 0) {
          opts = adminItems
            .filter((p: any) => p.id && p.name)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              policyTypeId: String(p.policyType?.id || ''),
              peopleAmount: p.peopleAmount ?? 0,
            }));
        }

        if (opts.length === 0) {
          const seen = new Set<number>();
          for (const item of balanceItems) {
            const id = item.policy?.id;
            const name = item.policy?.name;
            const policyTypeId = String(item.policy?.policyType?.id || '');
            if (id && name && policyTypeId && !seen.has(id)) {
              seen.add(id);
              opts.push({ id, name, policyTypeId, peopleAmount: 0 });
            }
          }
        }

        setPolicies(opts);
        if (opts.length > 0) setSelectedPolicy(opts[0]);
      } finally {
        setLoadingPolicies(false);
      }
    };
    init();
  }, []);

  // Load report data when policy or year changes
  useEffect(() => {
    if (!selectedPolicy || allBalanceItems.length === 0) return;
    setLoading(true);
    setRows([]);
    setAllCycleRows([]);

    const policyId = selectedPolicy.id;
    const policyTypeId = selectedPolicy.policyTypeId;

    const policyItems = allBalanceItems.filter((item) => item.policy?.id === policyId);

    const usersMap = new Map<number, string>();
    for (const item of policyItems) {
      const uid = item.user?.id || item.userId;
      const name = [item.user?.firstName, item.user?.lastName].filter(Boolean).join(' ');
      if (uid && name) usersMap.set(uid, name);
    }

    (async () => {
      const reportRows: ReportRow[] = [];
      const cycleRows: UserCycleRow[] = [];

      await Promise.all(
        Array.from(usersMap.entries()).map(async ([uid, name]) => {
          try {
            const evResp = await timeOffClientService.getEvents(policyTypeId, { userId: uid, limit: 200 });
            const evts: any[] = evResp?.items || evResp?.data || evResp || [];

            const { yearBuckets, cycleDates } = processEventsWithFIFO(evts);

            // Build report row for the selected year
            const yearData = yearBuckets.get(selectedYear);
            const acredited = yearData?.acredited ?? 0;
            const used = yearData?.used ?? 0;
            const expired = yearData?.expired ?? 0;
            const balance = acredited - used - expired;
            reportRows.push({ userId: uid, name, acredited, used, expired, balance });

            // Build cycle rows for Excel (all years)
            const sortedYrs = Array.from(yearBuckets.keys()).sort();
            for (const yr of sortedYrs) {
              const b = yearBuckets.get(yr)!;
              const dates = cycleDates.get(yr) || { startDate: `${yr}-01-01`, endDate: `${yr}-12-31` };
              const bal = b.acredited - b.used - b.expired;
              cycleRows.push({
                userId: uid,
                name,
                year: yr,
                startDate: dates.startDate,
                endDate: dates.endDate,
                currentBalance: bal,
              });
            }
          } catch {
            reportRows.push({ userId: uid, name, acredited: 0, used: 0, expired: 0, balance: 0 });
          }
        })
      );

      setRows(reportRows.sort((a, b) => a.name.localeCompare(b.name)));
      setAllCycleRows(cycleRows.sort((a, b) => a.name.localeCompare(b.name) || a.year.localeCompare(b.year)));
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [selectedPolicy, selectedYear, allBalanceItems]);

  // Excel export — one row per user per cycle
  const handleExportExcel = useCallback(() => {
    if (allCycleRows.length === 0 || !selectedPolicy) return;

    const policyName = selectedPolicy.name;

    const formatDate = (d: string) => {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return d;
      return `${m[3]}/${m[2]}/${m[1].substring(2)}`;
    };

    const excelRows = allCycleRows.map((r) => ({
      id: r.userId,
      Usuario: r.name,
      Política: policyName,
      startDate: formatDate(r.startDate),
      endDate: formatDate(r.endDate),
      currentBalance: r.currentBalance,
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 },  // id
      { wch: 30 },  // Usuario
      { wch: 25 },  // Política
      { wch: 12 },  // startDate
      { wch: 12 },  // endDate
      { wch: 16 },  // currentBalance
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría de Saldos');
    XLSX.writeFile(wb, `Auditoria_Saldos_${policyName.replace(/\s+/g, '_')}.xlsx`);
  }, [allCycleRows, selectedPolicy]);

  const avgBalance = rows.length ? rows.reduce((s, r) => s + r.balance, 0) / rows.length : 0;
  const lowBalance = rows.filter((r) => r.balance >= 0 && r.balance < 3).length;
  const negativeBalance = rows.filter((r) => r.balance < 0).length;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          Auditoría de Saldos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Reportes descargables de saldos diferenciados por año y política.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Política"
            value={selectedPolicy?.id ?? ''}
            onChange={(e) => {
              const found = policies.find((p) => p.id === Number(e.target.value));
              setSelectedPolicy(found ?? null);
            }}
            sx={{ minWidth: 220 }}
            select
            disabled={loadingPolicies || policies.length === 0}
          >
            {policies.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Año"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            sx={{ minWidth: 100 }}
            select
          >
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Total empleados
            </Typography>
            <Typography variant="h2" color="primary.main">
              {selectedPolicy?.peopleAmount ?? rows.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Saldo promedio
            </Typography>
            <Typography variant="h2" color="info.main">
              {avgBalance.toFixed(1)} días
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Saldo bajo (&lt;3)
            </Typography>
            <Typography variant="h2" color="warning.main">
              {lowBalance}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Saldo negativo
            </Typography>
            <Typography variant="h2" color="error.main">
              {negativeBalance}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {negativeBalance > 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          Hay {negativeBalance} empleado(s) con saldo negativo. Revisá los adelantos de días.
        </Alert>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Usuarios</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Acreditado</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Usado</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Vencido</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Saldo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {selectedPolicy ? 'Sin datos para el período seleccionado' : 'Seleccioná una política'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((emp) => (
                    <TableRow key={emp.userId} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{emp.name}</TableCell>
                      <TableCell align="right" sx={{ color: '#1CA332' }}>
                        {emp.acredited.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#E74444' }}>
                        {emp.used.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#F0B623' }}>
                        {emp.expired.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {emp.balance.toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        {emp.balance < 0 ? (
                          <Chip label="Negativo" size="small" color="error" />
                        ) : emp.balance < 3 ? (
                          <Chip label="Bajo" size="small" color="warning" />
                        ) : (
                          <Chip label="OK" size="small" color="success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportExcel}
          disabled={allCycleRows.length === 0}
        >
          Descargar Excel
        </Button>
        <Tooltip title="Próximamente disponible" arrow>
          <span>
            <Button variant="outlined" startIcon={<AiIcon />} disabled>
              Analizar tendencias
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default Reports;
