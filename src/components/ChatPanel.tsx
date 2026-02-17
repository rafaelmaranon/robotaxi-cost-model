import React, { useState } from 'react';

interface ChatPanelProps {
  simState: any;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ simState }) => {
  const [userMessage, setUserMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getSessionId = () => {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  const handleSend = async () => {
    if (!userMessage.trim()) return;
    
    setLoading(true);
    setError('');
    setReply('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: getSessionId(),
          userMessage,
          simState,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'An error occurred');
        return;
      }

      setReply(data.reply);
      setUserMessage('');
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderReply = (reply: string) => {
    if (reply.startsWith('missing:')) {
      return <div className="text-red-600">{reply}</div>;
    }

    const bullets = reply.split(/\n-\s+/).filter(item => item.trim());
    if (bullets.length > 1) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {bullets.map((bullet, index) => (
            <li key={index} className="text-sm">{bullet.trim()}</li>
          ))}
        </ul>
      );
    }

    return <div className="text-sm">{reply}</div>;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">AI Assistant</h3>
      
      <div className="space-y-2">
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Ask about your robotaxi economics..."
          className="w-full p-2 border border-gray-300 rounded-md resize-none h-20"
          disabled={loading}
        />
        
        <button
          onClick={handleSend}
          disabled={loading || !userMessage.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {reply && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          {renderReply(reply)}
        </div>
      )}
    </div>
  );
};
