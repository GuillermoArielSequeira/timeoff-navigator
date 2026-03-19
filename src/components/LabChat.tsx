import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Send as SendIcon, SmartToy as AiIcon } from '@mui/icons-material';

export interface ChatMessageDisplay {
  role: 'user' | 'assistant';
  content: string;
}

interface LabChatProps {
  messages: ChatMessageDisplay[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
}

const CREATE_SUGGESTIONS = [
  'Vacaciones para Argentina',
  'Vacaciones para Colombia',
  'Licencia por mudanza (5 días)',
  'Política ilimitada de días personales',
];

const EDIT_SUGGESTIONS = [
  'Quiero cambiar la cantidad de días',
  'Cambiar de acreditación anual a mensual',
  'Agregar expiración de remanente',
  'Permitir medio día',
];

const LabChat = ({ messages, onSendMessage, isLoading, mode }: LabChatProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = mode === 'create' ? CREATE_SUGGESTIONS : EDIT_SUGGESTIONS;
  const showSuggestions = messages.length <= 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h3" sx={{ mb: 2, flexShrink: 0 }}>
        🤖 Copiloto de Configuración
      </Typography>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          mb: 2,
          pr: 1,
        }}
      >
        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              gap: 1,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {msg.role === 'assistant' && (
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}>
                <AiIcon sx={{ fontSize: 18 }} />
              </Avatar>
            )}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                maxWidth: '85%',
                borderRadius: 2,
                bgcolor: msg.role === 'user' ? 'primary.main' : '#F0F4F8',
                color: msg.role === 'user' ? 'white' : 'text.primary',
              }}
            >
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {formatMessage(msg.content)}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}>
              <AiIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F0F4F8' }}>
              <CircularProgress size={18} />
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Suggestions */}
      {showSuggestions && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {suggestions.map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              variant="outlined"
              onClick={() => onSendMessage(s)}
              sx={{ cursor: 'pointer', fontSize: '0.75rem' }}
            />
          ))}
        </Box>
      )}

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Escribí tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          multiline
          maxRows={3}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          sx={{ alignSelf: 'flex-end' }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

/** Basic formatting: bold **text** and line breaks */
function formatMessage(text: string): string {
  return text;
}

export default LabChat;
