import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Chip,
  Paper,
  Button,
  Grid,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { timeOffClientService } from '../services/timeOffService';

// ---- Shared types ----

interface UserOption {
  id: number;
  name: string;
  hiringDate: string | null;
}

interface PolicyOption {
  id: number;
  name: string;
  policyTypeId: number | null;
}

interface LogEvent {
  displayDate: string;
  displayTime: string;
  originalDate: string;
  eventId: number;
  type: string;
  operation: string;
  label: string;
  observations: string | null;
  amount: number;
  runningBalance: number;
  vacationRange: string | null;
  cyclePeriod: string | null;
  year: number;         // Extracted year for filtering
  typeCategory: string; // Normalized category for filtering
}

// ---- Type config (same as Timeline) ----

const typeConfig: Record<string, { color: string; label: string }> = {
  ADDITION: { color: '#1CA332', label: 'Acreditación' },
  CYCLE_ADDITION: { color: '#1CA332', label: 'Acreditación' },
  MONTHLY_ADDITION: { color: '#1CA332', label: 'Acreditación' },
  BALANCE_USAGE: { color: '#E74444', label: 'Consumo' },
  SUBTRACTION: { color: '#E74444', label: 'Consumo' },
  REQUEST_SUBTRACTION: { color: '#E74444', label: 'Consumo' },
  EXPIRATION: { color: '#F0B623', label: 'Vencimiento' },
  REMNANT_EXPIRATION: { color: '#F0B623', label: 'Vencimiento' },
  CORRECTION: { color: '#886BFF', label: 'Corrección' },
  BALANCE_MANUAL_CORRECTION: { color: '#886BFF', label: 'Corrección' },
  BALANCE_CORRECTION: { color: '#886BFF', label: 'Corrección' },
  POLICY_CYCLE_ALLOWANCE_AMOUNT_CHANGE: { color: '#1CA332', label: 'Acreditación' },
};

const getTypeConfig = (ev: LogEvent) => {
  if (ev.type === 'BALANCE_MANUAL_CORRECTION') {
    return { color: '#886BFF', label: 'Corrección' };
  }
  return typeConfig[ev.type] || typeConfig.ADDITION;
};

/** Map raw event types to filterable categories */
const getTypeCategory = (type: string): string => {
  switch (type) {
    case 'ADDITION':
    case 'CYCLE_ADDITION':
    case 'MONTHLY_ADDITION':
    case 'POLICY_CYCLE_ALLOWANCE_AMOUNT_CHANGE':
      return 'ADDITION';
    case 'BALANCE_USAGE':
    case 'SUBTRACTION':
    case 'REQUEST_SUBTRACTION':
      return 'SUBTRACTION';
    case 'EXPIRATION':
    case 'REMNANT_EXPIRATION':
      return 'EXPIRATION';
    case 'CORRECTION':
    case 'BALANCE_MANUAL_CORRECTION':
    case 'BALANCE_CORRECTION':
      return 'CORRECTION';
    default:
      return 'ADDITION';
  }
};

const getReadableLabel = (ev: any): string => {
  const type = ev.type || '';
  switch (type) {
    case 'CYCLE_ADDITION': return 'Acreditación de ciclo';
    case 'MONTHLY_ADDITION': return 'Acreditación mensual';
    case 'ADDITION': return 'Acreditación';
    case 'BALANCE_USAGE': {
      const reqId = ev.customData?.requestId;
      return `Solicitud${reqId ? ` #${reqId}` : ''} - Aprobada`;
    }
    case 'SUBTRACTION':
    case 'REQUEST_SUBTRACTION': {
      const reqId = ev.customData?.requestId || ev.requestId;
      return `Solicitud${reqId ? ` #${reqId}` : ''} - Aprobada`;
    }
    case 'EXPIRATION':
    case 'REMNANT_EXPIRATION': return 'Vencimiento de remanente';
    case 'CORRECTION':
    case 'BALANCE_MANUAL_CORRECTION':
    case 'BALANCE_CORRECTION': return 'Corrección manual de saldo';
    case 'POLICY_CYCLE_ALLOWANCE_AMOUNT_CHANGE': return 'Ajuste de prestación del ciclo';
    default: return type.replace(/_/g, ' ').toLowerCase();
  }
};

// ---- Date helpers (same as Timeline, avoid timezone issues) ----

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${parseInt(day, 10).toString().padStart(2, '0')} de ${MONTHS_ES[parseInt(month, 10) - 1]} de ${year}`;
  }
  return dateStr;
};

const formatShortDateRange = (fromStr: string, toStr: string): string => {
  const fMatch = fromStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const tMatch = toStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!fMatch || !tMatch) return '';
  const fromDay = parseInt(fMatch[3], 10);
  const fromMonth = MONTHS_ES[parseInt(fMatch[2], 10) - 1];
  const toDay = parseInt(tMatch[3], 10);
  const toMonth = MONTHS_ES[parseInt(tMatch[2], 10) - 1];
  return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}`;
};

const formatCyclePeriod = (fromStr: string, toStr: string): string => {
  const fMatch = fromStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const tMatch = toStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!fMatch || !tMatch) return '';
  const fYear = fMatch[1].slice(2);
  const tYear = tMatch[1].slice(2);
  return `${fMatch[3]}/${fMatch[2]}/${fYear} — ${tMatch[3]}/${tMatch[2]}/${tYear}`;
};

const extractLocalTime = (isoStr: string): string => {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const extractYear = (dateStr: string): number => {
  const match = dateStr.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : new Date().getFullYear();
};

/**
 * Calculate the current cycle period from the employee's hiring date.
 * For EMPLOYEE_ANNIVERSARY policies, the cycle runs from one anniversary to the next.
 */
const computeCycleFromHiringDate = (hiringDate: string): { fromDate: string; toDate: string } | null => {
  const match = hiringDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const hireMonth = parseInt(match[2], 10) - 1; // 0-indexed
  const hireDay = parseInt(match[3], 10);
  const now = new Date();

  // Find the last anniversary
  const lastAnniversary = new Date(now.getFullYear(), hireMonth, hireDay);
  if (lastAnniversary > now) {
    lastAnniversary.setFullYear(lastAnniversary.getFullYear() - 1);
  }

  // Next anniversary = last + 1 year
  const nextAnniversary = new Date(lastAnniversary);
  nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fromDate = `${lastAnniversary.getFullYear()}-${pad(lastAnniversary.getMonth() + 1)}-${pad(lastAnniversary.getDate())}`;
  const toDate = `${nextAnniversary.getFullYear()}-${pad(nextAnniversary.getMonth() + 1)}-${pad(nextAnniversary.getDate())}`;

  return { fromDate, toDate };
};

/**
 * Infer the real creation date for events whose `date` field is a reference date
 * (e.g. cycle date, vacation start date) rather than the actual creation date.
 * Finds the closest event by ID that has a real (non-midnight-UTC) timestamp.
 */
const getEventDisplayDate = (ev: any, allEvents: any[]): string => {
  const evId = ev.id || 0;

  // Types whose date IS the real date (system events at cycle/month boundaries)
  const reliableDateTypes = ['CYCLE_ADDITION', 'MONTHLY_ADDITION'];

  // Look for the nearest event (by ID) that has a reliable, non-UTC-midnight date
  let closestDate = '';
  let closestDiff = Infinity;
  for (const other of allEvents) {
    if (other.id === evId) continue;

    // Only consider events with reliable dates
    const otherType = other.type || '';
    const otherDate = other.date || '';
    const otherTimeMatch = otherDate.match(/T(\d{2}):(\d{2}):(\d{2})/);
    const otherIsUtcMidnight = otherTimeMatch &&
      parseInt(otherTimeMatch[1]) === 0 &&
      parseInt(otherTimeMatch[2]) === 0 &&
      parseInt(otherTimeMatch[3]) <= 1;

    // Accept: events with real timestamps OR system events (CYCLE_ADDITION, MONTHLY_ADDITION)
    const hasReliableDate = !otherIsUtcMidnight || reliableDateTypes.includes(otherType);
    if (!hasReliableDate) continue;

    const diff = Math.abs((other.id || 0) - evId);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestDate = otherDate;
    }
  }

  if (closestDate) return closestDate;

  // Fallback to today
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`;
};

// ---- Component ----

const EventLog = () => {
  // User search
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Policy
  const [filteredPolicies, setFilteredPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterYear, setFilterYear] = useState<string>('todos');

  // Events
  const [allEvents, setAllEvents] = useState<LogEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // ---- Search users (same as Timeline) ----
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const data = await timeOffClientService.getBalancesReport({ search: query, limit: 50 });
      const items = data.items || data.data || [];
      const userMap = new Map<number, UserOption>();
      items.forEach((item: any) => {
        const userId = item.user?.id ?? item.userId;
        if (!userId) return;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            name: `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim(),
            hiringDate: item.user?.hiringDate ?? null,
          });
        }
      });
      setUsers(Array.from(userMap.values()));
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput) searchUsers(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, searchUsers]);

  // ---- Fetch user policies (same as Timeline) ----
  useEffect(() => {
    if (!selectedUser) {
      setFilteredPolicies([]);
      setSelectedPolicy('');
      setAllEvents([]);
      return;
    }

    const fetchUserPolicies = async () => {
      setLoadingPolicies(true);
      try {
        const nameParts = selectedUser.name.split(' ');
        const searchTerm = nameParts[nameParts.length - 1] || nameParts[0];
        const data = await timeOffClientService.getBalancesReport({
          search: searchTerm,
          limit: 100,
        });
        const items = data.items || data.data || [];

        const policyMap = new Map<number, PolicyOption>();
        items.forEach((item: any) => {
          const userId = item.user?.id ?? item.userId;
          if (userId !== selectedUser.id) return;
          const policyId = item.policy?.id;
          if (!policyId || policyMap.has(policyId)) return;
          policyMap.set(policyId, {
            id: policyId,
            name: item.policy?.name || `Política ${policyId}`,
            policyTypeId: item.policy?.policyType?.id ?? item.policyTypeId ?? null,
          });
        });

        const unique = Array.from(policyMap.values());
        setFilteredPolicies(unique);
        if (unique.length === 1) {
          setSelectedPolicy(String(unique[0].id));
        } else {
          setSelectedPolicy('');
        }
      } catch {
        setFilteredPolicies([]);
      } finally {
        setLoadingPolicies(false);
      }
    };

    fetchUserPolicies();
    setAllEvents([]);
  }, [selectedUser]);

  // ---- Fetch events (same logic as Timeline) ----
  useEffect(() => {
    if (!selectedUser || !selectedPolicy) {
      setAllEvents([]);
      return;
    }

    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const policy = filteredPolicies.find((p) => String(p.id) === selectedPolicy);
        const policyTypeId = policy?.policyTypeId ?? selectedPolicy;
        // Fetch all events with pagination to get full history
        let allItems: any[] = [];
        let page = 1;
        const pageSize = 200;
        let hasMore = true;
        while (hasMore) {
          const data = await timeOffClientService.getEvents(String(policyTypeId), {
            userId: selectedUser.id,
            limit: pageSize,
            page,
          });
          const pageItems = data.items || data.data || data.events || [];
          allItems = allItems.concat(pageItems);
          // Stop if we got fewer items than the page size (last page) or after 5 pages max
          if (pageItems.length < pageSize || page >= 5) {
            hasMore = false;
          } else {
            page++;
          }
        }
        const items = allItems;

        // Sort by ID ascending (creation order)
        items.sort((a: any, b: any) => (a.id || 0) - (b.id || 0));

        // Extract cycle info — check multiple sources
        let cyclePeriod: string | null = null;

        // 1. getPolicyTypeDetail with userId — returns cycle based on employee hire date
        if (!cyclePeriod) {
          try {
            const policyDetail = await timeOffClientService.getPolicyTypeDetail(String(policyTypeId), selectedUser.id);
            const cycle = policyDetail?.currentCycle || policyDetail?.cycle || policyDetail?.activeCycle;
            if (cycle?.fromDate && cycle?.toDate) {
              cyclePeriod = formatCyclePeriod(cycle.fromDate, cycle.toDate);
            }
            if (!cyclePeriod && policyDetail?.balance?.cycle?.fromDate && policyDetail?.balance?.cycle?.toDate) {
              cyclePeriod = formatCyclePeriod(policyDetail.balance.cycle.fromDate, policyDetail.balance.cycle.toDate);
            }
            if (!cyclePeriod && Array.isArray(policyDetail?.cycles) && policyDetail.cycles.length > 0) {
              const c = policyDetail.cycles[0];
              if (c.fromDate && c.toDate) {
                cyclePeriod = formatCyclePeriod(c.fromDate, c.toDate);
              }
            }
          } catch { /* ignore */ }
        }

        // 2. Check CYCLE_ADDITION events
        if (!cyclePeriod) {
          for (const ev of items) {
            if (ev.type === 'CYCLE_ADDITION' && ev.customData?.fromDateCycle && ev.customData?.toDateCycle) {
              cyclePeriod = formatCyclePeriod(ev.customData.fromDateCycle, ev.customData.toDateCycle);
              break;
            }
          }
        }

        // 3. Check ANY event's customData for cycle info
        if (!cyclePeriod) {
          for (const ev of items) {
            const cd = ev.customData || {};
            if (cd.fromDateCycle && cd.toDateCycle) {
              cyclePeriod = formatCyclePeriod(cd.fromDateCycle, cd.toDateCycle);
              break;
            }
            if (cd.cycle?.fromDate && cd.cycle?.toDate) {
              cyclePeriod = formatCyclePeriod(cd.cycle.fromDate, cd.cycle.toDate);
              break;
            }
          }
        }

        // 4. Try the cycles API endpoint
        if (!cyclePeriod) {
          try {
            const cyclesData = await timeOffClientService.getCycles(String(policyTypeId));
            const cycles = cyclesData.items || cyclesData.data || cyclesData || [];
            const cyclesArr = Array.isArray(cycles) ? cycles : [];
            if (cyclesArr.length > 0) {
              const c = cyclesArr[0];
              if (c.fromDate && c.toDate) {
                cyclePeriod = formatCyclePeriod(c.fromDate, c.toDate);
              }
            }
          } catch { /* ignore */ }
        }

        // 5. Try fetching projected balance which may include cycle info
        if (!cyclePeriod) {
          try {
            const projData = await timeOffClientService.getProjectedBalance(String(policyTypeId), selectedUser.id);
            const cycle = projData?.cycle || projData?.currentCycle;
            if (cycle?.fromDate && cycle?.toDate) {
              cyclePeriod = formatCyclePeriod(cycle.fromDate, cycle.toDate);
            }
          } catch { /* ignore */ }
        }

        // 6. Compute cycle from employee hiring date (anniversary-based policies: Colombia, Mexico)
        if (!cyclePeriod && selectedUser.hiringDate) {
          const computed = computeCycleFromHiringDate(selectedUser.hiringDate);
          if (computed) {
            cyclePeriod = formatCyclePeriod(computed.fromDate, computed.toDate);
          }
        }

        // Fetch real timestamps for BALANCE_USAGE
        const requestTimestamps = new Map<number, string>();
        const balanceUsageEvents = items.filter((ev: any) => ev.type === 'BALANCE_USAGE' && ev.customData?.requestId);
        await Promise.all(
          balanceUsageEvents.map(async (ev: any) => {
            try {
              const reqData = await timeOffClientService.getRequest(ev.customData.requestId);
              const realTime = reqData.secondApprovalDate || reqData.firstApprovalDate || reqData.createdAt;
              if (realTime) {
                requestTimestamps.set(ev.id, realTime);
              }
            } catch { /* ignore */ }
          })
        );

        // Build events with running balance
        let runningBalance = 0;
        const mapped: LogEvent[] = items.map((ev: any) => {
          const operation = ev.operation || '';
          const amount = ev.amount ?? ev.value ?? 0;

          if (operation === 'ADDITION') {
            runningBalance += amount;
          } else if (operation === 'SUBTRACTION') {
            runningBalance -= amount;
          } else {
            const type = ev.type || '';
            if (type.includes('ADDITION') || type === 'CYCLE_ADDITION' || type === 'MONTHLY_ADDITION') {
              runningBalance += amount;
            } else {
              runningBalance -= amount;
            }
          }

          // Display date & time (same logic as Timeline)
          let displayDateStr: string;
          let displayTime: string;

          if (ev.type === 'BALANCE_USAGE' && requestTimestamps.has(ev.id)) {
            const realTimestamp = requestTimestamps.get(ev.id)!;
            displayDateStr = realTimestamp;
            displayTime = extractLocalTime(realTimestamp);
          } else if (ev.type === 'BALANCE_USAGE') {
            displayDateStr = getEventDisplayDate(ev, items);
            displayTime = '--:--';
          } else {
            const timeMatch = (ev.date || '').match(/T(\d{2}):(\d{2}):(\d{2})/);
            const isUtcMidnight = timeMatch &&
              parseInt(timeMatch[1]) === 0 &&
              parseInt(timeMatch[2]) === 0 &&
              parseInt(timeMatch[3]) <= 1;

            if (ev.type === 'CYCLE_ADDITION' || ev.type === 'MONTHLY_ADDITION') {
              // System events: date IS the cycle/month date, keep it
              displayDateStr = ev.date || '';
              displayTime = '00:00';
            } else if (isUtcMidnight) {
              // UTC midnight = date is a reference date (cycle date), NOT the creation date
              // Infer real creation date from nearby events by ID
              displayDateStr = getEventDisplayDate(ev, items);
              displayTime = '--:--';
            } else {
              // Real timestamp with actual time
              displayDateStr = ev.date || '';
              displayTime = extractLocalTime(ev.date || '');
            }
          }

          let vacationRange: string | null = null;
          if (ev.type === 'BALANCE_USAGE' && ev.customData?.from?.date && ev.customData?.to?.date) {
            vacationRange = formatShortDateRange(ev.customData.from.date, ev.customData.to.date);
          }

          return {
            displayDate: displayDateStr,
            displayTime,
            originalDate: ev.date || '',
            eventId: ev.id || 0,
            type: ev.type || ev.eventType || 'ADDITION',
            operation,
            label: getReadableLabel(ev),
            observations: ev.observations || ev.customData?.observations || null,
            amount,
            runningBalance: Math.round(runningBalance * 100) / 100,
            vacationRange,
            cyclePeriod,
            year: extractYear(ev.date || displayDateStr),
            typeCategory: getTypeCategory(ev.type || ''),
          };
        });

        // Post-process: replace '--:--' with nearest event's real time
        const realTimes = mapped
          .filter((e) => e.displayTime !== '--:--' && e.displayTime !== '00:00')
          .map((e) => e.displayTime);
        const defaultTime = realTimes.length > 0 ? realTimes[realTimes.length - 1] : '00:00';

        const final = mapped.map((e) => {
          if (e.displayTime === '--:--') {
            const idx = mapped.indexOf(e);
            let closest = defaultTime;
            let minDist = Infinity;
            for (let i = 0; i < mapped.length; i++) {
              if (mapped[i].displayTime !== '--:--' && mapped[i].displayTime !== '00:00') {
                const dist = Math.abs(i - idx);
                if (dist < minDist) {
                  minDist = dist;
                  closest = mapped[i].displayTime;
                }
              }
            }
            return { ...e, displayTime: closest };
          }
          return e;
        });

        setAllEvents(final);
      } catch {
        setAllEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedUser, selectedPolicy, filteredPolicies]);

  // ---- Available years from events ----
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allEvents.forEach((e) => years.add(e.year));
    return Array.from(years).sort((a, b) => b - a); // newest first
  }, [allEvents]);

  // ---- Filtered events ----
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (filterType !== 'todos' && e.typeCategory !== filterType) return false;
      if (filterYear !== 'todos' && e.year !== parseInt(filterYear, 10)) return false;
      return true;
    });
  }, [allEvents, filterType, filterYear]);

  // ---- Summary stats (from filtered events) ----
  const totals = useMemo(() => {
    const acc = { acredited: 0, consumed: 0, expired: 0, corrected: 0 };
    filteredEvents.forEach((e) => {
      const cat = e.typeCategory;
      if (cat === 'ADDITION') acc.acredited += e.amount;
      if (cat === 'SUBTRACTION') acc.consumed += e.amount;
      if (cat === 'EXPIRATION') acc.expired += e.amount;
      if (cat === 'CORRECTION') {
        if (e.operation === 'SUBTRACTION') {
          acc.corrected -= e.amount;
        } else {
          acc.corrected += e.amount;
        }
      }
    });
    return acc;
  }, [filteredEvents]);

  const currentBalance = filteredEvents.length > 0
    ? filteredEvents[filteredEvents.length - 1].runningBalance
    : 0;

  // Reset filters when events reload
  useEffect(() => {
    setFilterType('todos');
    setFilterYear('todos');
  }, [selectedUser, selectedPolicy]);

  // ---- Export to Excel ----
  const handleExportExcel = useCallback(() => {
    if (filteredEvents.length === 0) return;

    const typeLabels: Record<string, string> = {
      ADDITION: 'Acreditación', CYCLE_ADDITION: 'Acreditación', MONTHLY_ADDITION: 'Acreditación',
      BALANCE_USAGE: 'Consumo', SUBTRACTION: 'Consumo', REQUEST_SUBTRACTION: 'Consumo',
      EXPIRATION: 'Vencimiento', REMNANT_EXPIRATION: 'Vencimiento',
      CORRECTION: 'Corrección', BALANCE_MANUAL_CORRECTION: 'Corrección', BALANCE_CORRECTION: 'Corrección',
      POLICY_CYCLE_ALLOWANCE_AMOUNT_CHANGE: 'Acreditación',
    };

    // Build rows matching the table columns
    const rows = filteredEvents.map((e) => {
      const signedAmount = e.operation === 'SUBTRACTION' ? -e.amount : e.amount;
      const rangeText = e.vacationRange ? ` (${e.vacationRange})` : '';
      const obsText = e.observations ? ` — ${e.observations}` : '';

      return {
        Usuario: selectedUser?.name || '',
        UserId: selectedUser?.id || '',
        Fecha: formatDate(e.displayDate),
        Ciclo: e.cyclePeriod || '',
        Hora: `${e.displayTime}hs`,
        Tipo: typeLabels[e.type] || e.type,
        Descripción: `${e.label}${rangeText}${obsText}`,
        Monto: signedAmount,
        Saldo: e.runningBalance,
      };
    });

    // Add summary row at the bottom
    rows.push({} as any); // empty separator row
    rows.push({
      Usuario: '',
      UserId: '' as any,
      Fecha: 'RESUMEN',
      Ciclo: '',
      Hora: '',
      Tipo: '',
      Descripción: `Acreditado: +${totals.acredited.toFixed(2)} | Consumido: -${totals.consumed.toFixed(2)} | Vencido: -${totals.expired.toFixed(2)} | Corrección: ${totals.corrected >= 0 ? '+' : ''}${totals.corrected.toFixed(2)}`,
      Monto: '' as any,
      Saldo: currentBalance,
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 22 }, // Fecha
      { wch: 20 }, // Ciclo
      { wch: 10 }, // Hora
      { wch: 14 }, // Tipo
      { wch: 55 }, // Descripción
      { wch: 12 }, // Monto
      { wch: 12 }, // Saldo
    ];

    const wb = XLSX.utils.book_new();
    const userName = selectedUser?.name?.replace(/\s+/g, '_') || 'usuario';
    const policyName = filteredPolicies.find(p => String(p.id) === selectedPolicy)?.name?.replace(/\s+/g, '_') || 'politica';
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `Log_Movimientos_${userName}_${policyName}.xlsx`);
  }, [filteredEvents, totals, currentBalance, selectedUser, selectedPolicy, filteredPolicies]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          Log de Movimientos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Detalle de todos los eventos en el saldo de un usuario específico.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Autocomplete
            options={users}
            getOptionLabel={(option) => option.name}
            value={selectedUser}
            onChange={(_e, newValue) => setSelectedUser(newValue)}
            onInputChange={(_e, value) => setSearchInput(value)}
            loading={loadingUsers}
            noOptionsText={searchInput.length < 2 ? 'Escribí al menos 2 caracteres' : 'No se encontraron usuarios'}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ minWidth: 250 }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Usuario"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingUsers ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <TextField
            size="small"
            label="Política"
            value={selectedPolicy}
            onChange={(e) => setSelectedPolicy(e.target.value)}
            sx={{ minWidth: 250 }}
            select
            disabled={!selectedUser || loadingPolicies}
          >
            {loadingPolicies && (
              <MenuItem value="" disabled>
                Cargando políticas...
              </MenuItem>
            )}
            {!loadingPolicies && filteredPolicies.length === 0 && (
              <MenuItem value="" disabled>
                {selectedUser ? 'Sin políticas asignadas' : 'Seleccioná un usuario primero'}
              </MenuItem>
            )}
            {filteredPolicies.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Tipo evento"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            sx={{ minWidth: 150 }}
            select
            disabled={allEvents.length === 0}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="ADDITION">Acreditación</MenuItem>
            <MenuItem value="SUBTRACTION">Consumo</MenuItem>
            <MenuItem value="EXPIRATION">Vencimiento</MenuItem>
            <MenuItem value="CORRECTION">Corrección</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Año"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            sx={{ minWidth: 100 }}
            select
            disabled={allEvents.length === 0}
          >
            <MenuItem value="todos">Todos</MenuItem>
            {availableYears.map((y) => (
              <MenuItem key={y} value={String(y)}>
                {y}
              </MenuItem>
            ))}
          </TextField>
        </CardContent>
      </Card>

      {/* Summary */}
      {filteredEvents.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Acreditado', value: `+${totals.acredited.toFixed(2)}`, color: '#1CA332' },
            { label: 'Consumido', value: `-${totals.consumed.toFixed(2)}`, color: '#E74444' },
            { label: 'Vencido', value: `-${totals.expired.toFixed(2)}`, color: '#F0B623' },
            { label: 'Corrección', value: totals.corrected >= 0 ? `+${totals.corrected.toFixed(2)}` : `${totals.corrected.toFixed(2)}`, color: '#886BFF' },
            { label: 'Saldo actual', value: currentBalance.toFixed(2), color: '#496BE3' },
          ].map((item) => (
            <Grid size={{ xs: 6, sm: 2.4 }} key={item.label}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h4" sx={{ color: item.color, fontWeight: 700 }}>
                  {item.value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Table */}
      <Card>
        {!selectedUser || !selectedPolicy ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="h6" color="text.secondary">
              Seleccioná un usuario y una política para ver los movimientos.
            </Typography>
          </Box>
        ) : loadingEvents ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Cargando movimientos...
            </Typography>
          </Box>
        ) : filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="h6" color="text.secondary">
              No se encontraron movimientos para los filtros seleccionados.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hora</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Monto</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvents.map((event) => {
                  const config = getTypeConfig(event);
                  const signedAmount = event.operation === 'SUBTRACTION' ? -event.amount : event.amount;
                  const amountStr = signedAmount >= 0 ? `+${signedAmount.toFixed(2)}` : `${signedAmount.toFixed(2)}`;
                  const rangeText = event.vacationRange ? ` (${event.vacationRange})` : '';
                  const obsText = event.observations ? ` — ${event.observations}` : '';

                  return (
                    <TableRow key={event.eventId} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {formatDate(event.displayDate)}
                        </Typography>
                        {event.cyclePeriod && (
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.6rem' }}>
                            Ciclo: {event.cyclePeriod}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {event.displayTime}hs
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={config.label}
                          sx={{
                            bgcolor: `${config.color}15`,
                            color: config.color,
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {event.label}{rangeText}{obsText}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color: signedAmount >= 0 ? '#1CA332' : '#E74444',
                        }}
                      >
                        {amountStr}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {event.runningBalance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {filteredEvents.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportExcel}>
            Descargar Excel
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default EventLog;
