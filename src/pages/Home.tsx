import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Science as SandboxIcon,
  Timeline as TimelineIcon,
  ListAlt as LogIcon,
  Assessment as ReportsIcon,
  Public as TemplatesIcon,
  SmartToy as AiIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { timeOffAdminService } from '../services/timeOffService';

const features = [
  {
    title: 'Sandbox de Políticas',
    description: 'Simulá cambios en políticas y visualizá el impacto en saldos antes de aplicarlos.',
    icon: <SandboxIcon sx={{ fontSize: 40 }} />,
    path: '/sandbox',
    color: '#496BE3',
    priority: 'Prioridad Máxima',
  },
  {
    title: 'Timeline de Eventos',
    description: 'Visualizá la línea de tiempo de un empleado con eventos pasados y proyectados.',
    icon: <TimelineIcon sx={{ fontSize: 40 }} />,
    path: '/timeline',
    color: '#2DA8A4',
  },
  {
    title: 'Log de Movimientos',
    description: 'Consultá el detalle de todos los movimientos de saldo de un empleado.',
    icon: <LogIcon sx={{ fontSize: 40 }} />,
    path: '/log',
    color: '#886BFF',
  },
  {
    title: 'Auditoría de Saldos',
    description: 'Reportes descargables de saldos diferenciados por año y política.',
    icon: <ReportsIcon sx={{ fontSize: 40 }} />,
    path: '/reports',
    color: '#F0B623',
  },
  {
    title: 'Templates por País',
    description: 'Plantillas pre-configuradas para AR, CO, CL, PE, BR y MX.',
    icon: <TemplatesIcon sx={{ fontSize: 40 }} />,
    path: '/templates',
    color: '#1CA332',
  },
  {
    title: 'Chat IA',
    description: 'Preguntale al agente sobre políticas, simulaciones y mejores prácticas.',
    icon: <AiIcon sx={{ fontSize: 40 }} />,
    path: '/chat',
    color: '#E74444',
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [policyCount, setPolicyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const policies = await timeOffAdminService.getPolicies({ limit: 1 });
        setPolicyCount(policies.count ?? policies.total ?? policies.items?.length ?? 0);
      } catch {
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          Hola, {user?.firstName} 👋
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
          Bienvenido a <strong>TimeOff Navigator</strong> — tu herramienta para diseñar, simular
          y entender políticas de vacaciones y permisos.
        </Typography>
      </Box>

      {/* Connection Status */}
      <Box sx={{ mb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Conectando con Humand API...
            </Typography>
          </Box>
        ) : apiError ? (
          <Alert severity="warning" sx={{ maxWidth: 500 }}>
            No se pudo conectar a la API de Humand. Algunas funciones pueden estar limitadas.
          </Alert>
        ) : (
          <Alert severity="success" sx={{ maxWidth: 500 }}>
            Conectado a <strong>JaguAir</strong> — {policyCount} política(s) de Time Off configuradas
          </Alert>
        )}
      </Box>

      {/* Feature Cards */}
      <Grid container spacing={2.5}>
        {features.map((feature) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={feature.path}>
            <Card
              sx={{
                height: '100%',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                },
              }}
            >
              <CardActionArea
                onClick={() => navigate(feature.path)}
                sx={{ height: '100%', p: 0 }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${feature.color}15`,
                        color: feature.color,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    {feature.priority && (
                      <Chip
                        label={feature.priority}
                        size="small"
                        sx={{
                          bgcolor: '#496BE315',
                          color: '#496BE3',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="h4" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Home;
