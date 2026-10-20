<template>
  <div class="agent">
    <div class="chat-list">
      <p :class="item.role === 'user' ? 'user-msg' : 'assistant-msg'" v-for="item in chatList" :key="item.id">
        <span>
          <small v-if="item.intentLabel" class="intent-tag">{{ item.intentLabel }}</small>
          {{ item.text || '...' }}
          <small v-if="item.usage" class="token-usage">
            Tokens：{{ item.usage.totalTokens }}
            （输入 {{ item.usage.inputTokens }} / 输出 {{ item.usage.outputTokens }}）
          </small>
        </span>
      </p>
    </div>
    <div class="input-bar">
      <input
        v-model="message"
        type="text"
        @keyup.enter="sendMessage"
      >
      <button @click="sendMessage">
        Send
      </button>
      <button @click="toKnowledge">to Knowledge</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { streamAgent, type IntentInfo, type TokenUsage } from '@/api/agent';

const INTENT_LABEL: Record<IntentInfo['intent'], string> = {
  weather: '查天气',
  knowledge: '查知识库',
  chitchat: '闲聊',
}

interface ChatMessage {
  id: number | string | undefined
  text: string
  role: 'user' | 'assistant'
  usage?: TokenUsage
  intentLabel?: string
}

const chatList = ref<ChatMessage[]>([]);
const message = ref('')
const threadId = ref<string>()
const loading = ref(false);

const sendMessage = async () => {
  const text = message.value.trim()
  if (!text || loading.value) return

  loading.value = true;
  message.value = '';
  const assistantMsg = reactive<ChatMessage>({
    text: '',
    id: undefined,
    role: 'assistant',
  });

  try {
    chatList.value.push({ id: Date.now(), text, role: 'user' }, assistantMsg);
    const result = await streamAgent(
      { message: text, threadId: threadId.value },
      (partial, id) => {
        assistantMsg.text = partial;
        assistantMsg.id = id;
        if (id) threadId.value = id;
      },
      (intent, id) => {
        assistantMsg.intentLabel = INTENT_LABEL[intent.intent]
        if (id) threadId.value = id
      },
    )
    assistantMsg.usage = result.usage ?? undefined;
    if (result.intent) {
      assistantMsg.intentLabel = INTENT_LABEL[result.intent.intent]
    }
  }
  catch (error) {
    assistantMsg.text = error instanceof Error ? error.message : '请求失败';
  }
  finally {
    loading.value = false;
  }
}

const toKnowledge = () => {
  navigateTo('/knowledge')
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>

<style lang="scss" scoped>
.agent {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
.input-bar {
  display: flex;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background-color: #f0f0f0;

  input {
    width: 100%;
    height: 40px;
    border-radius: 5px;
    border: 0 none;
    padding: 0 10px;
  }
  button {
    width: 140px;
    border-radius: 5px;
    border: 0 none;
    background-color: #000;
    color: #fff;
  }
}

.chat-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  white-space: pre-wrap;
  margin-top: 20px;
  padding: 10px;
  overflow: hidden auto;

  p {
    display: flex;
    width: 100%;
    span {
      border: 1px solid #ccc;
      border-radius: 0 18px 18px 18px;
      padding: 10px;
      margin-bottom: 10px;
    }
  }
  .intent-tag {
    display: inline-block;
    margin-bottom: 6px;
    margin-right: 6px;
    padding: 1px 8px;
    border-radius: 999px;
    background: #111;
    color: #fff;
    font-size: 12px;
  }
  .token-usage {
    display: block;
    margin-top: 6px;
    color: #999;
    font-size: 12px;
  }
  .user-msg {
    justify-content: flex-end;
    span {
      border-radius: 18px 0  18px 18px;
      background-color: #f0f0f0;
    }
  }
}
</style>
