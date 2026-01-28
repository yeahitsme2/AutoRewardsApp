import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Paperclip, Send } from 'lucide-react';
import type { ChatAttachment, ChatMessage, ChatThread as ChatThreadRow } from '../types/database';

type ChatThreadProps = {
  shopId: string;
  customerId?: string | null;
  repairOrderId?: string | null;
  threadType: 'ro' | 'general' | 'internal';
  title: string;
  subtitle?: string;
  readOnly?: boolean;
};

interface MessageWithAttachments extends ChatMessage {
  attachments?: ChatAttachment[];
}

export function ChatThread({ shopId, customerId, repairOrderId, threadType, title, subtitle, readOnly }: ChatThreadProps) {
  const { admin, customer } = useAuth();
  const { brandSettings } = useBrand();
  const [thread, setThread] = useState<ChatThreadRow | null>(null);
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileQueue, setFileQueue] = useState<File | null>(null);

  const canSend = useMemo(() => {
    if (readOnly) return false;
    return Boolean(admin || customer);
  }, [admin, customer, readOnly]);

  useEffect(() => {
    if (!shopId) return;
    loadThread();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [shopId, customerId, repairOrderId, threadType]);

  const loadThread = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('chat_threads')
        .select('*')
        .eq('shop_id', shopId)
        .eq('thread_type', threadType);
      if (threadType === 'ro' || threadType === 'internal') {
        if (repairOrderId) query = query.eq('repair_order_id', repairOrderId);
      } else if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      let threadRow = data as ChatThreadRow | null;
      if (!threadRow) {
        const { data: created, error: createError } = await supabase
          .from('chat_threads')
          .insert({
            shop_id: shopId,
            customer_id: customerId || null,
            repair_order_id: repairOrderId || null,
            thread_type: threadType,
            created_by: admin?.auth_user_id || customer?.auth_user_id || null,
          })
          .select('*')
          .single();
        if (createError) throw createError;
        threadRow = created as ChatThreadRow;
      }

      setThread(threadRow);
      await loadMessages(threadRow.id);
    } catch (error) {
      console.error('Failed to load chat thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (overrideThreadId?: string) => {
    const targetThreadId = overrideThreadId || thread?.id;
    if (!targetThreadId) return;
    try {
      const { data: messageRows, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', targetThreadId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { data: attachmentRows, error: attachmentError } = await supabase
        .from('chat_attachments')
        .select('*')
        .in('message_id', (messageRows || []).map((m) => m.id));
      if (attachmentError) throw attachmentError;

      const attachments = (attachmentRows || []) as ChatAttachment[];
      const combined = (messageRows || []).map((message) => ({
        ...(message as ChatMessage),
        attachments: attachments.filter((att) => att.message_id === message.id),
      }));
      setMessages(combined as MessageWithAttachments[]);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!thread || (!messageText.trim() && !fileQueue) || !canSend) return;
    setSending(true);
    try {
      const { data: messageRow, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: thread.id,
          sender_auth_user_id: admin?.auth_user_id || customer?.auth_user_id || null,
          message: messageText.trim() || (fileQueue ? `Attachment: ${fileQueue.name}` : ''),
        })
        .select('*')
        .single();
      if (error) throw error;

      if (fileQueue) {
        const path = `chat/${thread.id}/${messageRow.id}/${Date.now()}-${fileQueue.name}`;
        const upload = await supabase.storage.from('chat-attachments').upload(path, fileQueue, {
          cacheControl: '3600',
          upsert: false,
        });
        if (!upload.error) {
          await supabase.from('chat_attachments').insert({
            message_id: messageRow.id,
            storage_path: path,
            file_name: fileQueue.name,
            mime_type: fileQueue.type,
            file_size: fileQueue.size,
          });
        }
      }

      setMessageText('');
      setFileQueue(null);
      await loadMessages(thread.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderAttachment = (attachment: ChatAttachment) => {
    const publicUrl = supabase.storage.from('chat-attachments').getPublicUrl(attachment.storage_path).data.publicUrl;
    return (
      <a
        key={attachment.id}
        href={publicUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        {attachment.file_name}
      </a>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
        Loading messages...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <div>
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-sm text-slate-800">{message.message}</p>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map(renderAttachment)}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <div className="space-y-3">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Write a message..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <Paperclip className="w-4 h-4" />
              <span>{fileQueue ? fileQueue.name : 'Attach file'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFileQueue(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
