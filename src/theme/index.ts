import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#496BE3',
      light: '#7B93ED',
      dark: '#334FB3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#2DA8A4',
      light: '#5CBFBC',
      dark: '#1E7673',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#1CA332',
      light: '#4ED364',
      dark: '#148A27',
    },
    error: {
      main: '#E74444',
      light: '#EF6B6B',
      dark: '#C52D2D',
    },
    warning: {
      main: '#F0B623',
      light: '#F5CB5C',
      dark: '#B88B1A',
    },
    info: {
      main: '#30A2BC',
      light: '#6FD1E7',
      dark: '#1E7189',
    },
    background: {
      default: '#F4F5F7',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#172B4D',
      secondary: '#6B778C',
    },
    divider: '#E1E4E8',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600, lineHeight: 1.3 },
    h2: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 1px 3px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
        },
      },
    },
  },
});

export default theme;
