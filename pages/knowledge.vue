<template>
  <div class="addKnowLedge">
    <input type="text" v-model="text" placeholder="请输入知识库内容">
    <button @click="addKnowLedgeFn">添加</button>
    <button @click="queryKnowLedgeFn">查询</button>
    {{ queryList }}

    <button @click="toAI">to AI</button>
  </div>
</template>

<script setup lang="ts">
import { addKnowLedge, queryKnowLedge } from '@/api/agent'
const text = ref('');
const queryList = ref<any>({});
const addKnowLedgeFn = async () => {
  const result = await addKnowLedge(text.value)
  console.log(result)
}

const queryKnowLedgeFn = async () => {
  const result = await queryKnowLedge(text.value)
  queryList.value = result
  console.log(result)
}

const toAI = () => {
  navigateTo('/ai')
}
</script>

<style lang="scss" scoped>
.addKnowLedge {
}
</style>
