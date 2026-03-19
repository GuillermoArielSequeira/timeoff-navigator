import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Chip,
  Button,
  Divider,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Circle as DotIcon,
} from '@mui/icons-material';
import { timeOffClientService } from '../services/timeOffService';

interface UserOption {
  id: number;
  name: string;
}

interface PolicyOption {
  id: number;
  name: string;
  policyTypeId: number | null;
}

interface TimelineEvent {
  displayDate: string;    // Date to show in UI (event creation date)
  displayTime: string;    // Time HH:mm
  originalDate: string;   // Raw date from API
  eventId: number;        // For sorting by creation order
  type: string;
  operation: string;
  label: string;
  observations: string | null;
  amount: number;
  runningBalance: number;
  vacationRange: string | null; // For BALANCE_USAGE: "25 mar - 31 mar"
  cyclePeriod: string | null;   // Cycle label: "18/03/26 — 30/09/26"
}

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

const getTypeConfig = (ev: TimelineEvent) => {
  // For BALANCE_MANUAL_CORRECTION, use operation to determine color
  if (ev.type === 'BALANCE_MANUAL_CORRECTION') {
    if (ev.operation === 'SUBTRACTION') {
      return { color: '#886BFF', label: 'Corrección' };
    }
    return { color: '#886BFF', label: 'Corrección' };
  }
  return typeConfig[ev.type] || typeConfig.ADDITION;
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

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Format date correctly avoiding timezone offset issues.
 * Parses ISO string directly without new Date() to prevent timezone shift.
 */
const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${parseInt(day, 10).toString().padStart(2, '0')} de ${MONTHS_ES[parseInt(month, 10) - 1]} de ${year}`;
  }
  return dateStr;
};

/**
 * Format a short date range for vacation display: "25 mar - 31 mar"
 */
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

/**
 * Get today's date as YYYYMMDD number for comparison
 */
const getTodayNum = (): number => {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
};

const getDateNum = (dateStr: string): number => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 10000 + parseInt(match[2]) * 100 + parseInt(match[3]);
};

const isDateToday = (dateStr: string): boolean => getDateNum(dateStr) === getTodayNum();
const isDatePast = (dateStr: string): boolean => getDateNum(dateStr) < getTodayNum();

/**
 * Format a cycle period: "18/03/26 — 30/09/26"
 */
const formatCyclePeriod = (fromStr: string, toStr: string): string => {
  const fMatch = fromStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const tMatch = toStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!fMatch || !tMatch) return '';
  const fYear = fMatch[1].slice(2); // "2026" → "26"
  const tYear = tMatch[1].slice(2);
  return `${fMatch[3]}/${fMatch[2]}/${fYear} — ${tMatch[3]}/${tMatch[2]}/${tYear}`;
};

/**
 * Extract time from an ISO timestamp as local time: "HH:MM"
 */
const extractLocalTime = (isoStr: string): string => {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Determine the real event date for display.
 * For BALANCE_USAGE events, the API `date` is the vacation start date,
 * not when the event was created. We infer creation date from surrounding events.
 */
const getEventDisplayDate = (ev: any, allEvents: any[]): string => {
  const type = ev.type || '';
  const evDate = ev.date || '';

  if (type === 'BALANCE_USAGE') {
    const evId = ev.id || 0;
    let closestDate = '';
    let closestDiff = Infinity;
    for (const other of allEvents) {
      if (other.id === evId) continue;
      if (other.type === 'BALANCE_USAGE') continue;
      const diff = Math.abs((other.id || 0) - evId);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestDate = other.date || '';
      }
    }
    if (closestDate) return closestDate;
    // Fallback to today
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`;
  }

  return evDate;
};

const Timeline = () => {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [filteredPolicies, setFilteredPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Search users as they type
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const data = await timeOffClientService.getBalancesReport({ search: query, limit: 50 });
      const items = data.items || data.data || [];
      // Group by user to get unique users
      const userMap = new Map<number, UserOption>();
      items.forEach((item: any) => {
        const userId = item.user?.id ?? item.userId;
        if (!userId) return;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            name: `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim(),
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

  // When user is selected, fetch their assigned policies via balances endpoint
  useEffect(() => {
    if (!selectedUser) {
      setFilteredPolicies([]);
      setSelectedPolicy('');
      setEvents([]);
      return;
    }

    const fetchUserPolicies = async () => {
      setLoadingPolicies(true);
      try {
        // Use balances endpoint searching by user name, then filter by userId
        // This gives us only the policies actually assigned to this user
        const nameParts = selectedUser.name.split(' ');
        const searchTerm = nameParts[nameParts.length - 1] || nameParts[0]; // Use last name for better filtering
        const data = await timeOffClientService.getBalancesReport({
          search: searchTerm,
          limit: 100,
        });
        const items = data.items || data.data || [];

        // Filter by exact userId and collect unique policies
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
    setEvents([]);
  }, [selectedUser]);

  // Fetch events when user + policy selected
  useEffect(() => {
    if (!selectedUser || !selectedPolicy) {
      setEvents([]);
      return;
    }

    const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
        const policy = filteredPolicies.find((p) => String(p.id) === selectedPolicy);
        const policyTypeId = policy?.policyTypeId ?? selectedPolicy;
        const data = await timeOffClientService.getEvents(String(policyTypeId), {
          userId: selectedUser.id,
          limit: 100,
        });
        const items = data.items || data.data || data.events || [];

        // Sort by ID ascending — this is the real creation order
        items.sort((a: any, b: any) => (a.id || 0) - (b.id || 0));

        // Extract cycle info from CYCLE_ADDITION events
        let cyclePeriod: string | null = null;
        for (const ev of items) {
          if (ev.type === 'CYCLE_ADDITION' && ev.customData?.fromDateCycle && ev.customData?.toDateCycle) {
            cyclePeriod = formatCyclePeriod(ev.customData.fromDateCycle, ev.customData.toDateCycle);
            break;
          }
        }

        // If no cycle found from events, try fetching cycles from API
        if (!cyclePeriod) {
          try {
            const cyclesData = await timeOffClientService.getCycles(String(policyTypeId));
            const cycles = cyclesData.items || [];
            if (cycles.length > 0) {
              const c = cycles[0];
              cyclePeriod = formatCyclePeriod(c.fromDate, c.toDate);
            }
          } catch { /* ignore */ }
        }

        // Fetch real timestamps for BALANCE_USAGE events (from request details)
        const requestTimestamps = new Map<number, string>();
        const balanceUsageEvents = items.filter((ev: any) => ev.type === 'BALANCE_USAGE' && ev.customData?.requestId);
        await Promise.all(
          balanceUsageEvents.map(async (ev: any) => {
            try {
              const reqData = await timeOffClientService.getRequest(ev.customData.requestId);
              // Use the latest approval date or createdAt as the real event timestamp
              const realTime = reqData.secondApprovalDate || reqData.firstApprovalDate || reqData.createdAt;
              if (realTime) {
                requestTimestamps.set(ev.id, realTime);
              }
            } catch { /* ignore - will fallback to inferred date */ }
          })
        );

        // Calculate running balance progressively and build display dates
        let runningBalance = 0;
        const mapped: TimelineEvent[] = items.map((ev: any) => {
          const operation = ev.operation || '';
          const amount = ev.amount ?? ev.value ?? 0;

          // Apply amount to running balance based on operation
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

          // Get the real display date and time
          let displayDateStr: string;
          let displayTime: string;

          if (ev.type === 'BALANCE_USAGE' && requestTimestamps.has(ev.id)) {
            // BALANCE_USAGE: use real approval timestamp from request
            const realTimestamp = requestTimestamps.get(ev.id)!;
            displayDateStr = realTimestamp;
            displayTime = extractLocalTime(realTimestamp);
          } else if (ev.type === 'BALANCE_USAGE') {
            // Fallback: infer date from nearby events
            displayDateStr = getEventDisplayDate(ev, items);
            displayTime = '--:--';
          } else {
            // For non-BALANCE_USAGE events: date is the creation date
            displayDateStr = ev.date || '';

            // Check if the time is actually midnight UTC (meaning no real time tracked)
            const timeMatch = (ev.date || '').match(/T(\d{2}):(\d{2}):(\d{2})/);
            const isUtcMidnight = timeMatch &&
              parseInt(timeMatch[1]) === 0 &&
              parseInt(timeMatch[2]) === 0 &&
              parseInt(timeMatch[3]) <= 1; // 00:00:00 or 00:00:01 = ordering hint, not real time

            if (ev.type === 'CYCLE_ADDITION' || ev.type === 'MONTHLY_ADDITION') {
              // Automatic system events: always at cycle/month start
              displayTime = '00:00';
            } else if (isUtcMidnight) {
              // Corrections with UTC midnight: no real time available
              displayTime = '--:--';
            } else {
              displayTime = extractLocalTime(ev.date || '');
            }
          }

          // For BALANCE_USAGE, build vacation date range info
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
            operation: operation,
            label: getReadableLabel(ev),
            observations: ev.observations || ev.customData?.observations || null,
            amount: amount,
            runningBalance: Math.round(runningBalance * 100) / 100,
            vacationRange,
            cyclePeriod,
          };
        });

        // Post-process: replace '--:--' with the nearest event's real time
        const realTimes = mapped
          .filter((e) => e.displayTime !== '--:--' && e.displayTime !== '00:00')
          .map((e) => e.displayTime);
        const defaultTime = realTimes.length > 0 ? realTimes[realTimes.length - 1] : '00:00';

        const final = mapped.map((e) => {
          if (e.displayTime === '--:--') {
            // Find closest event by index that has a real time
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

        setEvents(final);
      } catch {
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedUser, selectedPolicy, filteredPolicies]);

  const today = new Date();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          Timeline de Eventos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Visualizá la secuencia cronológica de eventos de un empleado, con proyección a 1 año.
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
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          {!selectedUser || !selectedPolicy ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography variant="h6" color="text.secondary">
                Seleccioná un usuario y una política para ver el timeline de eventos.
              </Typography>
            </Box>
          ) : loadingEvents ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Cargando eventos...
              </Typography>
            </Box>
          ) : events.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography variant="h6" color="text.secondary">
                No se encontraron eventos para este usuario y política.
              </Typography>
            </Box>
          ) : (
            events.map((event, index) => {
              const config = getTypeConfig(event);
              const eventIsToday = isDateToday(event.displayDate);
              const isPast = isDatePast(event.displayDate);

              // Determine displayed amount with correct sign
              const signedAmount = event.operation === 'SUBTRACTION' ? -event.amount : event.amount;
              const amountStr = signedAmount >= 0 ? `+${signedAmount}` : `${signedAmount}`;

              // Build observation text
              const obsText = event.observations ? ` — ${event.observations}` : '';

              // Show vacation range for BALANCE_USAGE
              const rangeText = event.vacationRange ? ` (${event.vacationRange})` : '';

              // Show TODAY marker before first event of today
              const prevEvent = index > 0 ? events[index - 1] : null;
              const showTodayMarker = eventIsToday && (!prevEvent || !isDateToday(prevEvent.displayDate));

              return (
                <Box key={event.eventId || index}>
                  {/* Today marker */}
                  {showTodayMarker && (
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                      <Divider sx={{ flex: 1, borderColor: 'primary.main', borderStyle: 'dashed' }} />
                      <Chip
                        label={`HOY — ${today.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        size="small"
                        color="primary"
                        sx={{ mx: 2, fontWeight: 600 }}
                      />
                      <Divider sx={{ flex: 1, borderColor: 'primary.main', borderStyle: 'dashed' }} />
                    </Box>
                  )}

                  {/* Event row */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      py: 1.5,
                      opacity: isPast && !eventIsToday ? 0.75 : 1,
                    }}
                  >
                    {/* Timeline dot + line */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: 24,
                        pt: 0.5,
                      }}
                    >
                      <DotIcon sx={{ fontSize: 14, color: config.color }} />
                      {index < events.length - 1 && (
                        <Box
                          sx={{
                            width: 2,
                            height: 32,
                            bgcolor: 'divider',
                            mt: 0.5,
                          }}
                        />
                      )}
                    </Box>

                    {/* Date + Time + Cycle */}
                    <Box sx={{ minWidth: 140, pt: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {formatDate(event.displayDate)} — {event.displayTime}hs
                      </Typography>
                      {event.cyclePeriod && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.6rem', lineHeight: 1.3 }}>
                          Ciclo: {event.cyclePeriod}
                        </Typography>
                      )}
                    </Box>

                    {/* Event content */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {amountStr} días
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          — {event.label}{rangeText}{obsText}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Saldo: <strong>{event.runningBalance}</strong> días
                      </Typography>
                    </Box>

                    {/* Type chip */}
                    <Chip
                      size="small"
                      label={config.label}
                      sx={{
                        bgcolor: `${config.color}15`,
                        color: config.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                </Box>
              );
            })
          )}
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />}>
            Exportar timeline
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Timeline;
