import { readFileSync, writeFileSync } from 'node:fs';
import Parser from 'rss-parser';

// Constants
const README_PATH = './README.md';
const RSS_URL = 'https://romantech.net/rss'; // 블로그 RSS 주소
const RSS_HEADERS = { Accept: 'application/rss+xml, application/xml, text/xml; q=0.1' };

const MAX_POSTS = 5; // 표시할 포스팅 개수
const HEADER_PREFIX = '##'; // 헤더 레벨
const LINKS_HEADER = `${HEADER_PREFIX} 🔗 Links`; // 링크 목록 헤더 이름
const POSTS_HEADER = `${HEADER_PREFIX} 📝 Articles`; // 포스팅 목록 헤더 이름
// POSTS_HEADER 로 시작해서 다음 HEADER_PREFIX 또는 텍스트 끝까지의 모든 문자 매칭
const POSTS_REGEX = new RegExp(`${POSTS_HEADER}[\\s\\S]*?(?=\\n${HEADER_PREFIX}|\\n$)`);

const parser = new Parser({ headers: RSS_HEADERS });

const getRSSFeed = async (url) => await parser.parseURL(url);

const convertToHTTPS = (url) => {
	if (url.startsWith('http://')) return url.replace('http://', 'https://');
	return url;
};

const createPostsMarkdown = (items, count) => {
	const posts = items.slice(0, count).map(({ title, link }) => {
		return `- [${title}](${convertToHTTPS(link)})`;
	});
	return [POSTS_HEADER, ...posts].join('\n');
};

const updateReadme = (content, newPosts) => {
	const hasPosts = content.includes(POSTS_HEADER);
	if (hasPosts) return content.replace(POSTS_REGEX, newPosts + '\n');

	const linksIndex = content.indexOf(LINKS_HEADER);
	// LINKS_HEADER 헤더 있으면 Links 이전에 포스팅 목록 삽입
	if (linksIndex !== -1) {
		return [content.slice(0, linksIndex), newPosts + '\n\n', content.slice(linksIndex)].join('');
	}

	// LINKS_HEADER 헤더 없으면 마지막에 포스팅 목록 삽입
	return content + '\n' + newPosts;
};

const refreshReadme = async () => {
	const readme = readFileSync(README_PATH, 'utf8');
	const feed = await getRSSFeed(RSS_URL);
	const newPosts = createPostsMarkdown(feed.items, MAX_POSTS);

	const updatedReadme = updateReadme(readme, newPosts);

	if (updatedReadme !== readme) {
		writeFileSync(README_PATH, updatedReadme, 'utf8');
		console.log('README.md updated successfully');
	} else {
		console.log('No new blog posts. README.md was not updated.');
	}
};

try {
	await refreshReadme();
} catch (error) {
	console.error('Error during the refresh process:', error);
	process.exit(1);
} finally {
	process.exit(0);
}
