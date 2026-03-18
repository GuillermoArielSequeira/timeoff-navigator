import { useState } from 'react';
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
} from '@mui/material';
import { Send as SendIcon, SmartToy as AiIcon } from '@mui/icons-material';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const suggestedQuestions = [
  '¿Qué diferencias hay entre las vacaciones de Colombia y Chile?',
  '¿Qué pasa si cambio una política de mensual a anual?',
  '¿Cómo funciona el remanente con expiración?',
  '¿Cómo se calculan los días de vacaciones en Argentina por antigüedad?',
  '¿Qué es el Período Aquisitivo en Brasil?',
];

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy el asistente de TimeOff Navigator. Puedo ayudarte con consultas sobre políticas de vacaciones, simulaciones de cambios, legislación por país y mejores prácticas de configuración. ¿En qué puedo ayudarte?',
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulated AI response
    setTimeout(() => {
      const aiMsg: Message = {
        role: 'assistant',
        content: `Gracias por tu pregunta sobre "${input.slice(0, 50)}...".

Esta funcionalidad se conectará con Claude AI para darte respuestas precisas basadas en:
• La configuración actual de tus políticas en JaguAir
• La legislación laboral del país correspondiente
• Las mejores prácticas de implementación de Humand

Por ahora estamos en modo MVP. ¡Pronto tendrás respuestas completas!`,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h1" gutterBottom>
          Chat IA
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Preguntale al agente sobre políticas, simulaciones y legislación laboral.
        </Typography>
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
                {msg.role === 'assistant' ? <AiIcon sx={{ fontSize: 18 }} /> : 'G'}
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

          {/* Suggested questions */}
          {messages.length === 1 && (
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
                    onClick={() => {
                      setInput(q);
                    }}
                    sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Escribí tu pregunta sobre políticas de vacaciones..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <IconButton color="primary" onClick={handleSend} disabled={!input.trim()}>
            <SendIcon />
          </IconButton>
        </Box>
      </Card>
    </Box>
  );
};

export default Chat;
