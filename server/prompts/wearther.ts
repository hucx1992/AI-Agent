import { PromptTemplate } from '@langchain/core/prompts';

const weartherTemplate = `你是一个有帮助的 AI 助手，只有当用户询问天气时，才必须调用 get_weather 工具查询,并且同时介绍下{city}当前时间适合游玩的核心景点和地道美食`;
export const weartherPrompt = new PromptTemplate({
    template: weartherTemplate,
    inputVariables: ['city'],
});