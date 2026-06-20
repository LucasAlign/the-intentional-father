'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

interface Task {
  id: string;
  text: string;
  category: string;
  partial: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface JournalEntry {
  reflect: string;
  commit_text: string;
}

export default function TodayScreen() {
  const [verse, setVerse] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [journal, setJournal] = useState<JournalEntry>({ reflect: '', commit_text: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadInitialData() {
    try {
      const [verseRes, tasksRes, chatRes, journalRes] = await Promise.all([
        fetch('/api/verse'),
        fetch('/api/tasks'),
        fetch('/api/chat-history'),
        fetch('/api/journal'),
      ]);

      if (verseRes.ok) setVerse(await verseRes.text());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (chatRes.ok) {
        const msgs = await chatRes.json();
        setMessages(msgs);
      }
      if (journalRes.ok) {
        const data = await journalRes.json();
        setJournal(data || { reflect: '', commit_text: '' });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input;
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: userMsg },
          { role: 'assistant', content: data.message },
        ]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  }

  async function saveJournal() {
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journal),
      });
    } catch (error) {
      console.error('Failed to save journal:', error);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading Arlo...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>ARLO</h1>
        <p className={styles.tagline}>FOCUSED · FAITHFUL · FREE</p>
      </header>

      <main className={styles.main}>
        {/* Verse Card */}
        <div className={`${styles.card} ${styles.verseCard}`}>
          <div className={styles.cardContent}>
            <p className={styles.verseText}>{verse}</p>
          </div>
        </div>

        {/* Marriage Intention Card */}
        <div className={`${styles.card} ${styles.marriageCard}`}>
          <h3 className={styles.cardTitle}>Her</h3>
          <p className={styles.subtitle}>Today's intention</p>
          <input
            type="text"
            placeholder="What's your intention for your marriage today?"
            className={styles.input}
            value={journal.commit_text}
            onChange={(e) => setJournal((prev) => ({ ...prev, commit_text: e.target.value }))}
            onBlur={saveJournal}
          />
        </div>

        {/* Top 3 Priorities */}
        <div className={`${styles.card} ${styles.prioritiesCard}`}>
          <h3 className={styles.cardTitle}>Top 3</h3>
          <div className={styles.taskList}>
            {tasks.length === 0 ? (
              <p className={styles.noData}>No tasks for today</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className={styles.taskItem}>
                  <div className={styles.taskText}>
                    <p>{task.text}</p>
                    <span className={styles.category}>{task.category}</span>
                  </div>
                  {task.partial && <span className={styles.stuck}>80%</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily Reflection */}
        <div className={`${styles.card} ${styles.reflectCard}`}>
          <h3 className={styles.cardTitle}>Reflect</h3>
          <textarea
            placeholder="What did you learn today? What will you do differently?"
            className={styles.textarea}
            value={journal.reflect}
            onChange={(e) => setJournal((prev) => ({ ...prev, reflect: e.target.value }))}
            onBlur={saveJournal}
            rows={4}
          />
        </div>

        {/* Chat Section */}
        <div className={`${styles.card} ${styles.chatCard}`}>
          <h3 className={styles.cardTitle}>Message Arlo</h3>
          <div className={styles.chatMessages}>
            {messages.length === 0 ? (
              <p className={styles.noMessages}>No messages yet. Start talking to Arlo.</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${styles.message} ${styles[msg.role]}`}
                >
                  <p>{msg.content}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className={styles.chatForm}>
            <input
              type="text"
              placeholder="What's on your mind?"
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={sending || !input.trim()}
            >
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>FAITH · FOCUS · FOLLOW THROUGH</p>
      </footer>
    </div>
  );
}
