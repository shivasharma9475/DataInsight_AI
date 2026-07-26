import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { chatApi } from "../services/api.js";

const SUGGESTIONS = [
  "Summarize this dataset",
  "Which columns contain missing values?",
  "Show the highest correlated features",
  "Find anomalies",
  "Suggest business strategies",
];

export default function Chat() {
  const { datasetId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    chatApi.history(datasetId).then((r) => {
      const hist = r.data.flatMap((h) => [
        { role: "user", text: h.message },
        { role: "assistant", text: h.answer },
      ]);
      setMessages(hist);
    });
  }, [datasetId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = text ?? input;
    if (!msg.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await chatApi.ask({ dataset_id: datasetId, message: msg });
      setMessages((m) => [...m, { role: "assistant", text: res.data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, something went wrong answering that." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bot className="text-brand-400" size={22} /> Chat with your data
        </h1>
        <p className="text-slate-400 text-sm">Ask questions in plain English — answers are grounded in your dataset.</p>
      </div>

      <div className="flex-1 overflow-y-auto glass rounded-2xl p-5 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <Sparkles size={28} className="mb-3 opacity-60" />
            <div className="mb-4">Try one of these to get started:</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 transition px-3 py-1.5 rounded-full text-slate-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                m.role === "user" ? "bg-brand-600" : "bg-slate-700"
              }`}>
                {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-200"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center"><Bot size={14} /></div>
              <div className="bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-400">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 glass rounded-xl p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data..."
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-brand-600 hover:bg-brand-500 transition p-2.5 rounded-lg disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
