<template>
  <div class="addKnowLedge">
    <textarea type="text" v-model="text" placeholder="请输入知识库内容"></textarea>
    <button @click="addKnowLedgeFn">添加</button>
    <button @click="queryKnowLedgeFn">查询</button>
    <ul v-if="hitList.length" class="hit-list">
      <li v-for="item in hitList" :key="item.rank">
        #{{ item.rank }}　相关度 {{ item.score }}　{{ item.content }}
      </li>
    </ul>
    <pre v-else>{{ queryList }}</pre>

    <button @click="toAI">to AI</button>
  </div>
</template>

<script setup lang="ts">
import { addKnowLedge, queryKnowLedge } from '@/api/agent'
interface KnowledgeHit {
  content: string
  score: number
  rank: number
}

const text = ref('');
const queryList = ref<any>({});
const hitList = computed<KnowledgeHit[]>(() => {
  const data = queryList.value?.data
  return Array.isArray(data) ? data : []
})
const addKnowLedgeFn = async () => {
  const result = await addKnowLedge(text.value)
  console.log(result)
}

const queryKnowLedgeFn = async () => {
  const result = await queryKnowLedge(text.value, 3)
  queryList.value = result
  console.log(result)
}

const toAI = () => {
  navigateTo('/ai')
}
</script>

<style lang="scss" scoped>
.addKnowLedge {
  padding: 16px;
}
.hit-list {
  margin-top: 12px;
  padding-left: 20px;
  line-height: 1.8;
}
</style>
