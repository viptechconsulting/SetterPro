import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "./buildPrompt";
import { getChatMessages, sendMessage, getProspectPosts } from "@/lib/unipile";
import type { BrainData, SetterConfigData } from "@/types/brain";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ProcessResult {
  sent: boolean;
  action: "replied" | "handoff" | "ai_disabled" | "error";
  error?: string;
}

export async function processConversation(
  conversationId: string
): Promise<ProcessResult> {
  const admin = createAdminClient();

  // Load conversation
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) return { sent: false, action: "error", error: "Conversation not found" };

  const conversation = conv as {
    id: string;
    workspace_id: string;
    unipile_chat_id: string;
    unipile_account_id: string;
    prospect_unipile_id: string;
    prospect_name: string | null;
    prospect_headline: string | null;
    ai_enabled: boolean;
    lead_status: string;
  };

  if (!conversation.ai_enabled) return { sent: false, action: "ai_disabled" };
  if (conversation.lead_status === "booked") return { sent: false, action: "ai_disabled" };

  // Load brain + setter config
  const [{ data: rawBrain }, { data: rawSetter }] = await Promise.all([
    admin.from("brains").select("*").eq("workspace_id", conversation.workspace_id).single(),
    admin.from("setter_configs").select("*").eq("workspace_id", conversation.workspace_id).single(),
  ]);

  if (!rawBrain || !rawSetter) {
    return { sent: false, action: "error", error: "Brain or setter config not found" };
  }

  const brain = rawBrain as unknown as BrainData;
  const setter = rawSetter as unknown as SetterConfigData;

  // Fetch chat history from Unipile + prospect posts in parallel
  const [history, posts] = await Promise.all([
    getChatMessages(conversation.unipile_account_id, conversation.unipile_chat_id, 20),
    getProspectPosts(conversation.unipile_account_id, conversation.prospect_unipile_id, 5),
  ]);

  const systemPrompt = buildSystemPrompt(
    brain,
    setter,
    conversation.prospect_name ?? "",
    conversation.prospect_headline ?? "",
    posts
  );

  // Build messages for Claude (oldest first, max 20)
  const claudeMessages: Anthropic.MessageParam[] = history
    .slice()
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  // Call Claude Sonnet
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: systemPrompt,
    messages: claudeMessages.length > 0 ? claudeMessages : [
      { role: "user", content: `Hola, soy ${conversation.prospect_name ?? "un prospecto"}` },
    ],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";

  // Detect handoff
  if (rawText.includes("[HANDOFF]")) {
    await admin.from("conversations").update({ ai_enabled: false }).eq("id", conversationId);
    // TODO: notify founder via email/push
    return { sent: false, action: "handoff" };
  }

  // Detect Calendly signal
  const shouldSendCalendly = rawText.includes("[SEND_CALENDLY]");
  const cleanText = rawText.replace("[SEND_CALENDLY]", "").trim();

  // Send message via Unipile
  await sendMessage(conversation.unipile_account_id, conversation.unipile_chat_id, cleanText);

  // Store in local messages table
  await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: cleanText,
  });

  // Update lead status if Calendly was sent
  if (shouldSendCalendly) {
    await admin
      .from("conversations")
      .update({ lead_status: "calendly_sent" })
      .eq("id", conversationId);
  }

  return { sent: true, action: "replied" };
}
