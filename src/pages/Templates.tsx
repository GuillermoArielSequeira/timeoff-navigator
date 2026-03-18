import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PlayArrow as UseIcon } from '@mui/icons-material';

const templates = [
  {
    country: '🇦🇷 Argentina',
    flag: '🇦🇷',
    name: 'Vacaciones Argentina',
    color: '#75AADB',
    config: {
      'Prestación': '14/21/28/35 días según antigüedad',
      'Tipo días': 'Días corridos',
      'Frecuencia': 'Anual',
      'Período': 'Año calendario',
      'Momento': 'Inicio del ciclo',
      'Ley especial': 'Sí (Ley Argentina)',
    },
    sandboxConfig: {
      allowanceAmount: 14,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'CALENDAR_DAYS',
      prorationFrequency: 'EVERY_TWELVE_MONTHS',
      activityPeriod: 'JAN_DEC',
      accumulationMoment: 'START_OF_CYCLE',
      maximumRemnant: null,
      remnantExpirationValue: null,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
  {
    country: '🇨🇴 Colombia',
    flag: '🇨🇴',
    name: 'Vacaciones Colombia',
    color: '#FCD116',
    config: {
      'Prestación': '15 días hábiles (CST)',
      'Tipo días': 'Solo días laborales',
      'Frecuencia': 'Mensual (1.25/mes)',
      'Período': 'Fecha de aniversario',
      'Momento': 'Final del ciclo',
      'Remanente': '24-48 meses',
    },
    sandboxConfig: {
      allowanceAmount: 15,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'BUSINESS_DAYS',
      prorationFrequency: 'EVERY_ONE_MONTH',
      activityPeriod: 'EMPLOYEE_ANNIVERSARY',
      accumulationMoment: 'END_OF_CYCLE',
      maximumRemnant: null,
      remnantExpirationValue: 48,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
  {
    country: '🇨🇱 Chile',
    flag: '🇨🇱',
    name: 'Feriado Legal Chile',
    color: '#D52B1E',
    config: {
      'Prestación': '15 días hábiles',
      'Tipo días': 'Solo laborales (sábado inhábil)',
      'Frecuencia': 'Mensual (1.25/mes)',
      'Período': 'Fecha de aniversario',
      'Antigüedad': 'Feriado Progresivo (+1 día/3 años)',
      'Mín. goce': '10 días continuos',
    },
    sandboxConfig: {
      allowanceAmount: 15,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'BUSINESS_DAYS',
      prorationFrequency: 'EVERY_ONE_MONTH',
      activityPeriod: 'EMPLOYEE_ANNIVERSARY',
      accumulationMoment: 'START_OF_CYCLE',
      maximumRemnant: null,
      remnantExpirationValue: null,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
  {
    country: '🇵🇪 Perú',
    flag: '🇵🇪',
    name: 'Vacaciones Perú (D.L. 713)',
    color: '#D91023',
    config: {
      'Prestación': '30 días calendario',
      'Tipo días': 'Días calendario',
      'Frecuencia': 'Anual',
      'Período': 'Fecha de aniversario',
      'Remanente': '30-60 días máx.',
      'Expiración': '12 meses',
    },
    sandboxConfig: {
      allowanceAmount: 30,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'CALENDAR_DAYS',
      prorationFrequency: 'EVERY_TWELVE_MONTHS',
      activityPeriod: 'EMPLOYEE_ANNIVERSARY',
      accumulationMoment: 'START_OF_CYCLE',
      maximumRemnant: 60,
      remnantExpirationValue: 12,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
  {
    country: '🇧🇷 Brasil',
    flag: '🇧🇷',
    name: 'Vacaciones Brasil (CLT)',
    color: '#009C3B',
    config: {
      'Prestación': '30 días corridos',
      'Tipo días': 'Días calendario',
      'Frecuencia': 'Anual',
      'Período': 'Fecha aniversario (Aquisitivo)',
      'Expiración': '12 meses (Concesivo)',
      'Mín. fracción': '5 días',
    },
    sandboxConfig: {
      allowanceAmount: 30,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'CALENDAR_DAYS',
      prorationFrequency: 'EVERY_TWELVE_MONTHS',
      activityPeriod: 'EMPLOYEE_ANNIVERSARY',
      accumulationMoment: 'START_OF_CYCLE',
      maximumRemnant: null,
      remnantExpirationValue: 12,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
  {
    country: '🇲🇽 México',
    flag: '🇲🇽',
    name: 'Vacaciones México (LFT)',
    color: '#006341',
    config: {
      'Prestación': '12-24+ días (progresivo)',
      'Tipo días': 'Días laborales',
      'Frecuencia': 'Anual',
      'Período': 'Fecha de aniversario',
      'Antigüedad': 'Escala LFT 2023+',
      'Prima vacacional': '25% del salario',
    },
    sandboxConfig: {
      allowanceAmount: 12,
      allowanceType: 'BASIC_ANNUAL',
      countingMethod: 'BUSINESS_DAYS',
      prorationFrequency: 'EVERY_TWELVE_MONTHS',
      activityPeriod: 'EMPLOYEE_ANNIVERSARY',
      accumulationMoment: 'START_OF_CYCLE',
      maximumRemnant: null,
      remnantExpirationValue: null,
      minimumBalance: 0,
      allowHalfDayRequests: false,
      minimumAdvanceDays: 0,
    },
  },
];

const Templates = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h1" gutterBottom>
          Templates por País
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Plantillas pre-configuradas basadas en legislación laboral. Seleccioná un país para
          cargar su configuración en el Sandbox.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {templates.map((tpl) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={tpl.country}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: `4px solid ${tpl.color}`,
              }}
            >
              <CardContent sx={{ flex: 1, p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h3">{tpl.country}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {tpl.name}
                </Typography>

                <Table size="small">
                  <TableBody>
                    {Object.entries(tpl.config).map(([key, value]) => (
                      <TableRow key={key} sx={{ '& td': { border: 0, py: 0.5, px: 0 } }}>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {key}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={value}
                            size="small"
                            sx={{ fontSize: '0.7rem', height: 22, maxWidth: '100%' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<UseIcon />}
                  onClick={() => navigate('/sandbox', { state: { templateConfig: tpl.sandboxConfig } })}
                  sx={{
                    bgcolor: tpl.color,
                    '&:hover': { bgcolor: tpl.color, filter: 'brightness(0.9)' },
                  }}
                >
                  Usar en Sandbox
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Templates;
