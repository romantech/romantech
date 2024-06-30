import { readFileSync, writeFileSync } from 'node:fs';
import Parser from 'rss-parser';

// Constants
const README_PATH = process.env.README_PATH || 'README.md';
const RSS_URL = 'https://romantech.net/rss';
const RSS_HEADERS = { Accept: 'application/rss+xml, application/xml, text/xml; q=0.1' };

const POSTS_COUNT = 5; // Number of latest posts to display
const LINKS_HEADER = '## 🔗 Links';
const POST_HEADER = '## 📝 Latest Posts';
// POST_HEADER 로 시작하고 다음 ## 혹은 문자열 끝까지의 모든 문자를 포함하는 텍스트 블록과 매칭
const LATEST_POSTS_REGEX = new RegExp(`${POST_HEADER}[\s\S]*?(?=\n##|\n$)`);

const parser = new Parser({ headers: RSS_HEADERS });

const fetchFeed = async (url) => {
	try {
		return await parser.parseURL(url);
	} catch (error) {
		console.error('Error fetching RSS feed:', error);
		throw error;
	}
};

const generateLatestPostsMarkdown = (feedItems, count) => {
	const latestPosts = feedItems.slice(0, count).map(({ title, link }) => `- [${title}](${link})`);
	return [POST_HEADER, ...latestPosts].join('\n');
};

const updateReadmeContent = (currentContent, newPostsMarkdown) => {
	const hasPostsSection = currentContent.includes(POST_HEADER);
	if (hasPostsSection) return currentContent.replace(LATEST_POSTS_REGEX, newPostsMarkdown);

	// Links 헤더 있으면 이전에 블로그 포스트 목록 삽입
	const linksHeaderIndex = currentContent.indexOf(LINKS_HEADER);
	if (linksHeaderIndex !== -1) {
		return [
			currentContent.slice(0, linksHeaderIndex),
			newPostsMarkdown + '\n\n',
			currentContent.slice(linksHeaderIndex),
		].join('');
	}

	// 마지막에 블로그 포스트 목록 삽입
	return currentContent + '\n' + newPostsMarkdown;
};

const updateReadmeWithLatestPosts = async () => {
	try {
		const readmeContent = readFileSync(README_PATH, 'utf8');
		const feed = await fetchFeed(RSS_URL);
		const latestPostsMarkdown = generateLatestPostsMarkdown(feed.items, POSTS_COUNT);

		const newReadmeContent = updateReadmeContent(readmeContent, latestPostsMarkdown);

		if (newReadmeContent !== readmeContent) {
			writeFileSync(README_PATH, newReadmeContent, 'utf8');
			console.log('README.md updated successfully');
		} else {
			console.log('No new blog posts. README.md was not updated.');
		}
	} catch (error) {
		console.error('Error updating README.md:', error);
	}
};

updateReadmeWithLatestPosts();
