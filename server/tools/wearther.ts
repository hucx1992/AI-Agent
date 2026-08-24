import { tool } from "@langchain/core/tools";
import { z } from "zod";

/** 含汉字则视为中文输入，否则为其他语言 */
function isChineseInput(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}

async function getGeo(city: string) {
    const params = new URLSearchParams({
        name: city,
        count: '1',
        language: isChineseInput(city) ? 'zh' : 'en',
    });
    // 中文城市名优先限定国内，避免同名海外城市干扰
    if (isChineseInput(city)) {
        params.set('countryCode', 'CN');
    }
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const json = await res.json();
    if (!json.results?.length) throw new Error(`找不到城市：${city}`);
    return {
        lat: json.results[0].latitude,
        lon: json.results[0].longitude
    }
}
export const getWeatherTool = tool(
    async ({ city }) => {
        try {
            const { lat, lon } = await getGeo(city);
            const resp = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
            );
            console.log(resp);
            const data = await resp.json();
            const w = data.current_weather;
            return `城市：${city}，温度：${w.temperature}℃，风速：${w.windspeed}km/h，天气编码：${w.weathercode}`;
        } catch (error) {
            return `查天气失败：${error instanceof Error ? error.message : String(error)}。请问您想查询哪个城市的天气？请提供准确的城市名称。`
        }
    },
    {
        name: "get_weather",
        description: "Get the weather of a city",
        schema: z.object({ city: z.string() }),
    },
);