import { CategorizedNews, CategoryKey, NewsItem } from "./types";
import { getHoursDiffFromNow } from "./utils";
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import axios from 'axios';
import Parser from "rss-parser";
const GoogleNewsDecoder = require('google-news-decoder');

interface CustomItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    guid: string;
    isoDate: string;
    source: string;
}

interface CustomFeed{
    title: string;
    description: string;
    items: CustomItem[];
}

const parser: Parser<CustomFeed, CustomItem> = new Parser();

const urlDecoder = new GoogleNewsDecoder();

// async function getFinalUrl(googleNewsUrl: string) {
//   try {
//     const result = decoder.decode(googleNewsUrl);
//     if (result.status){
//         return result.decoded_url;
//     }
//     else{
//         console.error('Error:', result.message);
//     }
//   } catch (error) {
//     console.error('無法解析連結:', error);
//     return googleNewsUrl;
//   }
// }

async function parseXML(url: string, category: CategoryKey): Promise<NewsItem[]> {
    var news: NewsItem[] = [];

    const now = new Date();

    try{
        const feed = await parser.parseURL(url);

        var cnt = 0;

        const item = feed.items[0];

        console.log(item)

        // const finalURL = await getFinalUrl(item.link);
        const decodeResult = await urlDecoder.decodeGoogleNewsUrl(item.link);
        const originalUrl = decodeResult.decodedUrl || decodeResult.unwrappedUrl || decodeResult;

        console.log(`原始連結: ${item.link}，最終連結: ${originalUrl}`);

        const response = await axios.get(originalUrl, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const dom = new JSDOM(response.data, { url: originalUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        console.log(article?.textContent?.trim());

        news.push({
                title: item.title,
                url: item.link,
                source: item.source,
                publishedAt: item.pubDate,
                description: "",
                category: category
            });

        // feed.items.forEach(async (item) => {
        //     if (cnt >= 1) return;
        //     if (getHoursDiffFromNow(item.pubDate) > 48) {
        //         return;
        //     }

        //     const finalURL = await getFinalUrl(item.link);
        //     console.log(`原始連結: ${item.link}，最終連結: ${finalURL}`);

        //     news.push({
        //         title: item.title,
        //         url: finalURL,
        //         source: item.source,
        //         publishedAt: item.pubDate,
        //         description: "",
        //         category: category
        //     });
        //     cnt++;
        //     console.log(cnt);
        // });
    } catch (error) {
        console.error(`Failed to parse XML from ${url}:`, error);
    }

    return news.slice(0, 1);
}

async function pasreGoogleRSS(catagory: CategoryKey) {
    const query: Record<CategoryKey, string> = {
        nation:         "CAAqJQgKIh9DQkFTRVFvSUwyMHZNRFptTXpJU0JYcG9MVlJYS0FBUAE",
        world:          "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx1YlY4U0JYcG9MVlJYR2dKVVZ5Z0FQAQ",
        business:       "CAAqKggKIiRDQkFTRlFvSUwyMHZNRGx6TVdZU0JYcG9MVlJYR2dKVVZ5Z0FQAQ",
        technology:     "CAAqLAgKIiZDQkFTRmdvSkwyMHZNR1ptZHpWbUVnVjZhQzFVVnhvQ1ZGY29BQVAB",
        entertainment:  "CAAqKggKIiRDQkFTRlFvSUwyMHZNREpxYW5RU0JYcG9MVlJYR2dKVVZ5Z0FQAQ",
        sports:          "CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JYcG9MVlJYR2dKVVZ5Z0FQAQ"
    };

    if (!query[catagory]) {
        throw new Error(`Invalid category For Google RSS: ${catagory}`);
    }

    const URL = `https://news.google.com/rss/topics/${query[catagory]}?hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant`;
    //const URL = "https://technews.tw/news-rss/"

    return await parseXML(URL, catagory);
}


const categories: CategoryKey[] = ["technology"];

export async function fetchDailyNews(): Promise<CategorizedNews> {
    const result: CategorizedNews = {};

    for (const category of categories) {
        try {
        const items = await pasreGoogleRSS(category);

        result[category] = items;

        // 🔥 關鍵：加延遲
        await new Promise((res) => setTimeout(res, 1500));
        } catch (err) {
        console.error("Fetch category failed:", err);
        }
    }

    return result;
}