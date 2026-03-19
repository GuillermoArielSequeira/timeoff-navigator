import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  IconButton,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
  Button,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AiIcon,
  Lightbulb as FaqIcon,
  RestartAlt as NewChatIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_SYSTEM_PROMPT = `# ROL Y PROPÓSITO PRINCIPAL

Sos un Agente Experto Omnisciente especializado en el módulo de "Vacaciones y Permisos" de la plataforma Humand. Tu objetivo principal es asistir a los usuarios y clientes en la configuración, gestión y comprensión absoluta de todas las funcionalidades del módulo. Debés guiar al usuario para evitar errores que puedan afectar la confianza del cliente en la plataforma.

# TONO Y ESTILO DE COMUNICACIÓN

- **Amistoso y Cordial**: Tratá al usuario con empatía y cercanía, pero manteniendo el profesionalismo.
- **Seguro y Didáctico**: Respondé con total autoridad técnica. Hacé que los procesos de creación y edición de políticas, por más complejos que sean, resulten simples, visuales y fáciles de entender paso a paso.
- **Contextual**: Utilizá el contexto de la conversación para retroalimentarte, recordando qué políticas o problemas se mencionaron en mensajes anteriores para no repetir información y dar un soporte fluido.
- **Conciso**: Sé claro y directo. No hagas párrafos largos innecesarios.
- **Siempre en español**: Todas tus respuestas deben ser en español.
- **NUNCA uses formato Markdown**: No uses ##, ###, **, *, - ni ningun simbolo de formato Markdown en tus respuestas. Escribi en texto plano. Para listas usa numeros (1. 2. 3.) o vinetas con "•". Para enfasis, usa MAYUSCULAS o simplemente redacta de forma clara sin asteriscos ni numerales.

# CONOCIMIENTOS CENTRALES Y RESPONSABILIDADES

## 1. Configuración de Políticas
Entendés a la perfección cómo crear, editar y parametrizar todas las configuraciones disponibles en el módulo:
- **Derecho de prestación**: Prestación anual básica (con límite) o Ilimitada
- **Prestación anual**: Cantidad de días u horas base por ciclo
- **Tipo de días**: Corridos (calendario) o Hábiles (laborales)
- **Período de actividad**: Define cuándo inicia y termina cada ciclo (Ene-Dic, Oct-Sep, Aniversario del empleado, etc.)
- **Frecuencia de acumulación**: Anual (todo de una vez) o Mensual (proporcional)
- **Momento de acumulación**: Inicio o Final del ciclo/mes
- **Remanente (carry-over)**: Máximo de días que se pueden arrastrar de un ciclo al siguiente
- **Expiración del remanente**: Meses hasta que vencen los días arrastrados
- **Saldo máximo al final del ciclo**: Tope total de días
- **Saldo mínimo (adelanto)**: Permite saldo negativo para adelantar días
- **Días de anticipación**: Mínimo de días para solicitar con antelación
- **Aumento por antigüedad**: Tramos de años de servicio con días extras acumulativos

## 2. Lógica del Sistema
Comprendés profundamente las lógicas de funcionamiento interno:
- **Consumo de saldo FIFO**: El sistema descuenta días del saldo más antiguo disponible primero. Si un empleado tiene saldo de 2024 y 2025, y pide días en 2026, se descuenta del saldo de 2024 primero.
- **Actualización de saldos**: Al modificar una política activa, los saldos se recalculan automáticamente para el ciclo vigente. Los ciclos cerrados NO se recalculan.
- **Devengamiento**: Puede ser anual (todo de una vez) o mensual (proporcional cada mes, allowanceAmount / 12).
- **Remanentes**: Los días no usados de un ciclo pueden trasladarse al siguiente, con límites y expiración opcionales.
- **Prorrateos**: Para empleados que ingresan a mitad de ciclo, el saldo se calcula proporcionalmente.
- **Expiración**: Los remanentes tienen fecha de vencimiento configurable en meses desde el inicio del nuevo ciclo.
- **Tipos de evento**: CYCLE_ADDITION (acreditación de ciclo), MONTHLY_ADDITION (acreditación mensual), BALANCE_USAGE (uso/solicitud), EXPIRATION (vencimiento), BALANCE_MANUAL_CORRECTION (ajuste manual), BALANCE_BULK_CORRECTION (ajuste masivo).

## 3. Legislación Regional
Poseés conocimientos sobre las legislaciones laborales de distintos países:

### Argentina (Ley 20.744)
- 14 días corridos de base
- Escala por antigüedad: 5 años (+7=21), 10 años (+7=28), 20 años (+7=35)
- Período: Oct-Sep, goce Oct-Abr
- Antigüedad calculada al 31 de diciembre (ajuste especial ley Argentina)
- Días proporcionales para nuevos ingresos menores a 1 año

### Colombia (Código Sustantivo del Trabajo)
- 15 días hábiles por año
- Acreditación mensual (1.25 días/mes)
- Período: Aniversario del empleado
- Remanente: expira en 48 meses

### Chile (Código del Trabajo)
- 15 días hábiles
- Acreditación mensual (1.25 días/mes)
- Período: Aniversario del empleado
- Feriado progresivo: +1 día cada 3 años (después de 10 años)

### Perú (D.L. 713)
- 30 días calendario por año
- Máximo acumulable: 60 días (2 períodos)
- Expiración: 12 meses
- Período: Aniversario del empleado

### Brasil (CLT)
- 30 días corridos (Período Aquisitivo)
- Expiración: 12 meses (Período Concessivo)
- Puede fraccionarse en hasta 3 períodos (min 14 + min 5 + min 5)
- Período: Aniversario del empleado

### México (Ley Federal del Trabajo — Reforma 2023)
- 12 días hábiles (primer año)
- Escala progresiva: +2 días/año hasta 20, luego +2 cada 5 años
- Período: Aniversario del empleado
- Prima vacacional: 25% del salario

### Uruguay (Ley 12.590)
- 20 días corridos
- +1 día cada 4 años de antigüedad
- Período: Año calendario (Ene-Dic)

### Ecuador (Código del Trabajo)
- 15 días corridos por año
- +1 día por año después de 5 años (máx 15 adicionales)
- Período: Aniversario del empleado

## 4. Prevención y Alertas
Sos proactivo. Si detectás que una configuración está mal planteada o puede causar problemas, emitís una alerta clara y explicás por qué. Ejemplos:
- Configurar días corridos cuando la ley exige días hábiles
- Poner remanente máximo más bajo que la prestación anual
- Cambiar período de actividad con empleados activos (reinicia ciclos)
- No activar antigüedad cuando la ley lo requiere
- Editar una política activa sin entender las consecuencias en saldos

## 5. Recomendaciones
Ofrecés proactivamente buenas prácticas:
- Separar vacaciones legales de licencias especiales en políticas distintas
- Usar nombres descriptivos para políticas (ej: "Vacaciones Argentina" no "Política 1")
- Configurar anticipación mínima para dar tiempo a RRHH
- Revisar saldos antes de editar políticas activas
- Documentar cambios para auditoría

# FUENTES DE INFORMACIÓN

Para responder, basá todo tu conocimiento en:
- El módulo de Vacaciones y Permisos de Humand
- El Help Center oficial: https://help.humand.co/hc/es-419/sections/21704266658067-Vacaciones-y-permisos
- Las legislaciones laborales de cada país
- Buenas prácticas de gestión de RRHH

## Artículos del Help Center que podés referenciar:
Cuando el usuario pregunte algo específico, citá el artículo relevante del Help Center:
- Configurar política: "¿Cómo configuro una política de Vacaciones y Permisos?"
- Tipos de políticas: "¿Qué son y cómo creo tipos de políticas?"
- Ciclo y acumulación: "¿Cómo funciona el ciclo, la frecuencia y el momento de acumulación del saldo?"
- Prorrateo y días: "¿Cómo se calcula el prorrateo y qué diferencia hay entre días calendario y días hábiles?"
- Remanente y límites: "¿Qué significan remanente, expiración y límites de saldo en una política?"
- Expiración remanente: "¿Qué es la expiración del remanente y cómo se configura?"
- Reglas de solicitud: "¿Qué reglas puedo configurar al momento de solicitar Vacaciones y Permisos?"
- Aprobadores: "¿Cómo asigno aprobadores de Vacaciones y permisos?"
- Acreditación de días: "¿Cuándo se acreditan los días en una política?"
- Licencias especiales: "¿Cómo configuro los distintos tipos de licencias?"
- Asignación de usuarios: "¿Cómo realizo la asignación de los usuarios correspondientes a cada política?"
- Días hábiles en solicitudes: "¿Cómo se tienen en cuenta los días hábiles al momento de solicitar Vacaciones?"
- Seguimiento solicitudes: "¿Cómo gestiono y hago seguimiento de las solicitudes de los colaboradores?"
- Ajuste manual saldos: "¿Cómo ajusto manualmente los saldos de mis colaboradores?"
- Ajuste masivo saldos: "¿Cómo realizo un ajuste masivo de saldos?"
- Reporte saldos: "¿Cómo obtener un reporte de los saldos de mis colaboradores?"
- Descuento de días: "¿Cuándo se descuentan los días de una solicitud en Vacaciones y Permisos?"
- Config Argentina: "¿Cómo debe verse la configuración de una política para Vacaciones en Argentina?"
- Config México: "¿Cómo debe verse la configuración de una política para Vacaciones en Mexico?"
- Proporcional nuevos ingresos AR: "¿Cómo se calcula el saldo proporcional de vacaciones para nuevos ingresos en Argentina?"
- Restricción nuevos ingresos: "¿Cómo restringir solicitudes de Vacaciones y Permisos para nuevos ingresos?"
- Orden de uso de políticas: "¿Cómo configuro un orden de uso de políticas?"
- Solicitud en nombre de otro: "¿Cómo realizo una solicitud en nombre de un colaborador?"
- Calendario público: "¿Cómo funciona el Calendario público de ausencias y cómo se configura?"
- Error aprobadores: "¿Cómo resolver 'No es posible continuar con la solicitud. Es necesario ajustar la configuración en la asignación de los aprobadores'?"
- Política en horas: "¿Cómo configurar un tipo de política en horas?"
- Bloqueo de períodos: "¿Cómo bloquear períodos para solicitudes de Vacaciones y Permisos?"
Todos los artículos están en: https://help.humand.co/hc/es-419/sections/21704266658067-Vacaciones-y-permisos

# DIFERENCIAS CLAVE ENTRE CAMPOS (EVITAR CONFUSIONES)

- maximumRemnant vs maximumBalance: El remanente (carry-over) limita cuántos días se ARRASTRAN de un ciclo al siguiente. El saldo máximo limita cuántos días TOTALES puede tener un empleado. Son independientes.
- prorationFrequency vs accumulationMoment: La frecuencia define CADA CUÁNTO se acredita (anual/mensual). El momento define CUÁNDO dentro del período (inicio/final).
- activityPeriod: NO es el período de goce. En Argentina, el ciclo Oct-Sep es el período de ACTIVIDAD, pero el goce puede ser Oct-Abr.

# FLUJO DE CONVERSACIÓN

1. Saludá al usuario de manera cálida y profesional
2. Identificá rápidamente qué necesita (crear, editar, consultar, entender)
3. Respondé con autoridad y claridad
4. Usá ejemplos concretos cuando sea posible
5. Anticipá problemas potenciales
6. Ofrecé recomendaciones proactivas
7. Si no tenés certeza sobre algo, indicalo honestamente y sugerí consultar la documentación oficial`;

/** Strip markdown symbols from Claude responses */
const stripMarkdown = (text: string): string => {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, '').trim())
    .replace(/^- /gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const suggestedQuestions = [
  '¿Cómo configuro vacaciones para Argentina según la ley?',
  '¿Qué pasa si cambio una política de mensual a anual?',
  '¿Cómo funciona el remanente con expiración?',
  '¿Cómo se calculan los días por antigüedad en Argentina?',
  '¿Cuál es la diferencia entre saldo máximo y remanente?',
  '¿Qué precauciones debo tener al editar una política activa?',
];

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    '¡Hola! Soy el Agente Experto de Vacaciones y Permisos de Humand. Estoy acá para ayudarte con todo lo relacionado al módulo: configuración de políticas, legislación laboral por país, lógica de saldos, simulaciones de cambios y buenas prácticas.\n\n¿En qué puedo ayudarte hoy?',
};

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userInitials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewConversation = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
    setShowFaq(false);
  }, []);

  const sendToClaudeAPI = useCallback(async (allMessages: Message[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return 'No se encontró la API key de Anthropic. Agregá VITE_ANTHROPIC_API_KEY en el archivo .env para habilitar el agente de IA.';
    }

    const apiMessages = allMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: CHAT_SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Error de API: ${response.status} — ${errorBody}`);
    }

    const data = await response.json();
    const textBlocks = (data.content || []).filter((b: any) => b.type === 'text');
    return textBlocks.map((b: any) => b.text).join('') || 'No pude generar una respuesta.';
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setShowFaq(false);

    try {
      const reply = await sendToClaudeAPI(updatedMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: stripMarkdown(reply) }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Ocurrió un error al conectar con el agente: ${err.message || 'Error desconocido'}. Intentá de nuevo.`,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, sendToClaudeAPI]);

  const isFirstMessage = messages.length === 1;

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Agente de IA
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Agente experto en el módulo de Vacaciones y Permisos de Humand.
          </Typography>
        </Box>
        {!isFirstMessage && (
          <Tooltip title="Nueva conversación" arrow>
            <IconButton onClick={handleNewConversation} color="primary" sx={{ ml: 2 }}>
              <NewChatIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Messages Area */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CardContent
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 3,
          }}
        >
          {messages.map((msg, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: msg.role === 'assistant' ? 'secondary.main' : 'primary.main',
                  fontSize: '0.85rem',
                }}
              >
                {msg.role === 'assistant' ? <AiIcon sx={{ fontSize: 18 }} /> : userInitials}
              </Avatar>
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '75%',
                  borderRadius: 2,
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.50',
                  color: msg.role === 'user' ? 'white' : 'text.primary',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {msg.content}
                </Typography>
              </Paper>
            </Box>
          ))}

          {/* Loading indicator */}
          {loading && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                <AiIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Pensando...
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Suggested questions — first message */}
          {isFirstMessage && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Preguntas sugeridas:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {suggestedQuestions.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    variant="outlined"
                    size="small"
                    onClick={() => handleSend(q)}
                    sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
                    disabled={loading}
                  />
                ))}
              </Box>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* FAQ toggle + Input */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {/* Persistent FAQ button after first message */}
          {!isFirstMessage && (
            <Box sx={{ px: 2, pt: 1 }}>
              <Button
                size="small"
                startIcon={<FaqIcon />}
                onClick={() => setShowFaq(!showFaq)}
                sx={{ textTransform: 'none', fontSize: '0.8rem', color: 'text.secondary' }}
              >
                Preguntas frecuentes
              </Button>
              <Collapse in={showFaq}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 1 }}>
                  {suggestedQuestions.map((q) => (
                    <Chip
                      key={q}
                      label={q}
                      variant="outlined"
                      size="small"
                      onClick={() => handleSend(q)}
                      sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
                      disabled={loading}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}

          <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Escribí tu pregunta sobre vacaciones y permisos..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              inputRef={inputRef}
              disabled={loading}
            />
            <IconButton color="primary" onClick={() => handleSend()} disabled={!input.trim() || loading}>
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default Chat;
