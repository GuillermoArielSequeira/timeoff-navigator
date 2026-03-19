import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
} from '@mui/material';
import { Add as CreateIcon, Edit as EditIcon } from '@mui/icons-material';

const Laboratory = () => {
  const navigate = useNavigate();

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
            <CardActionArea onClick={() => navigate('/laboratory/create')} sx={{ height: '100%', p: 3 }}>
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
            <CardActionArea onClick={() => navigate('/laboratory/edit')} sx={{ height: '100%', p: 3 }}>
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
};

export default Laboratory;
