<template>
  <div class="agent">
    <div class="chat-list">
      <p :class="item.role === 'user' ? 'user-msg' : 'assistant-msg'" v-for="item in chatList" :key="item.id">
        <span>{{ item.text || '...' }}</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { streamAgent } from '@/api/agent';

const chatList = ref<any[]>([]);
const message = ref('')
const reply = ref<{ text: string, id: string | undefined }>({ text: '', id: undefined });
const threadId = ref<string>()
const loading = ref(false);

const sendMessage = async () => {
  const text = message.value.trim()
  if (!text || loading.value) return

  loading.value = true;
  message.value = '';
  const assistantMsg = reactive({ text: '', id: undefined as string | undefined });
  reply.value = assistantMsg;

  try {
    chatList.value.push({ id: Date.now(), text, role: 'user' });
    streamAgent(
      { message: text, threadId: threadId.value },
      (partial, id) => {
        console.log('------------------', partial, id);
        assistantMsg.text = partial;
        assistantMsg.id = id;
        if (threadId) threadId.value = id;
      },
    )
    chatList.value.push(assistantMsg);
    // reply.value = result.reply;
  }
  catch (error) {
    reply.value = { text: error instanceof Error ? error.message : '请求失败', id: undefined };
  }
  finally {
    loading.value = false;
    reply.value = { text: '', id: undefined };
  }
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
  .user-msg {
    justify-content: flex-end;
    span {
      border-radius: 18px 0  18px 18px;
      background-color: #f0f0f0;
    }
  }
}
</style>
