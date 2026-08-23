import { PromptTemplate } from '@langchain/core/prompts';

const weartherTemplate = `你是一个有帮助的 AI 助手，{city}的天气情况是{weather}`;
export const weartherPrompt = new PromptTemplate({
    template: weartherTemplate,
    inputVariables: ['city', 'weather'],
});