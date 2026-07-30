import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useParams } from "react-router-dom";

import {
  Send,
  Bot,
  User,
  Sparkles,
} from "lucide-react";

import { chatApi, datasetApi } from "../services/api.js";

// =========================================================
// Dynamic deterministic suggestions
// =========================================================

function buildSuggestions(profile) {
  const numeric =
    profile?.numerical_columns?.[0];

  const category =
    profile?.categorical_columns?.[0];

  const date =
    profile?.datetime_columns?.[0];

  const suggestions = [
    "Summarize this dataset",
  ];

  // Aggregate
  if (numeric) {
    suggestions.push(
      `What is the total ${numeric}?`
    );
  }

  // Group by
  if (numeric && category) {
    suggestions.push(
      `${numeric} by ${category}`
    );
  }

  // Trend + RCA
  if (numeric && date) {
    suggestions.push(
      `Show monthly ${numeric} trend`,
      `Why did ${numeric} change?`
    );
  }

  return suggestions.slice(0, 5);
}


// =========================================================
// Chat
// =========================================================

export default function Chat() {
  const { datasetId } = useParams();

  const [messages, setMessages] =
    useState([]);

  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [profile, setProfile] =
    useState(null);

  const bottomRef = useRef(null);


  // Suggestions automatically change based
  // on the uploaded dataset.
  const suggestions =
    buildSuggestions(profile);

    useEffect(() => {
  if (!datasetId) return;

  const loadData = async () => {
    try {
      const [historyRes, profileRes] = await Promise.all([
        chatApi.history(datasetId),
        datasetApi.profile(datasetId),
      ]);

      const hist = historyRes.data.flatMap((h) => [
        { role: "user", text: h.message },
        { role: "assistant", text: h.answer },
      ]);

      setMessages(hist);
      setProfile(profileRes.data);
    } catch (error) {
      console.error("Failed to load chat data:", error);
    }
  };

  loadData();
}, [datasetId]);


  // =======================================================
  // Auto scroll
  // =======================================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);


  // =======================================================
  // Send message
  // =======================================================

  const send = async (text) => {
    const msg =
      (text ?? input).trim();

    if (!msg || sending) {
      return;
    }


    // Add user message immediately
    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: msg,
      },
    ]);


    setInput("");
    setSending(true);


    try {
      const response =
        await chatApi.ask({
          dataset_id: datasetId,
          message: msg,
        });


      const answer =
        response.data?.answer ||
        "The analysis completed, but no answer was returned.";


      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: answer,
        },
      ]);

    } catch (error) {

      // Backend 422 etc. will now show the
      // actual useful error instead of generic text.
      const errorMessage =
        error.response?.data?.message ||
        "Sorry, something went wrong answering that.";


      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: errorMessage,
        },
      ]);

    } finally {
      setSending(false);
    }
  };


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)]">

      {/* Header */}

      <div className="mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">

          <Bot
            className="text-brand-400"
            size={22}
          />

          Chat with your data
        </h1>

        <p className="text-slate-400 text-sm">
          Ask questions in plain English —
          answers are grounded in your dataset.
        </p>
      </div>


      {/* Chat area */}

      <div className="flex-1 overflow-y-auto glass rounded-2xl p-5 mb-4">

        {/* Empty state + suggestions */}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">

            <Sparkles
              size={28}
              className="mb-3 opacity-60"
            />

            <div className="mb-4">
              Try one of these to get started:
            </div>


            <div className="flex flex-wrap gap-2 justify-center max-w-md">

              {suggestions.map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      send(suggestion)
                    }
                    disabled={sending}
                    className="text-xs bg-slate-800 hover:bg-slate-700 transition px-3 py-1.5 rounded-full text-slate-300 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                )
              )}

            </div>
          </div>
        )}


        {/* Messages */}

        <div className="flex flex-col gap-4">

          {messages.map(
            (message, index) => (

              <div
                key={`${message.role}-${index}`}
                className={`flex gap-3 ${
                  message.role === "user"
                    ? "flex-row-reverse"
                    : ""
                }`}
              >

                {/* Avatar */}

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    message.role === "user"
                      ? "bg-brand-600"
                      : "bg-slate-700"
                  }`}
                >

                  {message.role === "user" ? (
                    <User size={14} />
                  ) : (
                    <Bot size={14} />
                  )}

                </div>


                {/* Message */}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {message.text}
                </div>

              </div>
            )
          )}


          {/* Thinking indicator */}

          {sending && (
            <div className="flex gap-3">

              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">

                <Bot size={14} />

              </div>

              <div className="bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-400">
                Thinking...
              </div>

            </div>
          )}


          <div ref={bottomRef} />

        </div>
      </div>


      {/* Input */}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-center gap-2 glass rounded-xl p-2"
      >

        <input
          value={input}
          onChange={(event) =>
            setInput(
              event.target.value
            )
          }
          placeholder="Ask about your data..."
          disabled={sending}
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:opacity-60"
        />


        <button
          type="submit"
          disabled={
            sending ||
            !input.trim()
          }
          className="bg-brand-600 hover:bg-brand-500 transition p-2.5 rounded-lg disabled:opacity-50"
        >

          <Send size={16} />

        </button>

      </form>

    </div>
  );
}