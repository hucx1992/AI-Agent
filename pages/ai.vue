<template>
  <div class="agent">
    <input
      v-model="message"
      type="text"
      @keyup.enter="sendMessage"
    >
    <button @click="sendMessage">
      Send
    </button>
    <div class="chat-list">
      <p v-for="item in chatList" :key="item.id">{{ item }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { streamAgent } from '@/api/agent';

const chatList = ref<any[]>([]);
const message = ref('')
const reply = ref('')
const threadId = ref<string>()
const loading = ref(false)

const sendMessage = async () => {
  const text = message.value.trim()
  if (!text || loading.value) return

  loading.value = true;
  reply.value = '';
  message.value = '';

  try {
    // 用流式：会走 api/agent.ts 里的 streamAgent
    chatList.value.push({ id: Date.now(), content: text, role: 'user' });
    const result = await streamAgent(
      { message: text, threadId: threadId.value },
      (partial, id) => {
        console.log('------------------')
        reply.value = partial;
        if (threadId) threadId.value = id;
      },
    )
    reply.value = result.reply;
    threadId.value = result.threadId;
  }
  catch (error) {
    reply.value = error instanceof Error ? error.message : '请求失败'
  }
  finally {
    loading.value = false;
    chatList.value.push(reply.value);
    reply.value = '';
  }
}
</script>

<style lang="scss" scoped>
.agent {}

.reply {
  white-space: pre-wrap;
  margin-top: 20px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 5px;
}
</style>
