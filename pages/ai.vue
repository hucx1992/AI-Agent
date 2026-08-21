<template>
  <div class="agent">
    <input type="text" v-model="message" @keyup.enter="sendMessage">
    <button @click="sendMessage">Send</button>
  </div>
</template>

<script setup lang="ts">
import { postAgentChat } from '@/api/agent';

const message = ref('');
const sendMessage = async () => {
  const res = await postAgentChat({
    message: message.value,
  });
  console.log(res);
}

</script>

<style lang="scss" scoped>
.agent {
}
</style>

