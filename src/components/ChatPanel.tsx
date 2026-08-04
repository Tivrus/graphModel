import { useEffect, useRef, useState } from 'react';
import { Bot, Eraser, SendHorizontal, Wifi, WifiOff, X } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';

export default function ChatPanel() {
  const chatOpen = useGraphStore((s) => s.chatOpen);
  const messages = useGraphStore((s) => s.chatMessages);
  const busy = useGraphStore((s) => s.chatBusy);
  const backendOnline = useGraphStore((s) => s.backendOnline);
  const backendAi = useGraphStore((s) => s.backendAi);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    void useGraphStore.getState().refreshBackendStatus();
  }, [chatOpen]);

  if (!chatOpen) return null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void useGraphStore.getState().sendChat(text);
  };

  const canSend = backendOnline && backendAi && !busy && !!draft.trim();

  return (
    <aside className="chat-panel panel">
      <header className="chat-head">
        <span className="chat-title">
          <Bot size={15} /> AI-ассистент
        </span>
        <span className="chat-head-actions">
          <span
            className={`chat-mode-badge ${backendOnline ? (backendAi ? 'on' : 'warn') : 'off'}`}
            title={
              backendOnline
                ? backendAi
                  ? 'Онлайн · AI готов'
                  : 'Backend онлайн, но AI_API_KEY не задан'
                : 'Локальный режим · backend не запущен'
            }
          >
            {backendOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {backendOnline ? (backendAi ? 'онлайн' : 'без AI') : 'локально'}
          </span>
          <button
            className="icon-btn"
            title="Очистить диалог"
            onClick={() => useGraphStore.getState().clearChat()}
          >
            <Eraser size={14} />
          </button>
          <button className="icon-btn" title="Закрыть" onClick={() => useGraphStore.getState().toggleChat()}>
            <X size={15} />
          </button>
        </span>
      </header>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && !busy && (
          <div className="chat-empty hint">
            {backendOnline && backendAi ? (
              <>
                Попросите построить граф: «нарисуй граф экосистемы стартапа», «добавь схему из 15
                узлов»… Ответ можно добавить к текущему графу или заменить его.
              </>
            ) : backendOnline ? (
              <>
                Backend запущен, но AI не настроен. Добавьте <code>AI_API_KEY</code> в{' '}
                <code>backend/.env</code> и перезапустите <code>npm run backend</code>.
              </>
            ) : (
              <>
                Сейчас <b>локальный режим</b> — граф и редактор работают без интернета, AI выключен.
                Для AI запустите backend: <code>npm run backend</code> (ключ только на сервере).
              </>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role} ${m.isError ? 'error' : ''}`}>
            <div className="chat-bubble">{m.text}</div>
            {m.graph && (
              <div className="chat-apply">
                <span className="hint">
                  граф: {m.graph.nodes.length} узлов · {m.graph.links.length} связей
                </span>
                <span className="chat-apply-btns">
                  <button
                    className="chip"
                    onClick={() => useGraphStore.getState().applyAiGraph(m.graph!, 'merge')}
                  >
                    Добавить к графу
                  </button>
                  <button
                    className="chip warn"
                    onClick={() => useGraphStore.getState().applyAiGraph(m.graph!, 'replace')}
                  >
                    Заменить граф
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-msg assistant">
            <div className="chat-bubble typing">думаю…</div>
          </div>
        )}
      </div>

      <div className="chat-input">
        <textarea
          rows={2}
          placeholder={
            backendOnline && backendAi
              ? 'Опишите граф или задайте вопрос…'
              : 'AI недоступен в локальном режиме…'
          }
          value={draft}
          disabled={!backendOnline || !backendAi}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="icon-btn send" title="Отправить (Enter)" disabled={!canSend} onClick={send}>
          <SendHorizontal size={16} />
        </button>
      </div>
    </aside>
  );
}
