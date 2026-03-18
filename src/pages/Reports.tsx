import { useState } from 'react';
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
} from '@mui/material';
import {
  SmartToy as AiIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const mockReport = [
  { name: 'Ana García', acredited: 15.0, used: 8.0, expired: 2.0, balance: 5.0 },
  { name: 'Carlos López', acredited: 21.0, used: 14.0, expired: 0, balance: 7.0 },
  { name: 'María Ruiz', acredited: 15.0, used: 3.0, expired: 0, balance: 12.0 },
  { name: 'Pedro Martínez', acredited: 21.0, used: 20.0, expired: 0, balance: 1.0 },
  { name: 'Laura Sánchez', acredited: 15.0, used: 16.0, expired: 0, balance: -1.0 },
  { name: 'Diego Torres', acredited: 15.0, used: 2.0, expired: 0, balance: 13.0 },
  { name: 'Sofía Morales', acredited: 28.0, used: 10.0, expired: 3.0, balance: 15.0 },
  { name: 'Matías Herrera', acredited: 15.0, used: 12.0, expired: 0, balance: 3.0 },
];

const Reports = () => {
  const [policy] = useState('vacaciones_colombia');
  const [year] = useState('2026');

  const avgBalance = mockReport.reduce((s, e) => s + e.balance, 0) / mockReport.length;
  const lowBalance = mockReport.filter((e) => e.balance < 3 && e.balance >= 0).length;
  const negativeBalance = mockReport.filter((e) => e.balance < 0).length;

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
          <TextField size="small" label="Política" value={policy} sx={{ minWidth: 220 }} select>
            <MenuItem value="vacaciones_colombia">Vacaciones Colombia</MenuItem>
            <MenuItem value="vacaciones_argentina">Vacaciones Argentina</MenuItem>
          </TextField>
          <TextField size="small" label="Año" value={year} sx={{ minWidth: 100 }} select>
            <MenuItem value="2025">2025</MenuItem>
            <MenuItem value="2026">2026</MenuItem>
          </TextField>
          <TextField size="small" label="Vista" value="por_empleado" sx={{ minWidth: 150 }} select>
            <MenuItem value="por_empleado">Por empleado</MenuItem>
            <MenuItem value="resumen">Resumen</MenuItem>
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
              {mockReport.length}
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
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Empleado</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Acreditado</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Usado</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Vencido</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Saldo</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockReport.map((emp) => (
                <TableRow key={emp.name} hover>
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />}>
          Descargar Excel
        </Button>
        <Button variant="outlined" startIcon={<PdfIcon />}>
          Descargar PDF
        </Button>
        <Button variant="outlined" startIcon={<AiIcon />}>
          Analizar tendencias
        </Button>
      </Box>
    </Box>
  );
};

export default Reports;
